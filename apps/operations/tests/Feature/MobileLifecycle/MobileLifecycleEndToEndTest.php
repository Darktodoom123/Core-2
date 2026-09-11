<?php

use App\Modules\Assignment\Enums\AssignmentResponse;
use App\Modules\Assignment\Models\DispatchAssetAssignment;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Tracking\Models\LocationUpdate;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('orchestrates the complete 8-phase mobile lifecycle end-to-end', function (): void {
    // -------------------------------------------------------------------------
    // Setup: Dispatcher, Operator, and Heavy Crane Unit (CRN-101)
    // -------------------------------------------------------------------------
    /** @var User $dispatcher */
    $dispatcher = User::factory()->create(['is_active' => true]);
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    /** @var User $operator */
    $operator = User::factory()->create(['is_active' => true]);
    $operator->syncRoles([RoleName::CraneOperator->value]);
    $operatorToken = $operator->createToken('Mobile Token')->plainTextToken;

    /** @var OperationalAsset $crane */
    $crane = OperationalAsset::query()->create([
        'code' => 'CRN-101',
        'name' => '100T Liebherr All-Terrain Crane',
        'kind' => 'crane',
        'status' => AssetStatus::Available,
    ]);

    // =========================================================================
    // Phase 1: Dispatch Sent
    // - Dispatch creates job and assigns CRN-101 + Operator
    // - Operator duty status is Off Duty
    // - Telemetry is OFF; Asset is not yet active on tracking
    // =========================================================================
    /** @var DispatchJob $job */
    $job = DispatchJob::query()->create([
        'reference' => 'DISP-LIFECYCLE-101',
        'client' => 'Metro Manila Subway Consortium',
        'title' => 'C-5 Station Foundation Lift',
        'site' => 'C-5 Ortigas Ext. Northbound',
        'priority' => DispatchPriority::Priority,
        'status' => DispatchStatus::Dispatched,
        'version' => 1,
        'created_by' => $dispatcher->id,
    ]);

    $personnelAssignment = DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $operator->id,
        'assignment_type' => 'driver',
        'assigned_by' => $dispatcher->id,
        'response_status' => AssignmentResponse::Pending,
        'created_at' => now(),
    ]);

    DispatchAssetAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'operational_asset_id' => $crane->id,
        'assignment_type' => 'primary',
        'assigned_by' => $dispatcher->id,
        'created_at' => now(),
    ]);

    // Operator queries assigned jobs from mobile app
    $dispatchResponse = $this->withToken($operatorToken)
        ->getJson('/api/v1/dispatch-jobs');

    $dispatchResponse->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.reference', 'DISP-LIFECYCLE-101')
        ->assertJsonPath('data.0.my_assignment.response_status', 'pending');

    // Telemetry check: No location updates exist yet
    $this->assertDatabaseMissing('location_updates', [
        'dispatch_job_id' => $job->id,
    ]);

    // =========================================================================
    // Phase 2: Order Accepted
    // - Operator accepts dispatch from home/depot
    // - Telemetry remains strictly OFF (protecting personal privacy during commute)
    // =========================================================================
    $acceptCommandId = (string) Str::uuid();

    $acceptResponse = $this->withToken($operatorToken)
        ->withHeader('Idempotency-Key', $acceptCommandId)
        ->postJson("/api/v1/dispatch-jobs/{$job->id}/assignments/{$personnelAssignment->id}/response", [
            'response' => 'accepted',
            'version' => 1,
        ]);

    $acceptResponse->assertOk()
        ->assertJsonPath('data.my_assignment.response_status', 'accepted');

    expect($personnelAssignment->refresh()->response_status)->toBe(AssignmentResponse::Accepted);

    // =========================================================================
    // Phase 3: Start Shift (HoS Labor Decoupled from Machine Location)
    // - Operator clocks in for morning safety briefing/toolbox
    // - Duty status switches to On Duty
    // - Machine telemetry remains strictly OFF
    // =========================================================================
    $startShiftResponse = $this->flushHeaders()
        ->withToken($operatorToken)
        ->postJson('/api/v1/hos/shifts/start', [
            'duty_status' => 'operating',
            'latitude' => 14.5800,
            'longitude' => 121.0600,
            'location_name' => 'Pasig Yard Depot',
            'remarks' => 'Morning briefing and pre-mobilization safety check.',
        ]);

    $startShiftResponse->assertCreated()
        ->assertJsonPath('data.status', 'active')
        ->assertJsonPath('data.active_duty.duty_status', 'operating');

    $this->assertDatabaseHas('operator_shifts', [
        'user_id' => $operator->id,
        'status' => 'active',
    ]);

    // Invariant check: Job telemetry still has no location entries
    $this->assertDatabaseMissing('location_updates', [
        'dispatch_job_id' => $job->id,
    ]);

    // =========================================================================
    // Phase 4: On-Site Unit Start & Telemetry Activation
    // - Operator physically arrives at CRN-101 and starts unit
    // - Live coordinates stream begins
    // =========================================================================
    $locationCommandId = (string) Str::uuid();

    $locationResponse = $this->withToken($operatorToken)
        ->withHeader('Idempotency-Key', $locationCommandId)
        ->postJson('/api/v1/locations', [
            'dispatch_job_id' => $job->id,
            'latitude' => 14.5862,
            'longitude' => 121.0645,
            'accuracy_metres' => 8.2,
            'sharing_enabled' => true,
            'captured_at' => now()->toIso8601String(),
        ]);

    $locationResponse->assertStatus(201)
        ->assertJsonPath('data.latitude', 14.5862)
        ->assertJsonPath('data.longitude', 121.0645)
        ->assertJsonPath('data.dispatch_job_id', $job->id);

    $this->assertDatabaseHas('location_updates', [
        'user_id' => $operator->id,
        'dispatch_job_id' => $job->id,
        'latitude' => 14.5862,
        'longitude' => 121.0645,
    ]);

    // =========================================================================
    // Phase 5: Pre-Trip DVIR
    // - Operator conducts walkaround inspection of CRN-101
    // - Checklist passed, digital signature captured
    // =========================================================================
    $dvirResponse = $this->flushHeaders()
        ->withToken($operatorToken)
        ->postJson('/api/v1/dvir/inspections', [
            'inspection_type' => 'pre_trip',
            'asset_code' => 'CRN-101',
            'asset_name' => '100T Liebherr All-Terrain Crane',
            'starting_odometer_km' => 12540,
            'engine_hours' => 3420.5,
            'has_defects' => false,
            'signature_captured' => true,
            'remarks' => 'Hydraulics, outriggers, load moment indicator checked. Safe to operate.',
            'checks' => [
                [
                    'category' => 'hydraulics',
                    'label' => 'Main boom hydraulic pressure',
                    'status' => 'good',
                ],
                [
                    'category' => 'outriggers',
                    'label' => 'Outrigger pads and beam extensions',
                    'status' => 'good',
                ],
            ],
        ]);

    $dvirResponse->assertCreated()
        ->assertJsonPath('data.type', 'pre_trip')
        ->assertJsonPath('data.asset_code', 'CRN-101')
        ->assertJsonPath('data.has_defects', false);

    $this->assertDatabaseHas('dvir_inspections', [
        'user_id' => $operator->id,
        'asset_code' => 'CRN-101',
        'inspection_type' => 'pre_trip',
        'has_defects' => false,
    ]);

    // =========================================================================
    // Phase 6: Break / Lunch & Telemetry Pause
    // - Operator switches HoS to On Break
    // - Machine telemetry is paused while operator steps away for meal
    // =========================================================================
    $breakResponse = $this->flushHeaders()
        ->withToken($operatorToken)
        ->postJson('/api/v1/hos/duty-status', [
            'duty_status' => 'on_break',
            'latitude' => 14.5862,
            'longitude' => 121.0645,
            'location_name' => 'C-5 Site Mess Area',
            'remarks' => 'DOLE mandatory meal break.',
        ]);

    $breakResponse->assertOk()
        ->assertJsonPath('data.shift.active_duty.duty_status', 'on_break')
        ->assertJsonPath('data.clocks.current_duty_status', 'on_break');

    // =========================================================================
    // Phase 7: Post-Trip DVIR & Work Conclusion
    // - Ending engine hours and odometer logged
    // - Clean inspection without critical defect
    // =========================================================================
    $postTripResponse = $this->flushHeaders()
        ->withToken($operatorToken)
        ->postJson('/api/v1/dvir/inspections', [
            'inspection_type' => 'post_trip',
            'asset_code' => 'CRN-101',
            'asset_name' => '100T Liebherr All-Terrain Crane',
            'starting_odometer_km' => 12540,
            'engine_hours' => 3428.0,
            'has_defects' => false,
            'signature_captured' => true,
            'remarks' => 'End of shift post-trip inspection. Boom stowed and secured.',
            'checks' => [
                [
                    'category' => 'hydraulics',
                    'label' => 'Main boom hydraulic pressure',
                    'status' => 'good',
                ],
            ],
        ]);

    $postTripResponse->assertCreated()
        ->assertJsonPath('data.type', 'post_trip')
        ->assertJsonPath('data.has_defects', false);

    // =========================================================================
    // Phase 8: End Shift (HoS Clock-Out)
    // - Duty status reverts to Off Duty
    // - Shift certified and completed for payroll
    // =========================================================================
    $completeShiftResponse = $this->flushHeaders()
        ->withToken($operatorToken)
        ->postJson('/api/v1/hos/shifts/certify', [
            'certification_statement' => 'I certify that all my working and break hours recorded are true and correct.',
            'remarks' => 'Full shift completed safely on C-5 site.',
        ]);

    $completeShiftResponse->assertOk()
        ->assertJsonPath('data.shift.status', 'completed')
        ->assertJsonPath('data.clocks.shift_active', false)
        ->assertJsonPath('data.clocks.current_duty_status', 'off_duty');

    $this->assertDatabaseHas('operator_shifts', [
        'user_id' => $operator->id,
        'status' => 'completed',
        'is_certified' => true,
    ]);
});

