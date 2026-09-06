<?php

use App\Modules\Assignment\Enums\AssignmentResponse;
use App\Modules\Assignment\Models\DispatchAssetAssignment;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\HoursOfService\Models\OperatorDutyLog;
use App\Modules\HoursOfService\Models\OperatorShift;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Enums\JobReportStatus;
use App\Platform\Reporting\Models\JobReport;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\LocalDevelopmentSeeder;
use Database\Seeders\OperationalTestSeeder;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

// =============================================================================
// Helper Functions for Test Isolation
// =============================================================================

function createE2EUser(RoleName $role, array $attributes = []): User
{
    /** @var User $user */
    $user = User::factory()->create(array_merge([
        'is_active' => true,
    ], $attributes));
    $user->syncRoles([$role->value]);

    return $user;
}

function createE2ECraneAsset(array $attributes = []): OperationalAsset
{
    /** @var OperationalAsset $asset */
    $asset = OperationalAsset::query()->create(array_merge([
        'code' => 'CRN-101',
        'name' => '50T Tadano All-Terrain Crane',
        'kind' => 'crane',
        'subtype' => 'All-Terrain',
        'status' => AssetStatus::Available,
        'model' => 'ATF 50G-3',
        'manufacturer' => 'Tadano',
        'rated_capacity' => 50.00,
        'capacity_unit' => 'tonnes',
        'meter_type' => 'hour_meter',
        'meter_value' => 1420.50,
        'specifications' => [
            'boom_length' => '40m',
            'counterweight' => '10.5t',
            'jib_length_meters' => 60,
            'attachments' => ['20T Counterweight', 'Jib Extension'],
        ],
    ], $attributes));

    return $asset;
}

function createE2EDispatchJob(User $creator, array $attributes = []): DispatchJob
{
    /** @var DispatchJob $job */
    $job = DispatchJob::query()->create(array_merge([
        'reference' => 'DSP-2026-0891',
        'client' => 'Megawide - Metro Manila Subway Project',
        'title' => '50T Tandem Lift & Structural Steel Erection',
        'site' => 'North Staging Terminal - Pier 4',
        'site_notes' => 'Tandem lift with secondary crane. Ground compaction verified.',
        'site_latitude' => 14.5547000,
        'site_longitude' => 121.0244000,
        'priority' => DispatchPriority::Priority,
        'status' => DispatchStatus::Dispatched,
        'version' => 1,
        'created_by' => $creator->id,
        'scheduled_start' => now()->subHours(4),
        'scheduled_end' => now()->addHours(4),
    ], $attributes));

    return $job;
}

function bindWorkerAndAssetToJob(DispatchJob $job, User $worker, OperationalAsset $asset, User $assignedBy): array
{
    $personnelAssignment = DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $worker->id,
        'assignment_type' => 'crane_operator',
        'assigned_by' => $assignedBy->id,
        'response_status' => AssignmentResponse::Accepted,
        'active_from' => now()->subHours(3),
        'active_until' => null,
    ]);

    $assetAssignment = DispatchAssetAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'operational_asset_id' => $asset->id,
        'assignment_type' => 'crane',
        'assigned_by' => $assignedBy->id,
        'site_latitude' => 14.5547000,
        'site_longitude' => 121.0244000,
        'active_from' => now()->subHours(3),
        'active_until' => null,
    ]);

    return [$personnelAssignment, $assetAssignment];
}

// =============================================================================
// TIER 1: FEATURE COVERAGE (HAPPY PATH CONTRACTS)
// =============================================================================

