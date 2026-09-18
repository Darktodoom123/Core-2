<?php

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dvir\Actions\CreateDvirInspectionAction;
use App\Modules\Dvir\Http\Requests\Api\V1\CreateDvirInspectionRequest;
use App\Modules\Dvir\Models\DvirInspection;
use App\Modules\Dvir\Models\DvirInspectionPhoto;
use App\Modules\HoursOfService\Enums\ShiftStatus;
use App\Modules\HoursOfService\Models\OperatorDutyLog;
use App\Modules\HoursOfService\Models\OperatorShift;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Storage\Contracts\StorageFallbackServiceInterface;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\MaintenanceWorkOrder;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('replays HOS start shift idempotently with Idempotency-Key header', function (): void {
    /** @var User $operator */
    $operator = User::factory()->create(['is_active' => true]);
    $token = $operator->createToken('Mobile Token')->plainTextToken;
    $commandId = (string) Str::uuid();

    $payload = [
        'duty_status' => 'operating',
        'latitude' => 14.5995,
        'longitude' => 120.9842,
        'location_name' => 'Manila Port Terminal',
        'remarks' => 'Starting morning shift for crane lift operations.',
    ];

    $response1 = $this->withToken($token)
        ->withHeader('Idempotency-Key', $commandId)
        ->postJson('/api/v1/hos/shifts/start', $payload);

    $response1->assertCreated()
        ->assertJsonPath('data.status', 'active')
        ->assertJsonPath('data.active_duty.duty_status', 'operating');

    expect(OperatorShift::query()->where('user_id', $operator->id)->count())->toBe(1);
    expect(OperatorDutyLog::query()->where('user_id', $operator->id)->count())->toBe(1);

    // Replay with identical commandId
    $response2 = $this->withToken($token)
        ->withHeader('Idempotency-Key', $commandId)
        ->postJson('/api/v1/hos/shifts/start', $payload);

    $response2->assertCreated()
        ->assertJsonPath('data.id', $response1->json('data.id'))
        ->assertJsonPath('data.status', 'active');

    expect(OperatorShift::query()->where('user_id', $operator->id)->count())->toBe(1);
    expect(OperatorDutyLog::query()->where('user_id', $operator->id)->count())->toBe(1);
});

it('replays HOS duty status transition idempotently with X-Command-Id header', function (): void {
    /** @var User $operator */
    $operator = User::factory()->create(['is_active' => true]);
    $token = $operator->createToken('Mobile Token')->plainTextToken;

    $this->withToken($token)->postJson('/api/v1/hos/shifts/start', [
        'duty_status' => 'operating',
    ])->assertCreated();

    $commandId = (string) Str::uuid();
    $transitionPayload = [
        'duty_status' => 'standby',
        'standby_reason' => 'waiting_on_concrete',
        'remarks' => 'Waiting on mixer truck.',
    ];

    $response1 = $this->withToken($token)
        ->withHeader('X-Command-Id', $commandId)
        ->postJson('/api/v1/hos/duty-status', $transitionPayload);

    $response1->assertOk()
        ->assertJsonPath('data.shift.active_duty.duty_status', 'standby');

    $logsCount = OperatorDutyLog::query()->where('user_id', $operator->id)->count();

    // Replay exact transition
    $response2 = $this->withToken($token)
        ->withHeader('X-Command-Id', $commandId)
        ->postJson('/api/v1/hos/duty-status', $transitionPayload);

    $response2->assertOk()
        ->assertJsonPath('data.shift.id', $response1->json('data.shift.id'));

    expect(OperatorDutyLog::query()->where('user_id', $operator->id)->count())->toBe($logsCount);
});