it('enforces edge case: dispatch rejection requires mandatory reason and clears assignment', function (): void {
    /** @var User $operator */
    $operator = User::factory()->create(['is_active' => true]);
    $operator->syncRoles([RoleName::CraneOperator->value]);
    $token = $operator->createToken('Mobile Token')->plainTextToken;

    /** @var DispatchJob $job */
    $job = DispatchJob::query()->create([
        'reference' => 'DISP-REJECT-001',
        'client' => 'Build Corp',
        'title' => 'Emergency Haul',
        'site' => 'Site R',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Dispatched,
        'version' => 1,
        'created_by' => $operator->id,
    ]);

    $assignment = DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $operator->id,
        'assignment_type' => 'driver',
        'assigned_by' => $operator->id,
        'response_status' => AssignmentResponse::Pending,
        'created_at' => now(),
    ]);

    // Rejection without reason must fail (HTTP 422)
    $this->withToken($token)
        ->withHeader('Idempotency-Key', (string) Str::uuid())
        ->postJson("/api/v1/dispatch-jobs/{$job->id}/assignments/{$assignment->id}/response", [
            'response' => 'rejected',
            'version' => 1,
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['reason']);

    // Rejection with mandatory reason succeeds
    $response = $this->withToken($token)
        ->withHeader('Idempotency-Key', (string) Str::uuid())
        ->postJson("/api/v1/dispatch-jobs/{$job->id}/assignments/{$assignment->id}/response", [
            'response' => 'rejected',
            'reason' => 'hours_conflict',
            'version' => 1,
        ]);

    $response->assertOk();
    // In accordance with PRD 4.1, the assignment clears from the operator's active view
    expect($response->json('data.my_assignment'))->toBeNull();

    // In database, assignment is marked rejected with reason and closed
    $assignment->refresh();
    expect($assignment->response_status)->toBe(AssignmentResponse::Rejected)
        ->and($assignment->response_reason)->toBe('hours_conflict')
        ->and($assignment->active_until)->not->toBeNull();
});

