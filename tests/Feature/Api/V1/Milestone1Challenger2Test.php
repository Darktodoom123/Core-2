<?php

use App\Modules\Assignment\Enums\AssignmentResponse;
use App\Modules\Assignment\Models\DispatchAssetAssignment;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\HoursOfService\Enums\ShiftStatus;
use App\Modules\HoursOfService\Models\OperatorShift;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Carbon\Carbon;
use Database\Seeders\OperationalTestSeeder;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

describe('Milestone 1 Challenger 2: Data Binding & Asset Serialization', function (): void {
    it('verifies GET /api/v1/dispatch-jobs returns complete asset metadata for seeded operator user_id: 4', function (): void {
        $this->seed(OperationalTestSeeder::class);

        /** @var User $operator */
        $operator = User::query()->where('email', 'operator@example.com')->firstOrFail();
        $token = $operator->createToken('Mobile Token')->plainTextToken;

        $response = $this->withToken($token)->getJson('/api/v1/dispatch-jobs');

        $response->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.reference', 'DSP-2026-0891')
            ->assertJsonPath('data.0.client', 'Megawide - Metro Manila Subway Project')
            ->assertJsonPath('data.0.site', 'North Staging Terminal - Pier 4');

        $job = $response->json('data.0');
        expect($job)->toHaveKey('asset_assignments');
        expect($job['asset_assignments'])->toHaveCount(1);

        $asset = $job['asset_assignments'][0];

        // 1. Verify model
        expect($asset)->toHaveKey('model')
            ->and($asset['model'])->toBe('ATF 50G-3');

        // 2. Verify engine_hours
        expect($asset)->toHaveKey('engine_hours')
            ->and((float) $asset['engine_hours'])->toBe(1420.5);

        // 3. Verify rated_capacity
        expect($asset)->toHaveKey('rated_capacity')
            ->and((float) $asset['rated_capacity'])->toBe(50.0);

        // 4. Verify capacity_unit
        expect($asset)->toHaveKey('capacity_unit')
            ->and($asset['capacity_unit'])->toBe('tonnes');

        // 5. Verify attachments
        expect($asset)->toHaveKey('attachments')
            ->and($asset['attachments'])->toBe(['20T Counterweight', 'Jib Extension']);

        // Also verify meter_type and site coordinates
        expect($asset)->toHaveKey('meter_type')
            ->and($asset['meter_type'])->toBe('hour_meter');
        expect((float) $asset['site_latitude'])->toBe(14.5547);
        expect((float) $asset['site_longitude'])->toBe(121.0244);
    });

    it('adversarially stress-tests asset serialization with null and missing values', function (): void {
        $manager = User::factory()->create(['is_active' => true]);
        $manager->syncRoles([RoleName::OperationsManager->value]);

        $operator = User::factory()->create(['is_active' => true]);
        $operator->syncRoles([RoleName::CraneOperator->value]);

        // Asset with null model, null meter_value, null rated_capacity, and empty specifications
        $sparseAsset = OperationalAsset::query()->create([
            'code' => 'SPARSE-001',
            'name' => 'Bare Crane Unit',
            'kind' => 'crane',
            'subtype' => null,
            'status' => AssetStatus::Available,
            'model' => null,
            'rated_capacity' => null,
            'capacity_unit' => null,
            'meter_type' => null,
            'meter_value' => null,
            'specifications' => null,
        ]);

        $job = DispatchJob::query()->create([
            'reference' => 'DSP-SPARSE-01',
            'client' => 'Test Client',
            'title' => 'Sparse Asset Test',
            'site' => 'Test Site',
            'priority' => DispatchPriority::Routine,
            'status' => DispatchStatus::Dispatched,
            'version' => 1,
            'created_by' => $manager->id,
            'scheduled_start' => now(),
            'scheduled_end' => now()->addHours(8),
        ]);

        DispatchPersonnelAssignment::query()->create([
            'dispatch_job_id' => $job->id,
            'user_id' => $operator->id,
            'assignment_type' => 'crane_operator',
            'assigned_by' => $manager->id,
            'response_status' => AssignmentResponse::Accepted,
            'active_from' => now(),
            'active_until' => null,
        ]);

        DispatchAssetAssignment::query()->create([
            'dispatch_job_id' => $job->id,
            'operational_asset_id' => $sparseAsset->id,
            'assignment_type' => 'crane',
            'assigned_by' => $manager->id,
            'active_from' => now(),
            'active_until' => null,
        ]);

        $token = $operator->createToken('Mobile Token')->plainTextToken;
        $response = $this->withToken($token)->getJson('/api/v1/dispatch-jobs');

        $response->assertOk();
        $assetData = $response->json('data.0.asset_assignments.0');

        expect($assetData['model'])->toBeNull()
            ->and($assetData['engine_hours'])->toBeNull()
            ->and($assetData['rated_capacity'])->toBeNull()
            ->and($assetData['capacity_unit'])->toBeNull()
            ->and($assetData['attachments'])->toBe([])
            ->and($assetData['jib_length_meters'])->toBe(60); // Default fallback
    });

    it('filters out expired asset assignments from dispatch-jobs', function (): void {
        $manager = User::factory()->create(['is_active' => true]);
        $manager->syncRoles([RoleName::OperationsManager->value]);

        $operator = User::factory()->create(['is_active' => true]);
        $operator->syncRoles([RoleName::CraneOperator->value]);

        $asset1 = OperationalAsset::query()->create([
            'code' => 'EXPIRED-01',
            'name' => 'Expired Crane',
            'kind' => 'crane',
            'status' => AssetStatus::Available,
        ]);

        $asset2 = OperationalAsset::query()->create([
            'code' => 'ACTIVE-02',
            'name' => 'Active Crane',
            'kind' => 'crane',
            'status' => AssetStatus::Assigned,
        ]);

        $job = DispatchJob::query()->create([
            'reference' => 'DSP-EXP-01',
            'client' => 'Test Client',
            'title' => 'Expired Asset Test',
            'site' => 'Test Site',
            'priority' => DispatchPriority::Routine,
            'status' => DispatchStatus::Dispatched,
            'version' => 1,
            'created_by' => $manager->id,
            'scheduled_start' => now(),
            'scheduled_end' => now()->addHours(8),
        ]);

        DispatchPersonnelAssignment::query()->create([
            'dispatch_job_id' => $job->id,
            'user_id' => $operator->id,
            'assignment_type' => 'crane_operator',
            'assigned_by' => $manager->id,
            'response_status' => AssignmentResponse::Accepted,
            'active_from' => now()->subHours(5),
            'active_until' => null,
        ]);

        // Expired assignment 1 hour ago
        DispatchAssetAssignment::query()->create([
            'dispatch_job_id' => $job->id,
            'operational_asset_id' => $asset1->id,
            'assignment_type' => 'crane',
            'assigned_by' => $manager->id,
            'active_from' => now()->subHours(5),
            'active_until' => now()->subHour(),
        ]);

        // Active assignment
        DispatchAssetAssignment::query()->create([
            'dispatch_job_id' => $job->id,
            'operational_asset_id' => $asset2->id,
            'assignment_type' => 'crane',
            'assigned_by' => $manager->id,
            'active_from' => now()->subHour(),
            'active_until' => null,
        ]);

        $token = $operator->createToken('Mobile Token')->plainTextToken;
        $response = $this->withToken($token)->getJson('/api/v1/dispatch-jobs');

        $response->assertOk();
        $assignments = $response->json('data.0.asset_assignments');

        // Only ACTIVE-02 should be present
        expect($assignments)->toHaveCount(1)
            ->and($assignments[0]['asset_code'])->toBe('ACTIVE-02');
    });
});