it('replays HOS shift certification idempotently with command_id body', function (): void {
    /** @var User $operator */
    $operator = User::factory()->create(['is_active' => true]);
    $token = $operator->createToken('Mobile Token')->plainTextToken;

    $this->withToken($token)->postJson('/api/v1/hos/shifts/start', [
        'duty_status' => 'operating',
    ])->assertCreated();

    $commandId = (string) Str::uuid();
    $certifyPayload = [
        'certification_statement' => 'I hereby certify that my data entries and record of duty status are accurate.',
        'command_id' => $commandId,
    ];

    $response1 = $this->withToken($token)
        ->postJson('/api/v1/hos/shifts/certify', $certifyPayload);

    $response1->assertOk()
        ->assertJsonPath('data.shift.status', 'completed')
        ->assertJsonPath('data.shift.is_certified', true);

    $response2 = $this->withToken($token)
        ->postJson('/api/v1/hos/shifts/certify', $certifyPayload);

    $response2->assertOk()
        ->assertJsonPath('data.shift.id', $response1->json('data.shift.id'))
        ->assertJsonPath('data.shift.status', 'completed');
});

it('enforces partial unique index preventing concurrent active shifts per operator', function (): void {
    /** @var User $operator */
    $operator = User::factory()->create(['is_active' => true]);

    OperatorShift::query()->create([
        'user_id' => $operator->id,
        'status' => ShiftStatus::ACTIVE->value,
        'started_at' => now()->subHour(),
    ]);

    // Attempting to create another active shift for same user should violate unique partial index
    expect(function () use ($operator): void {
        OperatorShift::query()->create([
            'user_id' => $operator->id,
            'status' => ShiftStatus::ACTIVE->value,
            'started_at' => now(),
        ]);
    })->toThrow(QueryException::class);

    // Attempting to create an on_break shift for same user should also violate unique partial index
    expect(function () use ($operator): void {
        OperatorShift::query()->create([
            'user_id' => $operator->id,
            'status' => ShiftStatus::ON_BREAK->value,
            'started_at' => now(),
        ]);
    })->toThrow(QueryException::class);

    // Completed shifts are not restricted by the partial index
    $completedShift = OperatorShift::query()->create([
        'user_id' => $operator->id,
        'status' => ShiftStatus::COMPLETED->value,
        'started_at' => now()->subHours(5),
        'ended_at' => now()->subHours(2),
    ]);

    expect($completedShift->exists)->toBeTrue();
});

it('replays DVIR inspection idempotently with Idempotency-Key preventing duplicate lockouts and photos', function (): void {
    Storage::fake('public');

    /** @var User $operator */
    $operator = User::factory()->create(['is_active' => true]);
    $token = $operator->createToken('Mobile Token')->plainTextToken;

    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-DVIR-IDEMP',
        'name' => 'Idempotency Crane',
        'kind' => 'crane',
        'status' => AssetStatus::Available,
    ]);

    $commandId = (string) Str::uuid();
    $sampleBase64 = 'data:image/jpeg;base64,'.base64_encode('fake-dvir-image-data');

    $payload = [
        'inspection_type' => 'pre_trip',
        'operational_asset_id' => $asset->id,
        'asset_code' => $asset->code,
        'asset_name' => $asset->name,
        'starting_odometer_km' => 1000,
        'has_defects' => true,
        'signature_captured' => true,
        'remarks' => 'Hydraulic line leaking heavily.',
        'checks' => [
            [
                'id' => 'check-leak-1',
                'category' => 'hydraulic_system',
                'label' => 'Main hoist cylinder seal',
                'status' => 'critical',
                'notes' => 'Severe fluid drip during startup.',
            ],
        ],
        'photos' => [
            [
                'angle' => 'front',
                'file_name' => 'leak_photo.jpg',
                'file_size' => 1024,
                'base64' => $sampleBase64,
            ],
        ],
    ];

    $response1 = $this->withToken($token)
        ->withHeader('Idempotency-Key', $commandId)
        ->postJson('/api/v1/dvir/inspections', $payload);

    $response1->assertCreated()
        ->assertJsonPath('data.asset_code', 'CRN-DVIR-IDEMP')
        ->assertJsonPath('data.has_defects', true)
        ->assertJsonCount(1, 'data.photos');

    expect(DvirInspection::query()->where('asset_code', 'CRN-DVIR-IDEMP')->count())->toBe(1);
    expect(DvirInspectionPhoto::query()->count())->toBe(1);
    expect(MaintenanceWorkOrder::query()->where('operational_asset_id', $asset->id)->count())->toBe(1);
    expect($asset->fresh()->status)->toBe(AssetStatus::UnderMaintenance);

    // Replay with exact same Idempotency-Key
    $response2 = $this->withToken($token)
        ->withHeader('Idempotency-Key', $commandId)
        ->postJson('/api/v1/dvir/inspections', $payload);

    $response2->assertCreated()
        ->assertJsonPath('data.internal_id', $response1->json('data.internal_id'));

    // Verify zero duplicates created
    expect(DvirInspection::query()->where('asset_code', 'CRN-DVIR-IDEMP')->count())->toBe(1);
    expect(DvirInspectionPhoto::query()->count())->toBe(1);
    expect(MaintenanceWorkOrder::query()->where('operational_asset_id', $asset->id)->count())->toBe(1);
});