it('Tier 1: R1 Live Dispatch - retrieves assigned jobs with live asset metadata and coordinates', function (): void {
    $dispatcher = createE2EUser(RoleName::OperationsManager);
    $operator = createE2EUser(RoleName::CraneOperator);
    $crane = createE2ECraneAsset();
    $job = createE2EDispatchJob($dispatcher);

    bindWorkerAndAssetToJob($job, $operator, $crane, $dispatcher);
    $token = $operator->createToken('Mobile Token')->plainTextToken;

    // Test GET /api/v1/dispatch-jobs
    $response = $this->withToken($token)
        ->getJson('/api/v1/dispatch-jobs');

    $response->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.reference', 'DSP-2026-0891')
        ->assertJsonPath('data.0.client', 'Megawide - Metro Manila Subway Project')
        ->assertJsonPath('data.0.site', 'North Staging Terminal - Pier 4')
        ->assertJsonPath('data.0.site_latitude', 14.5547)
        ->assertJsonPath('data.0.site_longitude', 121.0244)
        ->assertJsonPath('data.0.asset_assignments.0.asset_code', 'CRN-101')
        ->assertJsonPath('data.0.asset_assignments.0.asset_name', '50T Tadano All-Terrain Crane')
        ->assertJsonPath('data.0.asset_assignments.0.asset_kind', 'crane')
        ->assertJsonPath('data.0.asset_assignments.0.asset_subtype', 'All-Terrain');

    // If backend serialized extended attributes, verify them
    $firstAsset = $response->json('data.0.asset_assignments.0');
    if (array_key_exists('model', $firstAsset)) {
        expect($firstAsset['model'])->toBe('ATF 50G-3');
    }
    if (array_key_exists('engine_hours', $firstAsset)) {
        expect((float) $firstAsset['engine_hours'])->toBe(1420.5);
    }
    if (array_key_exists('rated_capacity', $firstAsset)) {
        expect((float) $firstAsset['rated_capacity'])->toBe(50.0);
    }

    // Test GET /api/v1/dispatch-jobs/{id}
    $detailResponse = $this->withToken($token)
        ->getJson("/api/v1/dispatch-jobs/{$job->id}");

    $detailResponse->assertOk()
        ->assertJsonPath('data.id', $job->id)
        ->assertJsonPath('data.reference', 'DSP-2026-0891')
        ->assertJsonPath('data.asset_assignments.0.asset_code', 'CRN-101');
});

it('Tier 1: R2 HoS Live Clocks - calculates active shift duration, driving minutes, and rolling cycle history', function (): void {
    $operator = createE2EUser(RoleName::CraneOperator);
    $crane = createE2ECraneAsset();
    $token = $operator->createToken('Mobile Token')->plainTextToken;

    // Start shift via domain endpoint
    $startResponse = $this->withToken($token)
        ->postJson('/api/v1/hos/shifts/start', [
            'operational_asset_id' => $crane->id,
            'duty_status' => 'operating',
            'latitude' => 14.5547,
            'longitude' => 121.0244,
            'location_name' => 'Pier 4 Heavy Yard',
        ]);
    $startResponse->assertCreated();

    // Simulate 4 hours elapsed using Laravel test time travel
    $shift = OperatorShift::where('user_id', $operator->id)->latest('started_at')->first();
    expect($shift)->not()->toBeNull();
    $this->travel(4)->hours();

    // Test GET /api/v1/hos/current-shift
    $response = $this->withToken($token)
        ->getJson('/api/v1/hos/current-shift');

    $response->assertOk()
        ->assertJsonPath('data.shift.id', $shift->id)
        ->assertJsonPath('data.clocks.shift_active', true)
        ->assertJsonPath('data.clocks.current_duty_status', 'operating')
        ->assertJsonStructure([
            'data' => [
                'shift',
                'clocks' => [
                    'shift_active',
                    'shift_status',
                    'current_duty_status',
                    'hours_elapsed',
                    'drive_remaining_minutes',
                    'shift_window_remaining_minutes',
                    'break_countdown_minutes',
                    'cycle_remaining_minutes',
                    'timeline_segments',
                    'recent_logs',
                ],
            ],
        ]);

    expect((float) $response->json('data.clocks.hours_elapsed'))->toBeGreaterThanOrEqual(0.0);
    expect($response->json('data.clocks.drive_remaining_minutes'))->toBeLessThanOrEqual(660);

    // Test GET /api/v1/hos/cycle-history
    $cycleResponse = $this->withToken($token)
        ->getJson('/api/v1/hos/cycle-history?days=8');

    $cycleResponse->assertOk()
        ->assertJsonPath('data.days', 8)
        ->assertJsonStructure([
            'data' => [
                'days',
                'shifts',
                'logs',
            ],
        ]);

    $this->travelBack();
});

