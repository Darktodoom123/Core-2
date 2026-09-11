<?php

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Attachments\Models\Attachment;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Http\Resources\V1\UserResource;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Http\Resources\V1\OperationalAssetResource;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\Process\Process;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
    RateLimiter::clear('location');
    RateLimiter::clear('uploads');
    RateLimiter::clear('exports');
    RateLimiter::clear('gpt');
    Cache::flush();
    Storage::fake('local');
});

function createSprint7User(RoleName $role): User
{
    $user = User::factory()->create([
        'is_active' => true,
        'email_verified_at' => now(),
    ]);
    $user->syncRoles([$role->value]);

    return $user;
}

it('enforces endpoint-specific rate limiters for location, uploads, exports, and gpt', function (): void {
    $driver = createSprint7User(RoleName::CraneOperator);
    $manager = createSprint7User(RoleName::OperationsManager);

    // 1. Location Telemetry throttle (60 req/min)
    $token = $driver->createToken('test-device')->plainTextToken;
    for ($i = 0; $i < 60; $i++) {
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/locations', [
                'command_id' => Str::uuid()->toString(),
                'captured_at' => now()->toIso8601String(),
                'sharing_enabled' => false,
            ])
            ->assertStatus(201);
    }
    // 61st attempt throttled
    $this->withHeader('Authorization', 'Bearer '.$token)
        ->postJson('/api/v1/locations', [
            'command_id' => Str::uuid()->toString(),
            'captured_at' => now()->toIso8601String(),
            'sharing_enabled' => false,
        ])
        ->assertStatus(429);

    // 2. Data Exports throttle (10 req/min)
    for ($i = 0; $i < 10; $i++) {
        $this->actingAs($manager)
            ->post('/operations/reports/exports', [
                'export_type' => 'job_reports',
                'format' => 'csv',
            ]);
    }
    $this->actingAs($manager)
        ->post('/operations/reports/exports', [
            'export_type' => 'job_reports',
            'format' => 'csv',
        ])
        ->assertStatus(429);

    // 3. Private attachment upload throttle (20 req/min)
    $dispatcher = createSprint7User(RoleName::OperationsManager);
    for ($i = 0; $i < 20; $i++) {
        $job = DispatchJob::query()->create([
            'reference' => 'UPL-'.$i.'-'.uniqid(),
            'client' => 'Client',
            'title' => 'Upload throttle',
            'site' => 'Site',
            'status' => DispatchStatus::Draft,
            'priority' => DispatchPriority::Routine,
            'scheduled_start' => now()->addHour(),
            'scheduled_end' => now()->addHours(2),
            'created_by' => $dispatcher->id,
            'version' => 1,
        ]);
        $this->actingAs($dispatcher)->postJson('/operations/attachments', [
            'file' => UploadedFile::fake()->create("upload-{$i}.pdf", 1, 'application/pdf'),
            'owner_type' => 'dispatch_job',
            'owner_id' => $job->id,
        ])->assertCreated();
    }
    $this->actingAs($dispatcher)->postJson('/operations/attachments', [
        'file' => UploadedFile::fake()->create('overflow.pdf', 1, 'application/pdf'),
        'owner_type' => 'dispatch_job',
        'owner_id' => DispatchJob::query()->firstOrFail()->id,
    ])->assertStatus(429);

    // 4. GPT request throttle (10 req/min)
    Queue::fake();
    for ($i = 0; $i < 10; $i++) {
        $this->actingAs($dispatcher)->post('/operations/gpt-recommendations', [
            'subject_type' => (new DispatchJob)->getMorphClass(),
            'subject_id' => DispatchJob::query()->firstOrFail()->id,
            'purpose' => 'dispatch_assignment',
        ])->assertRedirect();
    }
    $this->actingAs($dispatcher)->post('/operations/gpt-recommendations', [
        'subject_type' => (new DispatchJob)->getMorphClass(),
        'subject_id' => DispatchJob::query()->firstOrFail()->id,
        'purpose' => 'dispatch_assignment',
    ])->assertStatus(429);
});

it('omits development routes when a production application boots', function (): void {
    $process = new Process(
        [PHP_BINARY, 'artisan', 'route:list', '--path=dev'],
        base_path(),
        ['APP_ENV' => 'production'],
    );
    $process->mustRun();

    expect($process->getOutput().$process->getErrorOutput())
        ->toContain("doesn't have any routes matching the given criteria");
});

it('authorizes private attachment downloads correctly', function (): void {
    Storage::fake('private');

    $manager = createSprint7User(RoleName::OperationsManager);

    $attachment = Attachment::query()->create([
        'owner_type' => 'user',
        'owner_id' => $manager->id,
        'uploaded_by' => $manager->id,
        'kind' => 'document',
        'disk' => 'private',
        'path' => 'attachments/test.pdf',
        'original_filename' => 'test-document.pdf',
        'mime_type' => 'application/pdf',
        'size_bytes' => 1024,
        'checksum_sha256' => hash('sha256', 'dummy-content'),
    ]);

    Storage::disk('private')->put($attachment->path, 'dummy-content');

    // Owner can download
    $this->actingAs($manager)
        ->get("/operations/attachments/{$attachment->id}/download")
        ->assertStatus(200);

    // SystemAdmin can download
    $admin = createSprint7User(RoleName::SystemAdministrator);
    $this->actingAs($admin)
        ->get("/operations/attachments/{$attachment->id}/download")
        ->assertStatus(200);
});

it('serializes API V1 JsonResource responses predictably', function (): void {
    $user = createSprint7User(RoleName::CraneOperator);
    $userResource = (new UserResource($user))->resolve();

    expect($userResource)->toHaveKeys(['id', 'name', 'email', 'role']);

    $asset = OperationalAsset::query()->create([
        'code' => 'AST-999',
        'name' => 'Test Crane',
        'kind' => 'crane',
        'status' => AssetStatus::Available,
    ]);
    $assetResource = (new OperationalAssetResource($asset))->resolve();

    expect($assetResource)->toHaveKeys(['id', 'code', 'name', 'status']);
});