it('compensates and deletes uploaded DVIR photos when database transaction fails', function (): void {
    Storage::fake('public');

    /** @var User $operator */
    $operator = User::factory()->create(['is_active' => true]);

    $sampleBase64 = 'data:image/jpeg;base64,'.base64_encode('compensation-test-photo-data');

    // Create a request with an asset that does not exist in operational_asset_id,
    // but checks have a critical defect so applySafetyLockout will attempt lockForUpdate()->findOrFail() and fail
    $request = new CreateDvirInspectionRequest([
        'inspection_type' => 'pre_trip',
        'operational_asset_id' => 999999, // non-existent asset
        'asset_code' => 'NON-EXISTENT',
        'has_defects' => true,
        'signature_captured' => true,
        'checks' => [
            [
                'id' => 'defect-1',
                'category' => 'brakes_suspension',
                'label' => 'Brake failure',
                'status' => 'critical',
            ],
        ],
        'photos' => [
            [
                'angle' => 'front',
                'file_name' => 'broken_brake.jpg',
                'file_size' => 1024,
                'base64' => $sampleBase64,
            ],
        ],
    ]);
    $request->setUserResolver(fn () => $operator);

    $action = app(CreateDvirInspectionAction::class);

    $uploadedFilesBefore = Storage::disk('public')->allFiles();

    try {
        $action->execute($request, $operator);
        $this->fail('Expected exception from non-existent asset lockout.');
    } catch (Throwable $e) {
        // Exception should be thrown
        expect($e)->toBeInstanceOf(Throwable::class);
    }

    // Verify compensation deleted any uploaded photos
    $uploadedFilesAfter = Storage::disk('public')->allFiles();
    expect($uploadedFilesAfter)->toEqual($uploadedFilesBefore);
    expect(DvirInspection::query()->count())->toBe(0);
    expect(DvirInspectionPhoto::query()->count())->toBe(0);
});