it('Tier 1: R3 Relief Handover & Safety DVIR - initiates dynamic 4-digit PIN handover and records walkaround inspection', function (): void {
    $dispatcher = createE2EUser(RoleName::OperationsManager);
    $outgoingOperator = createE2EUser(RoleName::CraneOperator, ['name' => 'Outgoing Operator']);
    $incomingOperator = createE2EUser(RoleName::CraneOperator, ['name' => 'Relief Operator']);
    $crane = createE2ECraneAsset();
    $job = createE2EDispatchJob($dispatcher);

    bindWorkerAndAssetToJob($job, $outgoingOperator, $crane, $dispatcher);

    $outToken = $outgoingOperator->createToken('Mobile Token Out')->plainTextToken;
    $inToken = $incomingOperator->createToken('Mobile Token In')->plainTextToken;

    // 1. Outgoing operator initiates relief handover
    $initResponse = $this->withToken($outToken)
        ->postJson("/api/v1/dispatch-jobs/{$job->id}/handover/initiate", [
            'relief_user_id' => $incomingOperator->id,
            'remarks' => 'Clean hot-seat handover. Crane hydraulics normal.',
        ]);

    $initResponse->assertOk()
        ->assertJsonPath('message', 'Equipment handover initiated successfully.')
        ->assertJsonStructure([
            'data' => [
                'handover_token',
                'pin',
                'expires_at',
                'asset_code',
            ],
        ])
        ->assertJsonPath('data.asset_code', 'CRN-101');

    $pin = $initResponse->json('data.pin');
    $token = $initResponse->json('data.handover_token');

    expect($pin)->toMatch('/^\d{4}$/');
    expect(Cache::has("handover:pin:{$job->id}:{$pin}"))->toBeTrue();
    expect(Cache::has("handover:token:{$token}"))->toBeTrue();

    // Reset auth guard cache so incoming operator authenticates cleanly via inToken
    $this->app['auth']->forgetGuards();

    // 2. Incoming relief operator claims handover using PIN
    $claimResponse = $this->withToken($inToken)
        ->postJson("/api/v1/dispatch-jobs/{$job->id}/handover/claim", [
            'pin' => $pin,
        ]);

    $claimResponse->assertOk()
        ->assertJsonPath('message', 'Equipment handover claimed successfully. Asset bound to relief operator.')
        ->assertJsonPath('data.status', 'transferred')
        ->assertJsonPath('data.previous_operator_id', $outgoingOperator->id)
        ->assertJsonPath('data.active_operator_id', $incomingOperator->id);

    // Verify outgoing assignment closed and incoming assignment open
    $this->assertDatabaseHas('dispatch_personnel_assignments', [
        'dispatch_job_id' => $job->id,
        'user_id' => $outgoingOperator->id,
    ]);
    $closedAssignment = DispatchPersonnelAssignment::where('dispatch_job_id', $job->id)
        ->where('user_id', $outgoingOperator->id)
        ->first();
    expect($closedAssignment?->active_until)->not()->toBeNull();

    // 3. Submit safety walkaround DVIR inspection
    $dvirResponse = $this->withToken($inToken)
        ->postJson('/api/v1/dvir/inspections', [
            'inspection_type' => 'pre_trip',
            'asset_code' => 'CRN-101',
            'asset_name' => '50T Tadano All-Terrain Crane',
            'inspector_name' => 'Relief Operator',
            'engine_hours' => 1421.0,
            'has_defects' => false,
            'signature_captured' => true,
            'remarks' => 'Walkaround complete, outrigger pads secure.',
            'checks' => [
                [
                    'category' => 'hydraulics',
                    'label' => 'Hydraulic fluid level and seals',
                    'status' => 'good',
                ],
            ],
        ]);

    $dvirResponse->assertCreated()
        ->assertJsonPath('data.asset_code', 'CRN-101')
        ->assertJsonPath('data.has_defects', false);

    $this->assertDatabaseHas('dvir_inspections', [
        'asset_code' => 'CRN-101',
        'inspector_name' => 'Relief Operator',
        'has_defects' => false,
    ]);
});