it('enforces edge case: post-trip DVIR with critical defect records defect details', function (): void {
    /** @var User $operator */
    $operator = User::factory()->create(['is_active' => true]);
    $token = $operator->createToken('Mobile Token')->plainTextToken;

    $response = $this->withToken($token)
        ->postJson('/api/v1/dvir/inspections', [
            'inspection_type' => 'post_trip',
            'asset_code' => 'CRN-101',
            'asset_name' => '100T Liebherr All-Terrain Crane',
            'starting_odometer_km' => 12540,
            'engine_hours' => 3430.0,
            'has_defects' => true,
            'signature_captured' => true,
            'remarks' => 'Hydraulic seal leak detected on left rear outrigger cylinder.',
            'checks' => [
                [
                    'id' => 'defect-hydraulic-leak',
                    'category' => 'outriggers',
                    'label' => 'Outrigger hydraulic seal',
                    'status' => 'critical',
                    'notes' => 'Active fluid drip under pressure. Immediate service required.',
                ],
            ],
        ]);

    $response->assertCreated()
        ->assertJsonPath('data.has_defects', true)
        ->assertJsonPath('data.checks.0.status', 'critical');

    $this->assertDatabaseHas('dvir_inspections', [
        'user_id' => $operator->id,
        'asset_code' => 'CRN-101',
        'has_defects' => true,
    ]);

    $this->assertDatabaseHas('dvir_inspection_checks', [
        'label' => 'Outrigger hydraulic seal',
        'status' => 'critical',
    ]);
});