it('validates version and increments DispatchJob version on assignment', function (): void {
    /** @var User $dispatcher */
    $dispatcher = User::factory()->create(['is_active' => true]);
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    /** @var User $driver */
    $driver = User::factory()->create(['is_active' => true]);
    $driver->syncRoles([RoleName::CraneOperator->value]);
    $driver->personnelCredentials()->create([
        'kind' => 'driver_license',
        'credential_number' => 'DL-VER-01',
        'credential_type' => 'professional',
        'issued_at' => now()->subYear(),
        'expires_at' => now()->addYear(),
        'status' => 'active',
    ]);

    /** @var OperationalAsset $asset */
    $asset = OperationalAsset::query()->create([
        'code' => 'TRK-ASSIGN-01',
        'name' => 'Prime Mover Truck',
        'kind' => 'truck',
        'status' => AssetStatus::Available,
    ]);

    /** @var DispatchJob $job */
    $job = DispatchJob::query()->create([
        'reference' => 'JOB-VER-001',
        'client' => 'Version Client',
        'title' => 'Version Test Job',
        'site' => 'Site A',
        'status' => DispatchStatus::Draft,
        'priority' => DispatchPriority::Routine,
        'scheduled_start' => now()->addDay(),
        'scheduled_end' => now()->addDay()->addHours(8),
        'created_by' => $dispatcher->id,
        'version' => 1,
    ]);

    $payload = [
        'personnel' => [['user_id' => $driver->id, 'assignment_type' => 'driver']],
        'assets' => [['operational_asset_id' => $asset->id, 'assignment_type' => 'truck']],
        'version' => 1,
    ];

    // Assigning with matching version succeeds
    $response = $this->actingAs($dispatcher)
        ->from("/operations/dispatch-jobs/{$job->id}")
        ->post("/operations/dispatch-jobs/{$job->id}/assignments", $payload);

    $response->assertRedirect("/operations/dispatch-jobs/{$job->id}");
    expect($job->fresh()->version)->toBe(2);

    // Assigning with stale version (version 1 when job is now version 2) fails validation
    $staleResponse = $this->actingAs($dispatcher)
        ->from("/operations/dispatch-jobs/{$job->id}")
        ->post("/operations/dispatch-jobs/{$job->id}/assignments", [
            'personnel' => [['user_id' => $driver->id, 'assignment_type' => 'driver']],
            'assets' => [['operational_asset_id' => $asset->id, 'assignment_type' => 'truck']],
            'version' => 1, // Stale!
        ]);

    $staleResponse->assertSessionHasErrors('version');
});

it('uploads DVIR photos strictly outside the database transaction', function (): void {
    Storage::fake('public');

    /** @var User $operator */
    $operator = User::factory()->create(['is_active' => true]);
    $token = $operator->createToken('Mobile Token')->plainTextToken;

    $initialTransactionLevel = DB::transactionLevel();
    $observedTransactionLevel = null;

    $realService = app(StorageFallbackServiceInterface::class);
    $storageService = new class($realService, $observedTransactionLevel) implements StorageFallbackServiceInterface
    {
        public function __construct(
            private readonly StorageFallbackServiceInterface $inner,
            public mixed &$observedLevel,
        ) {}

        public function isConfigured(string $disk): bool
        {
            return $this->inner->isConfigured($disk);
        }

        public function resolveDisk(string $desiredDisk, string $fallbackDisk): string
        {
            $this->observedLevel = DB::transactionLevel();

            return $this->inner->resolveDisk($desiredDisk, $fallbackDisk);
        }

        public function safeExecute(string $desiredDisk, string $fallbackDisk, callable $operation): mixed
        {
            return $this->inner->safeExecute($desiredDisk, $fallbackDisk, $operation);
        }

        public function resolvePublicDisk(?string $desired = null, string $fallback = 'public'): string
        {
            return $this->inner->resolvePublicDisk($desired, $fallback);
        }

        public function resolveProtectedDisk(?string $desired = null, string $fallback = 'private'): string
        {
            return $this->inner->resolveProtectedDisk($desired, $fallback);
        }
    };
    app()->instance(StorageFallbackServiceInterface::class, $storageService);

    $sampleBase64 = 'data:image/jpeg;base64,'.base64_encode('transaction-level-photo-check');

    $payload = [
        'inspection_type' => 'pre_trip',
        'asset_code' => 'TX-CHECK-001',
        'has_defects' => false,
        'signature_captured' => true,
        'checks' => [
            [
                'id' => 'check-1',
                'category' => 'brakes_suspension',
                'label' => 'Brakes OK',
                'status' => 'good',
            ],
        ],
        'photos' => [
            [
                'angle' => 'front',
                'file_name' => 'front.jpg',
                'file_size' => 1024,
                'base64' => $sampleBase64,
            ],
        ],
    ];

    $response = $this->withToken($token)
        ->withHeader('Idempotency-Key', (string) Str::uuid())
        ->postJson('/api/v1/dvir/inspections', $payload);

    $response->assertCreated();

    // Verify photo was stored
    expect(DvirInspectionPhoto::query()->count())->toBe(1);
    $photo = DvirInspectionPhoto::query()->firstOrFail();
    Storage::disk($photo->storage_disk)->assertExists($photo->file_path);

    // Assert that storage disk resolution / photo storage strictly occurred outside the action's DB::transaction
    // (Under RefreshDatabase, base level is 1. If photo was uploaded inside DB::transaction(), it would be 2).
    expect($observedTransactionLevel)->toBe($initialTransactionLevel);
});