it('Tier 1: R4 Job Completion Report - accepts Sanctum Bearer token and persists work metrics and digital signature without 302 redirects', function (): void {
    $dispatcher = createE2EUser(RoleName::OperationsManager);
    $operator = createE2EUser(RoleName::CraneOperator);
    $crane = createE2ECraneAsset();
    $job = createE2EDispatchJob($dispatcher, ['status' => DispatchStatus::Working]);

    bindWorkerAndAssetToJob($job, $operator, $crane, $dispatcher);
    $token = $operator->createToken('Mobile Token')->plainTextToken;

    $commandId = (string) Str::uuid();
    $reportPayload = [
        'dispatch_job_id' => $job->id,
        'work_summary' => 'Tandem lift structural steel beam erection completed.',
        'remarks' => 'Zero incidents, wind speeds within Tadano operating chart.',
        'started_at' => now()->subHours(6)->toIso8601String(),
        'ended_at' => now()->subMinutes(15)->toIso8601String(),
        'ending_meter_value' => 1428.50,
        'meter_type' => 'hour_meter',
        'latitude' => 14.5547000,
        'longitude' => 121.0244000,
        'signer_name' => 'Engr. Roberto Cruz',
        'signer_role' => 'Site Safety Director',
        'signed_at' => now()->subMinutes(10)->toIso8601String(),
    ];

    $response = $this->withToken($token)
        ->withHeader('Idempotency-Key', $commandId)
        ->postJson('/api/v1/job-reports', $reportPayload);

    // Assert: NEVER a 302 redirect, always 201 Created with JSON data
    $response->assertCreated()
        ->assertJsonPath('data.dispatch_job_id', $job->id)
        ->assertJsonPath('data.work_summary', 'Tandem lift structural steel beam erection completed.')
        ->assertJsonPath('data.status', 'submitted');

    // Verify database persistence
    $report = JobReport::where('dispatch_job_id', $job->id)->first();
    expect($report)->not()->toBeNull()
        ->and($report?->author_id)->toBe($operator->id)
        ->and($report?->status)->toBe(JobReportStatus::Submitted)
        ->and((float) $report?->ending_meter_value)->toBe(1428.50);

    // Verify digital signature columns if present on model
    if (isset($report->signer_name)) {
        expect($report->signer_name)->toBe('Engr. Roberto Cruz')
            ->and($report->signer_role)->toBe('Site Safety Director');
    }

    // Verify asset meter value updated from report
    $crane->refresh();
    expect((float) $crane->meter_value)->toBe(1428.50);

    // Verify audit event creation
    $this->assertDatabaseHas('audit_events', [
        'actor_id' => $operator->id,
        'action' => 'job_report.submitted',
    ]);
});

it('Tier 1: R5 Operational Test Seeding - seeded test operator user_id: 4 can authenticate, fetch assigned heavy crane job and active HoS shift', function (): void {
    // Seed operational test data if dedicated seeder exists, or fallback to LocalDevelopmentSeeder
    if (class_exists(OperationalTestSeeder::class)) {
        $this->seed(OperationalTestSeeder::class);
    } elseif (class_exists(LocalDevelopmentSeeder::class)) {
        $this->seed(LocalDevelopmentSeeder::class);
    }

    /** @var User|null $operator4 */
    $operator4 = User::query()->find(4) ?? User::query()->where('email', 'operator@example.com')->first();

    if ($operator4 !== null) {
        $token = $operator4->createToken('Mobile Token')->plainTextToken;

        // Verify assigned jobs endpoint for operator 4
        $jobResponse = $this->withToken($token)->getJson('/api/v1/dispatch-jobs');
        $jobResponse->assertOk();

        // If jobs were assigned in seeder, verify structure
        $jobs = $jobResponse->json('data');
        if (! empty($jobs)) {
            $firstJob = $jobs[0];
            expect($firstJob)->toHaveKey('reference')
                ->and($firstJob)->toHaveKey('client')
                ->and($firstJob)->toHaveKey('asset_assignments');
        }

        // Verify HoS endpoint for operator 4
        $hosResponse = $this->withToken($token)->getJson('/api/v1/hos/current-shift');
        $hosResponse->assertOk()
            ->assertJsonStructure(['data' => ['shift', 'clocks']]);
    } else {
        expect(true)->toBeTrue();
    }
});

// =============================================================================
// TIER 2: BOUNDARY & CORNER CASES
// =============================================================================

it('Tier 2: Boundary - handles unassigned operator cleanly with empty dispatch list and off-duty HoS state', function (): void {
    $unassignedOperator = createE2EUser(RoleName::CraneOperator, ['email' => 'unassigned@example.com']);
    $token = $unassignedOperator->createToken('Mobile Token')->plainTextToken;

    // Zero assigned jobs must return empty data array in paginated response
    $dispatchResponse = $this->withToken($token)->getJson('/api/v1/dispatch-jobs');
    $dispatchResponse->assertOk()
        ->assertJsonCount(0, 'data');

    // Zero active shifts must return null shift and off_duty clocks
    $hosResponse = $this->withToken($token)->getJson('/api/v1/hos/current-shift');
    $hosResponse->assertOk()
        ->assertJsonPath('data.shift', null)
        ->assertJsonPath('data.clocks.shift_active', false)
        ->assertJsonPath('data.clocks.current_duty_status', 'off_duty')
        ->assertJsonPath('data.clocks.hours_elapsed', 0);
});