it('enforces decoupling: personal coordinates during HoS clock-in do not attach to job or asset telemetry', function (): void {
    /** @var User $operator */
    $operator = User::factory()->create(['is_active' => true]);
    $operator->syncRoles([RoleName::CraneOperator->value]);
    $token = $operator->createToken('Mobile Token')->plainTextToken;

    /** @var DispatchJob $job */
    $job = DispatchJob::query()->create([
        'reference' => 'DISP-PRIVACY-001',
        'client' => 'Highrise Towers Inc',
        'title' => 'Structural Lift',
        'site' => 'BGC Taguig Site',
        'priority' => DispatchPriority::Priority,
        'status' => DispatchStatus::Dispatched,
        'version' => 1,
        'created_by' => $operator->id,
    ]);

    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $operator->id,
        'assignment_type' => 'driver',
        'assigned_by' => $operator->id,
        'response_status' => AssignmentResponse::Pending,
        'created_at' => now(),
    ]);

    // Operator starts HoS from home / depot (personal coordinates)
    $response = $this->withToken($token)
        ->postJson('/api/v1/hos/shifts/start', [
            'duty_status' => 'operating',
            'latitude' => 14.5300,
            'longitude' => 121.0500,
            'location_name' => 'Operator Home Residence',
            'remarks' => 'Morning clock in for travel and site arrival.',
        ]);

    $response->assertCreated();

    // The shift starts, but location_updates table has zero records for the dispatch job
    $this->assertDatabaseMissing('location_updates', [
        'dispatch_job_id' => $job->id,
    ]);

    // Querying the dispatch job does not leak personal coordinates
    $jobResponse = $this->withToken($token)->getJson("/api/v1/dispatch-jobs/{$job->id}");
    $jobResponse->assertOk();
    expect($jobResponse->json('data.latitude'))->toBeNull()
        ->and($jobResponse->json('data.longitude'))->toBeNull();
});

it('enforces DOLE shift limits and provides calculated ELD clocks to mobile client', function (): void {
    /** @var User $operator */
    $operator = User::factory()->create(['is_active' => true]);
    $token = $operator->createToken('Mobile Token')->plainTextToken;

    // Start shift
    $this->withToken($token)->postJson('/api/v1/hos/shifts/start', [
        'duty_status' => 'operating',
        'location_name' => 'Manila North Harbor',
    ])->assertCreated();

    // Fetch ELD clocks
    $response = $this->withToken($token)->getJson('/api/v1/hos/current-shift');

    $response->assertOk()
        ->assertJsonPath('data.clocks.shift_active', true)
        ->assertJsonPath('data.clocks.current_duty_status', 'operating')
        ->assertJsonPath('data.clocks.cycle_limit_minutes', 4200)
        ->assertJsonPath('data.clocks.drive_remaining_minutes', 660);

    expect($response->json('data.clocks.break_countdown_minutes'))->toBeGreaterThan(0)
        ->and($response->json('data.clocks.shift_window_remaining_minutes'))->toBeGreaterThan(0);
});