describe('Milestone 1 Challenger 2: Hours of Service (HoS) Calculations', function (): void {
    it('verifies GET /api/v1/hos/current-shift returns live clocks and active duty log for seeded operator user_id: 4', function (): void {
        $this->seed(OperationalTestSeeder::class);

        /** @var User $operator */
        $operator = User::query()->where('email', 'operator@example.com')->firstOrFail();
        $token = $operator->createToken('Mobile Token')->plainTextToken;

        $response = $this->withToken($token)->getJson('/api/v1/hos/current-shift');

        $response->assertOk()
            ->assertJsonPath('data.clocks.shift_active', true)
            ->assertJsonPath('data.clocks.shift_status', 'active')
            ->assertJsonPath('data.clocks.current_duty_status', 'operating');

        $clocks = $response->json('data.clocks');
        $shift = $response->json('data.shift');

        // 1. Verify active duty log in shift
        expect($shift)->toHaveKey('active_duty')
            ->and($shift['active_duty'])->not()->toBeNull()
            ->and($shift['active_duty']['duty_status'])->toBe('operating')
            ->and($shift['active_duty']['ended_at'])->toBeNull()
            ->and($shift['active_duty']['location_name'])->toBe('North Staging Terminal - Pier 4');

        // 2. Verify timeline segments and recent logs structure
        expect($clocks['timeline_segments'])->toHaveCount(2); // 1 Driving + 1 Operating
        expect($clocks['recent_logs'])->toHaveCount(2);
    });

    it('verifies HoS clock calculation: hours_elapsed is 4.5 and shift_window_remaining_minutes is 570 for active shift', function (): void {
        $this->seed(OperationalTestSeeder::class);

        /** @var User $operator */
        $operator = User::query()->where('email', 'operator@example.com')->firstOrFail();
        $token = $operator->createToken('Mobile Token')->plainTextToken;

        $response = $this->withToken($token)->getJson('/api/v1/hos/current-shift');
        $response->assertOk();

        $clocks = $response->json('data.clocks');

        // Shift started 4.5 hours ago.
        // Expected: hours_elapsed = 4.5, shift_window_remaining_minutes = 570, operating log duration = 240
        expect((float) $clocks['hours_elapsed'])->toBe(4.5);
        expect($clocks['shift_window_remaining_minutes'])->toBe(570);
        expect($clocks['timeline_segments'][1]['duration_minutes'])->toBe(240);
        expect($clocks['fatigue_status'])->toBe('normal');
        expect($clocks['dole_warning'])->toBeFalse();
    });

    it('verifies mathematical fix: absolute diffInMinutes produces accurate 4.5 hours elapsed and 570 minutes remaining', function (): void {
        $this->seed(OperationalTestSeeder::class);

        /** @var OperatorShift $shift */
        $shift = OperatorShift::query()->where('status', ShiftStatus::ACTIVE)->firstOrFail();
        $now = Carbon::now();

        // Demonstrating root cause:
        // Carbon signed diff:
        $signedDiff = $now->diffInMinutes($shift->started_at);
        expect($signedDiff)->toBeLessThan(0); // -270

        // Carbon absolute diff:
        $absoluteDiff = (int) $now->diffInMinutes($shift->started_at, true);
        expect($absoluteDiff)->toBe(270);

        // Or inverse diff:
        $inverseDiff = (int) $shift->started_at->diffInMinutes($now);
        expect($inverseDiff)->toBe(270);

        // Correct calculations with absolute diff:
        $hoursElapsed = round($absoluteDiff / 60, 2);
        $windowRemaining = max(0, 840 - $absoluteDiff);

        expect($hoursElapsed)->toBe(4.5);
        expect($windowRemaining)->toBe(570);

    });

    it('demonstrates that time travel dynamically advances hours_elapsed and decrements shift window', function (): void {
        $this->seed(OperationalTestSeeder::class);

        /** @var User $operator */
        $operator = User::query()->where('email', 'operator@example.com')->firstOrFail();
        $token = $operator->createToken('Mobile Token')->plainTextToken;

        // Baseline request (4.5 hours elapsed, 570 window remaining)
        $response1 = $this->withToken($token)->getJson('/api/v1/hos/current-shift');
        $response1->assertOk();
        $initialElapsed = (float) $response1->json('data.clocks.hours_elapsed');
        $initialWindowRemaining = (int) $response1->json('data.clocks.shift_window_remaining_minutes');

        expect($initialElapsed)->toBe(4.5);
        expect($initialWindowRemaining)->toBe(570);

        // Fast-forward 2 hours (now 6.5 hours elapsed, 450 window remaining)
        $this->travel(2)->hours();

        $response2 = $this->withToken($token)->getJson('/api/v1/hos/current-shift');
        $response2->assertOk();
        $advancedElapsed = (float) $response2->json('data.clocks.hours_elapsed');
        $advancedWindowRemaining = (int) $response2->json('data.clocks.shift_window_remaining_minutes');

        expect($advancedElapsed)->toBe(6.5);
        expect($advancedWindowRemaining)->toBe(450);

        $this->travelBack();
    });
});