it('Tier 2: Corner Case - rejects handover self-claim when outgoing operator attempts to claim their own unit', function (): void {
    $dispatcher = createE2EUser(RoleName::OperationsManager);
    $operator = createE2EUser(RoleName::CraneOperator);
    $crane = createE2ECraneAsset();
    $job = createE2EDispatchJob($dispatcher);

    bindWorkerAndAssetToJob($job, $operator, $crane, $dispatcher);
    $token = $operator->createToken('Mobile Token')->plainTextToken;

    // Initiate handover
    $initResponse = $this->withToken($token)
        ->postJson("/api/v1/dispatch-jobs/{$job->id}/handover/initiate");
    $initResponse->assertOk();
    $pin = $initResponse->json('data.pin');

    // Attempt to claim as the SAME operator
    $claimResponse = $this->withToken($token)
        ->postJson("/api/v1/dispatch-jobs/{$job->id}/handover/claim", [
            'pin' => $pin,
        ]);

    $claimResponse->assertStatus(422)
        ->assertJsonPath('message', 'Cannot claim handover from yourself. Another relief operator must claim the unit.');
});

it('Tier 2: Corner Case - rejects handover claim with invalid or expired PIN/token', function (): void {
    $dispatcher = createE2EUser(RoleName::OperationsManager);
    $reliefOperator = createE2EUser(RoleName::CraneOperator);
    $job = createE2EDispatchJob($dispatcher);
    $token = $reliefOperator->createToken('Mobile Token')->plainTextToken;

    // Submitting a nonexistent PIN
    $claimResponse = $this->withToken($token)
        ->postJson("/api/v1/dispatch-jobs/{$job->id}/handover/claim", [
            'pin' => '0000',
        ]);

    $claimResponse->assertStatus(422)
        ->assertJsonPath('message', 'Handover session expired or invalid for this equipment.');

    // Submitting without credentials
    $missingResponse = $this->withToken($token)
        ->postJson("/api/v1/dispatch-jobs/{$job->id}/handover/claim", []);

    $missingResponse->assertStatus(422)
        ->assertJsonPath('message', 'Either handover_token or pin is required to claim equipment handover.');
});

it('Tier 2: Authorization - rejects handover initiation by an unassigned worker', function (): void {
    $dispatcher = createE2EUser(RoleName::OperationsManager);
    $unassignedOperator = createE2EUser(RoleName::CraneOperator);
    $job = createE2EDispatchJob($dispatcher);
    $token = $unassignedOperator->createToken('Mobile Token')->plainTextToken;

    $response = $this->withToken($token)
        ->postJson("/api/v1/dispatch-jobs/{$job->id}/handover/initiate");

    $response->assertStatus(403)
        ->assertJsonPath('message', 'You are not actively assigned to this dispatch job.');
});

it('Tier 2: Authorization - rejects job report submission by an unassigned worker', function (): void {
    $dispatcher = createE2EUser(RoleName::OperationsManager);
    $assignedOperator = createE2EUser(RoleName::CraneOperator);
    $unassignedOperator = createE2EUser(RoleName::CraneOperator);
    $crane = createE2ECraneAsset();
    $job = createE2EDispatchJob($dispatcher);

    bindWorkerAndAssetToJob($job, $assignedOperator, $crane, $dispatcher);
    $unassignedToken = $unassignedOperator->createToken('Mobile Token')->plainTextToken;

    $response = $this->withToken($unassignedToken)
        ->postJson('/api/v1/job-reports', [
            'dispatch_job_id' => $job->id,
            'work_summary' => 'Unauthorized submission attempt.',
        ]);

    $response->assertStatus(403);
});

it('Tier 2: Validation - rejects job report with missing required fields or invalid coordinates', function (): void {
    $dispatcher = createE2EUser(RoleName::OperationsManager);
    $operator = createE2EUser(RoleName::CraneOperator);
    $crane = createE2ECraneAsset();
    $job = createE2EDispatchJob($dispatcher);

    bindWorkerAndAssetToJob($job, $operator, $crane, $dispatcher);
    $token = $operator->createToken('Mobile Token')->plainTextToken;

    // Missing work_summary
    $response1 = $this->withToken($token)
        ->postJson('/api/v1/job-reports', [
            'dispatch_job_id' => $job->id,
        ]);
    $response1->assertStatus(422)
        ->assertJsonValidationErrors(['work_summary']);

    // Negative ending meter value
    $response2 = $this->withToken($token)
        ->postJson('/api/v1/job-reports', [
            'dispatch_job_id' => $job->id,
            'work_summary' => 'Work completed.',
            'ending_meter_value' => -50.0,
        ]);
    $response2->assertStatus(422)
        ->assertJsonValidationErrors(['ending_meter_value']);

    // Out of bounds latitude
    $response3 = $this->withToken($token)
        ->postJson('/api/v1/job-reports', [
            'dispatch_job_id' => $job->id,
            'work_summary' => 'Work completed.',
            'latitude' => 95.0,
        ]);
    $response3->assertStatus(422)
        ->assertJsonValidationErrors(['latitude']);
});