it('executes smart dual equipment handover from operator A to relief operator B with zero coordinate drop', function (): void {
    /** @var User $operatorA */
    $operatorA = User::factory()->create(['is_active' => true]);
    $operatorA->syncRoles([RoleName::CraneOperator->value]);
    $tokenA = $operatorA->createToken('Mobile Token A')->plainTextToken;

    /** @var User $operatorB */
    $operatorB = User::factory()->create(['is_active' => true]);
    $operatorB->syncRoles([RoleName::CraneOperator->value]);
    $tokenB = $operatorB->createToken('Mobile Token B')->plainTextToken;

    /** @var OperationalAsset $crane */
    $crane = OperationalAsset::query()->create([
        'code' => 'CRN-101',
        'name' => '100T Liebherr All-Terrain Crane',
        'kind' => 'crane',
        'status' => AssetStatus::Available,
    ]);

    /** @var DispatchJob $job */
    $job = DispatchJob::query()->create([
        'reference' => 'DISP-HOTSEAT-001',
        'client' => 'Subway Pour Night Shift',
        'title' => 'Continuous Foundation Pour',
        'site' => 'Shaft 4 Metro Subway',
        'priority' => DispatchPriority::Priority,
        'status' => DispatchStatus::Dispatched,
        'version' => 1,
        'created_by' => $operatorA->id,
    ]);

    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $operatorA->id,
        'assignment_type' => 'driver',
        'assigned_by' => $operatorA->id,
        'response_status' => AssignmentResponse::Accepted,
        'responded_at' => now(),
        'created_at' => now(),
    ]);

    DispatchAssetAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'operational_asset_id' => $crane->id,
        'assignment_type' => 'primary',
        'assigned_by' => $operatorA->id,
        'created_at' => now(),
    ]);

    // Operator A streams initial day shift position
    $this->withToken($tokenA)
        ->withHeader('Idempotency-Key', (string) Str::uuid())
        ->postJson('/api/v1/locations', [
            'dispatch_job_id' => $job->id,
            'latitude' => 14.5862,
            'longitude' => 121.0645,
            'accuracy_metres' => 5.0,
            'sharing_enabled' => true,
            'captured_at' => now()->toIso8601String(),
        ])
        ->assertStatus(201);

    // Relief Operator B clocks in On Duty for Night Shift
    $this->flushHeaders()
        ->withToken($tokenB)
        ->postJson('/api/v1/hos/shifts/start', [
            'duty_status' => 'operating',
            'latitude' => 14.5862,
            'longitude' => 121.0645,
            'location_name' => 'Shaft 4 Site Cab',
            'remarks' => 'Night shift relief arrival.',
        ])
        ->assertCreated();

    // Operator A initiates Handover with relief operator pre-matched
    $initiateResponse = $this->flushHeaders()
        ->withToken($tokenA)
        ->postJson("/api/v1/dispatch-jobs/{$job->id}/handover/initiate", [
            'relief_user_id' => $operatorB->id,
            'remarks' => 'Day shift lift complete, crane warmed and ready for night pour.',
        ]);

    $initiateResponse->assertOk()
        ->assertJsonPath('data.asset_code', 'CRN-101')
        ->assertJsonPath('data.relief_operator.id', $operatorB->id);

    $pin = $initiateResponse->json('data.pin');
    $handoverToken = $initiateResponse->json('data.handover_token');
    expect($pin)->toBeString()->toHaveLength(4);

    // Reset auth guard cache so Operator B is authenticated via tokenB
    $this->app['auth']->forgetGuards();

    // Operator B claims handover via 4-digit PIN fallback (or 1-tap push token)
    $claimResponse = $this->flushHeaders()
        ->withToken($tokenB)
        ->postJson("/api/v1/dispatch-jobs/{$job->id}/handover/claim", [
            'pin' => $pin,
        ]);

    $claimResponse->assertOk()
        ->assertJsonPath('data.status', 'transferred')
        ->assertJsonPath('data.previous_operator_id', $operatorA->id)
        ->assertJsonPath('data.active_operator_id', $operatorB->id);

    // Operator B immediately takes over telemetry streaming with ZERO coordinate drop
    $this->withToken($tokenB)
        ->withHeader('Idempotency-Key', (string) Str::uuid())
        ->postJson('/api/v1/locations', [
            'dispatch_job_id' => $job->id,
            'latitude' => 14.5863,
            'longitude' => 121.0646,
            'accuracy_metres' => 4.5,
            'sharing_enabled' => true,
            'captured_at' => now()->toIso8601String(),
        ])
        ->assertStatus(201)
        ->assertJsonPath('data.latitude', 14.5863);

    // Verify in database: Operator A is closed, Operator B is active open assignment
    expect(
        DispatchPersonnelAssignment::query()
            ->where('dispatch_job_id', $job->id)
            ->where('user_id', $operatorA->id)
            ->whereNotNull('active_until')
            ->exists()
    )->toBeTrue();

    expect(
        DispatchPersonnelAssignment::query()
            ->where('dispatch_job_id', $job->id)
            ->where('user_id', $operatorB->id)
            ->whereNull('active_until')
            ->exists()
    )->toBeTrue();
});