it('validates HOS start shift rejects invalid duty status with 422', function (): void {
    /** @var User $operator */
    $operator = User::factory()->create(['is_active' => true]);
    $token = $operator->createToken('Mobile Token')->plainTextToken;

    $response = $this->withToken($token)
        ->postJson('/api/v1/hos/shifts/start', [
            'duty_status' => 'invalid_status_value',
        ]);

    $response->assertUnprocessable()
        ->assertJsonValidationErrors(['duty_status']);
});

it('validates conflicting Idempotency-Key and X-Command-Id headers return 422', function (): void {
    /** @var User $operator */
    $operator = User::factory()->create(['is_active' => true]);
    $token = $operator->createToken('Mobile Token')->plainTextToken;

    $uuid1 = (string) Str::uuid();
    $uuid2 = (string) Str::uuid();

    $response = $this->withToken($token)
        ->withHeader('Idempotency-Key', $uuid1)
        ->withHeader('X-Command-Id', $uuid2)
        ->postJson('/api/v1/hos/shifts/start', [
            'duty_status' => 'operating',
        ]);

    $response->assertUnprocessable()
        ->assertJsonValidationErrors(['command_id']);
});

it('replays HOS start shift with matching X-Command-Id and command_id body', function (): void {
    /** @var User $operator */
    $operator = User::factory()->create(['is_active' => true]);
    $token = $operator->createToken('Mobile Token')->plainTextToken;
    $commandId = (string) Str::uuid();

    $payload = [
        'duty_status' => 'operating',
        'command_id' => $commandId,
    ];

    $response1 = $this->withToken($token)
        ->withHeader('X-Command-Id', $commandId)
        ->postJson('/api/v1/hos/shifts/start', $payload);

    $response1->assertCreated();

    $response2 = $this->withToken($token)
        ->withHeader('X-Command-Id', $commandId)
        ->postJson('/api/v1/hos/shifts/start', $payload);

    $response2->assertCreated()
        ->assertJsonPath('data.id', $response1->json('data.id'));
});