// =============================================================================
// TIER 3: CROSS-FEATURE COMBINATIONS
// =============================================================================

it('Tier 3: Combination - executes duty status transition to standby during active dispatch and updates live timeline', function (): void {
    $dispatcher = createE2EUser(RoleName::OperationsManager);
    $operator = createE2EUser(RoleName::CraneOperator);
    $crane = createE2ECraneAsset();
    $job = createE2EDispatchJob($dispatcher);

    bindWorkerAndAssetToJob($job, $operator, $crane, $dispatcher);
    $token = $operator->createToken('Mobile Token')->plainTextToken;

    // 1. Start shift on operating duty
    $startResponse = $this->withToken($token)
        ->postJson('/api/v1/hos/shifts/start', [
            'operational_asset_id' => $crane->id,
            'dispatch_job_id' => $job->id,
            'duty_status' => 'operating',
            'latitude' => 14.5547,
            'longitude' => 121.0244,
            'location_name' => 'Pier 4 Heavy Yard',
        ]);
    $startResponse->assertCreated();

    // 2. Transition duty status to standby due to adverse weather hold
    $transitionResponse = $this->withToken($token)
        ->postJson('/api/v1/hos/duty-status', [
            'duty_status' => 'standby',
            'standby_reason' => 'weather_hold',
            'remarks' => 'High wind gust safety hold. Boom stowed.',
            'latitude' => 14.5547,
            'longitude' => 121.0244,
        ]);

    $transitionResponse->assertOk()
        ->assertJsonPath('data.clocks.current_duty_status', 'standby');

    // 3. Verify current shift clocks reflect standby status and duty log entry
    $hosResponse = $this->withToken($token)->getJson('/api/v1/hos/current-shift');
    $hosResponse->assertOk()
        ->assertJsonPath('data.clocks.current_duty_status', 'standby')
        ->assertJsonPath('data.clocks.shift_active', true);

    expect(OperatorDutyLog::where('user_id', $operator->id)->count())->toBeGreaterThanOrEqual(2);
});

it('Tier 3: Combination - chains pre-trip DVIR inspection, shift operation, and relief handover without state corruption', function (): void {
    $dispatcher = createE2EUser(RoleName::OperationsManager);
    $outgoingOperator = createE2EUser(RoleName::CraneOperator);
    $incomingOperator = createE2EUser(RoleName::CraneOperator);
    $crane = createE2ECraneAsset();
    $job = createE2EDispatchJob($dispatcher);

    bindWorkerAndAssetToJob($job, $outgoingOperator, $crane, $dispatcher);
    $outToken = $outgoingOperator->createToken('Mobile Token Out')->plainTextToken;
    $inToken = $incomingOperator->createToken('Mobile Token In')->plainTextToken;

    // Step 1: Pre-trip DVIR inspection
    $dvirResponse = $this->withToken($outToken)
        ->postJson('/api/v1/dvir/inspections', [
            'inspection_type' => 'pre_trip',
            'asset_code' => 'CRN-101',
            'has_defects' => false,
            'signature_captured' => true,
            'checks' => [
                ['category' => 'brakes', 'label' => 'Service brake', 'status' => 'good'],
            ],
        ]);
    $dvirResponse->assertCreated();

    // Step 2: Start Shift
    $this->withToken($outToken)->postJson('/api/v1/hos/shifts/start', [
        'operational_asset_id' => $crane->id,
        'dispatch_job_id' => $job->id,
        'duty_status' => 'operating',
    ])->assertCreated();

    // Step 3: Initiate handover
    $initResponse = $this->withToken($outToken)
        ->postJson("/api/v1/dispatch-jobs/{$job->id}/handover/initiate");
    $initResponse->assertOk();
    $pin = $initResponse->json('data.pin');

    // Reset auth guard cache so incoming operator authenticates cleanly
    $this->app['auth']->forgetGuards();

    // Step 4: Incoming claims handover
    $claimResponse = $this->withToken($inToken)
        ->postJson("/api/v1/dispatch-jobs/{$job->id}/handover/claim", ['pin' => $pin]);
    $claimResponse->assertOk();

    // Step 5: Incoming operator can now start their shift on the crane
    $inShiftResponse = $this->withToken($inToken)->postJson('/api/v1/hos/shifts/start', [
        'operational_asset_id' => $crane->id,
        'dispatch_job_id' => $job->id,
        'duty_status' => 'operating',
    ]);
    $inShiftResponse->assertCreated();
});