it('aligns CRN-101 MapLibre tracking indicators across the degradation timeline (Offline -> Fresh -> 3m Delayed -> 15m Stale) with assigned operator metadata', function (): void {
    /** @var User $operator */
    $operator = User::factory()->create(['name' => 'Eduardo Santos', 'is_active' => true]);
    $operator->syncRoles([RoleName::CraneOperator->value]);

    /** @var OperationalAsset $crane */
    $crane = OperationalAsset::query()->create([
        'code' => 'CRN-101',
        'name' => '100T Liebherr All-Terrain Crane',
        'kind' => 'crane',
        'status' => AssetStatus::Available,
    ]);

    /** @var DispatchJob $job */
    $job = DispatchJob::query()->create([
        'reference' => 'DISP-TRACKING-101',
        'client' => 'Metro Manila Subway Consortium',
        'title' => 'C-5 Station Foundation Lift',
        'site' => 'C-5 Ortigas Ext. Northbound',
        'priority' => DispatchPriority::Priority,
        'status' => DispatchStatus::Working,
        'version' => 1,
        'created_by' => $operator->id,
    ]);

    // 1. Initial State: Sharing disabled / commute -> Offline (Gray)
    $offlineUpdate = LocationUpdate::query()->create([
        'user_id' => $operator->id,
        'operational_asset_id' => $crane->id,
        'dispatch_job_id' => $job->id,
        'latitude' => 14.5862,
        'longitude' => 121.0645,
        'accuracy_metres' => 5.0,
        'sharing_enabled' => false,
        'captured_at' => now(),
        'received_at' => now(),
    ]);

    expect($offlineUpdate->freshness_status)->toBe('offline')
        ->and($offlineUpdate->asset->code)->toBe('CRN-101')
        ->and($offlineUpdate->user->name)->toBe('Eduardo Santos');

    // 2. Active On-Site Streaming (0-3m) -> Fresh (Glowing Green)
    $freshUpdate = LocationUpdate::query()->create([
        'user_id' => $operator->id,
        'operational_asset_id' => $crane->id,
        'dispatch_job_id' => $job->id,
        'latitude' => 14.5862,
        'longitude' => 121.0645,
        'accuracy_metres' => 4.2,
        'sharing_enabled' => true,
        'captured_at' => now()->subMinute(),
        'received_at' => now()->subMinute(),
    ]);

    expect($freshUpdate->freshness_status)->toBe('fresh')
        ->and($freshUpdate->asset->code)->toBe('CRN-101')
        ->and($freshUpdate->user->name)->toBe('Eduardo Santos');

    // 3. 3-Minute Silence Degradation (4m silence) -> Delayed (Yellow)
    $delayedUpdate = LocationUpdate::query()->create([
        'user_id' => $operator->id,
        'operational_asset_id' => $crane->id,
        'dispatch_job_id' => $job->id,
        'latitude' => 14.5862,
        'longitude' => 121.0645,
        'accuracy_metres' => 4.2,
        'sharing_enabled' => true,
        'captured_at' => now()->subMinutes(4),
        'received_at' => now()->subMinutes(4),
    ]);

    expect($delayedUpdate->freshness_status)->toBe('delayed')
        ->and($delayedUpdate->asset->code)->toBe('CRN-101')
        ->and($delayedUpdate->user->name)->toBe('Eduardo Santos');

    // 4. 15-Minute Silence Degradation (16m silence) -> Stale (Last Known Location)
    $staleUpdate = LocationUpdate::query()->create([
        'user_id' => $operator->id,
        'operational_asset_id' => $crane->id,
        'dispatch_job_id' => $job->id,
        'latitude' => 14.5862,
        'longitude' => 121.0645,
        'accuracy_metres' => 4.2,
        'sharing_enabled' => true,
        'captured_at' => now()->subMinutes(16),
        'received_at' => now()->subMinutes(16),
    ]);

    expect($staleUpdate->freshness_status)->toBe('stale')
        ->and($staleUpdate->asset->code)->toBe('CRN-101')
        ->and($staleUpdate->user->name)->toBe('Eduardo Santos');

    // 5. Extended Silence (>30m) -> Offline (Gray)
    $expiredOfflineUpdate = LocationUpdate::query()->create([
        'user_id' => $operator->id,
        'operational_asset_id' => $crane->id,
        'dispatch_job_id' => $job->id,
        'latitude' => 14.5862,
        'longitude' => 121.0645,
        'accuracy_metres' => 4.2,
        'sharing_enabled' => true,
        'captured_at' => now()->subMinutes(35),
        'received_at' => now()->subMinutes(35),
    ]);

    expect($expiredOfflineUpdate->freshness_status)->toBe('offline')
        ->and($expiredOfflineUpdate->asset->code)->toBe('CRN-101')
        ->and($expiredOfflineUpdate->user->name)->toBe('Eduardo Santos');
});