it('allows assignment when version is omitted and increments version', function (): void {
    /** @var User $dispatcher */
    $dispatcher = User::factory()->create(['is_active' => true]);
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    /** @var User $driver */
    $driver = User::factory()->create(['is_active' => true]);
    $driver->syncRoles([RoleName::CraneOperator->value]);
    $driver->personnelCredentials()->create([
        'kind' => 'driver_license',
        'credential_number' => 'DL-VER-02',
        'credential_type' => 'professional',
        'issued_at' => now()->subYear(),
        'expires_at' => now()->addYear(),
        'status' => 'active',
    ]);

    /** @var OperationalAsset $asset */
    $asset = OperationalAsset::query()->create([
        'code' => 'TRK-ASSIGN-02',
        'name' => 'Prime Mover Truck 2',
        'kind' => 'truck',
        'status' => AssetStatus::Available,
    ]);

    /** @var DispatchJob $job */
    $job = DispatchJob::query()->create([
        'reference' => 'JOB-VER-002',
        'client' => 'Version Client 2',
        'title' => 'Version Test Job 2',
        'site' => 'Site B',
        'status' => DispatchStatus::Draft,
        'priority' => DispatchPriority::Routine,
        'scheduled_start' => now()->addDay(),
        'scheduled_end' => now()->addDay()->addHours(8),
        'created_by' => $dispatcher->id,
        'version' => 3,
    ]);

    $payload = [
        'personnel' => [['user_id' => $driver->id, 'assignment_type' => 'driver']],
        'assets' => [['operational_asset_id' => $asset->id, 'assignment_type' => 'truck']],
    ];

    $response = $this->actingAs($dispatcher)
        ->from("/operations/dispatch-jobs/{$job->id}")
        ->post("/operations/dispatch-jobs/{$job->id}/assignments", $payload);

    $response->assertRedirect("/operations/dispatch-jobs/{$job->id}");
    expect($job->fresh()->version)->toBe(4);
});

it('consolidates scheduled jobs with zero duplicates and overlapping protection', function (): void {
    /** @var Schedule $schedule */
    $schedule = app()->make(Schedule::class);

    $events = collect($schedule->events());

    // Verify all 7 required jobs/commands are registered
    $eventDescriptions = $events->map(fn ($e) => $e->description ?: $e->command ?: $e->expression)->all();

    $reportsPrune = $events->first(fn ($e) => str_contains((string) $e->description, 'reports:prune-expired'));
    expect($reportsPrune)->not->toBeNull();
    expect($reportsPrune->expression)->toBe('30 2 * * *');
    expect($reportsPrune->withoutOverlapping)->toBeTrue();

    $gptPrune = $events->first(fn ($e) => str_contains((string) $e->description, 'gpt:prune-retention'));
    expect($gptPrune)->not->toBeNull();
    expect($gptPrune->expression)->toBe('45 2 * * *');
    expect($gptPrune->withoutOverlapping)->toBeTrue();

    $gptProactive = $events->first(fn ($e) => str_contains((string) $e->description, 'gpt:proactive-sweep'));
    expect($gptProactive)->not->toBeNull();
    expect($gptProactive->expression)->toBe('* * * * *');
    expect($gptProactive->withoutOverlapping)->toBeTrue();

    $attachmentsPrune = $events->first(fn ($e) => str_contains((string) $e->description, 'attachments:prune-expired'));
    expect($attachmentsPrune)->not->toBeNull();
    expect($attachmentsPrune->expression)->toBe('0 3 * * *');
    expect($attachmentsPrune->withoutOverlapping)->toBeTrue();

    $sosSweep = $events->first(fn ($e) => str_contains((string) $e->description, 'sos:escalation-sweep'));
    expect($sosSweep)->not->toBeNull();
    expect($sosSweep->expression)->toBe('* * * * *');
    expect($sosSweep->withoutOverlapping)->toBeTrue();

    $sosPrune = $events->first(fn ($e) => str_contains((string) $e->description, 'sos:prune-coordinates'));
    expect($sosPrune)->not->toBeNull();
    expect($sosPrune->expression)->toBe('15 3 * * *');
    expect($sosPrune->withoutOverlapping)->toBeTrue();

    $locationPrune = $events->first(fn ($e) => str_contains((string) $e->command, 'location:prune'));
    expect($locationPrune)->not->toBeNull();
    expect($locationPrune->expression)->toBe('15 2 * * *');

    $pushReceipts = $events->first(fn ($e) => str_contains((string) $e->description, 'push:process-receipts'));
    expect($pushReceipts)->not->toBeNull();
    expect($pushReceipts->expression)->toBe('*/15 * * * *');
    expect($pushReceipts->withoutOverlapping)->toBeTrue();

    // Verify exactly 8 events are registered in schedule (no duplicates)
    expect($events->count())->toBe(8);
});