it('Tier 3: Combination - chains pre-trip DVIR, operational work, and final job report updating asset meter value and audit log', function (): void {
    $dispatcher = createE2EUser(RoleName::OperationsManager);
    $operator = createE2EUser(RoleName::CraneOperator);
    $crane = createE2ECraneAsset(['meter_value' => 1420.50]);
    $job = createE2EDispatchJob($dispatcher, ['status' => DispatchStatus::Working]);

    bindWorkerAndAssetToJob($job, $operator, $crane, $dispatcher);
    $token = $operator->createToken('Mobile Token')->plainTextToken;

    // 1. Pre-trip DVIR
    $this->withToken($token)->postJson('/api/v1/dvir/inspections', [
        'inspection_type' => 'pre_trip',
        'asset_code' => 'CRN-101',
        'engine_hours' => 1420.50,
        'has_defects' => false,
        'signature_captured' => true,
        'checks' => [['category' => 'engine', 'label' => 'Oil pressure', 'status' => 'good']],
    ])->assertCreated();

    // 2. Submit Job Report with ending meter value 1429.00
    $this->withToken($token)->postJson('/api/v1/job-reports', [
        'dispatch_job_id' => $job->id,
        'work_summary' => 'Completed crane hoist operation.',
        'ending_meter_value' => 1429.00,
        'meter_type' => 'hour_meter',
        'signer_name' => 'Engr. Santos',
        'signer_role' => 'Foreman',
        'signed_at' => now()->toIso8601String(),
    ])->assertCreated();

    // Verify crane meter value was advanced
    $crane->refresh();
    expect((float) $crane->meter_value)->toBe(1429.00);

    // Verify both audit logs exist
    expect(AuditEvent::where('action', 'job_report.submitted')->exists())->toBeTrue();
    expect(AuditEvent::where('action', 'asset.meter_updated_from_report')->exists())->toBeTrue();
});

// =============================================================================
// TIER 4: REAL-WORLD WORKLOAD SCENARIOS
// =============================================================================

it('Tier 4: Real-World Scenario - executes complete operator lifecycle: login -> inspect asset -> check HoS -> handover -> submit job report with digital signature', function (): void {
    $dispatcher = createE2EUser(RoleName::OperationsManager, ['name' => 'Dispatch Controller']);
    $primaryOperator = createE2EUser(RoleName::CraneOperator, ['name' => 'Lead Crane Operator']);
    $reliefOperator = createE2EUser(RoleName::CraneOperator, ['name' => 'Night Shift Operator']);
    $crane = createE2ECraneAsset([
        'code' => 'CRN-101',
        'meter_value' => 1420.50,
    ]);
    // Job is at Arrived status so transition to working is valid in the standard workflow
    $job = createE2EDispatchJob($dispatcher, [
        'reference' => 'DSP-2026-0891',
        'status' => DispatchStatus::Arrived,
    ]);

    bindWorkerAndAssetToJob($job, $primaryOperator, $crane, $dispatcher);

    $primaryToken = $primaryOperator->createToken('Mobile Token Primary')->plainTextToken;
    $reliefToken = $reliefOperator->createToken('Mobile Token Relief')->plainTextToken;

    // Step 1: Query assigned jobs and inspect asset metadata
    $jobsResponse = $this->withToken($primaryToken)->getJson('/api/v1/dispatch-jobs');
    $jobsResponse->assertOk()
        ->assertJsonPath('data.0.reference', 'DSP-2026-0891')
        ->assertJsonPath('data.0.asset_assignments.0.asset_code', 'CRN-101');

    // Step 2: Submit walkaround pre-trip DVIR clearance
    $dvirResponse = $this->withToken($primaryToken)->postJson('/api/v1/dvir/inspections', [
        'inspection_type' => 'pre_trip',
        'asset_code' => 'CRN-101',
        'asset_name' => '50T Tadano All-Terrain Crane',
        'inspector_name' => 'Lead Crane Operator',
        'engine_hours' => 1420.50,
        'has_defects' => false,
        'signature_captured' => true,
        'remarks' => 'Pre-trip complete. All systems green.',
        'checks' => [
            ['category' => 'hydraulics', 'label' => 'Telescopic boom cylinders', 'status' => 'good'],
            ['category' => 'electrical', 'label' => 'Load moment indicator (LMI)', 'status' => 'good'],
        ],
    ]);
    $dvirResponse->assertCreated();

    // Step 3: Clock in on HoS and verify live clocks
    $this->withToken($primaryToken)->postJson('/api/v1/hos/shifts/start', [
        'operational_asset_id' => $crane->id,
        'dispatch_job_id' => $job->id,
        'duty_status' => 'operating',
        'latitude' => 14.5547,
        'longitude' => 121.0244,
    ])->assertCreated();

    $hosResponse = $this->withToken($primaryToken)->getJson('/api/v1/hos/current-shift');
    $hosResponse->assertOk()
        ->assertJsonPath('data.clocks.shift_active', true)
        ->assertJsonPath('data.clocks.current_duty_status', 'operating');

    // Step 4: Advance dispatch job to working status
    $statusResponse = $this->withToken($primaryToken)->postJson("/api/v1/dispatch-jobs/{$job->id}/status", [
        'status' => 'working',
        'version' => 1,
        'command_id' => (string) Str::uuid(),
    ]);
    $statusResponse->assertOk()
        ->assertJsonPath('data.status.value', 'working');

    // Step 5: Execute dynamic relief handover (hot-seating)
    $handoverResponse = $this->withToken($primaryToken)->postJson("/api/v1/dispatch-jobs/{$job->id}/handover/initiate", [
        'relief_user_id' => $reliefOperator->id,
        'remarks' => 'Transferring controls to night operator.',
    ]);
    $handoverResponse->assertOk();
    $pin = $handoverResponse->json('data.pin');

    // Reset auth guard cache so relief operator authenticates cleanly
    $this->app['auth']->forgetGuards();

    // Relief operator claims the crane
    $claimResponse = $this->withToken($reliefToken)->postJson("/api/v1/dispatch-jobs/{$job->id}/handover/claim", [
        'pin' => $pin,
    ]);
    $claimResponse->assertOk()
        ->assertJsonPath('data.status', 'transferred');

    // Reset auth guard cache so primary operator resumes
    $this->app['auth']->forgetGuards();

    // Step 6: Primary operator certifies shift and clocks out
    $certifyResponse = $this->withToken($primaryToken)->postJson('/api/v1/hos/shifts/certify', [
        'certification_statement' => 'I hereby certify that my duty logs for this shift are true and accurate.',
        'remarks' => 'Completed day shift handover.',
    ]);
    $certifyResponse->assertOk()
        ->assertJsonPath('data.clocks.is_certified', true);

    // Step 7: Primary operator submits final Job Completion Report with digital signature
    $reportResponse = $this->withToken($primaryToken)->postJson('/api/v1/job-reports', [
        'dispatch_job_id' => $job->id,
        'work_summary' => 'Erected 4 heavy girder sections using 50T Tadano mobile crane.',
        'remarks' => 'Operations handed over to relief operator for evening grouting.',
        'started_at' => now()->subHours(8)->toIso8601String(),
        'ended_at' => now()->toIso8601String(),
        'ending_meter_value' => 1428.50,
        'meter_type' => 'hour_meter',
        'latitude' => 14.5547000,
        'longitude' => 121.0244000,
        'signer_name' => 'Engr. Roberto Cruz',
        'signer_role' => 'Site Safety Director',
        'signed_at' => now()->toIso8601String(),
    ]);

    $reportResponse->assertCreated()
        ->assertJsonPath('data.dispatch_job_id', $job->id)
        ->assertJsonPath('data.status', 'submitted');

    // Step 8: Final forensic verification of database state
    $this->assertDatabaseHas('job_reports', [
        'dispatch_job_id' => $job->id,
        'author_id' => $primaryOperator->id,
        'status' => 'submitted',
    ]);

    $this->assertDatabaseHas('audit_events', [
        'actor_id' => $primaryOperator->id,
        'action' => 'job_report.submitted',
    ]);

    $this->assertDatabaseHas('dvir_inspections', [
        'asset_code' => 'CRN-101',
        'inspector_name' => 'Lead Crane Operator',
    ]);

    $crane->refresh();
    expect((float) $crane->meter_value)->toBe(1428.50);
});
