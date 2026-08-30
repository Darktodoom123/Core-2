<?php

use App\Modules\Assignment\Services\DispatchResourceEligibility;
use App\Modules\Dispatch\Actions\RecordTowerCraneShiftLog;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Models\TowerCraneShiftLog;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\PersonnelCredential;
use App\Platform\Identity\Models\PersonnelProfile;
use App\Platform\Identity\Models\User;
use App\Platform\Safety\Actions\CreateCriticalLiftPlan;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('correctly assesses rigger eligibility with rigger certification credential', function (): void {
    $rigger = User::factory()->create(['name' => 'Certified Rigger Alex', 'is_active' => true]);
    $rigger->syncRoles([RoleName::Rigger->value]);

    PersonnelProfile::query()->create([
        'user_id' => $rigger->id,
        'availability_status' => 'available',
    ]);

    PersonnelCredential::query()->create([
        'user_id' => $rigger->id,
        'kind' => 'rigger_certification',
        'credential_number' => 'RIG-2026-001',
        'credential_type' => 'TESDA NC-II Rigger',
        'status' => 'active',
        'issued_at' => now()->subMonth(),
        'expires_at' => now()->addYear(),
    ]);

    $dispatcher = User::factory()->create();
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    $job = DispatchJob::query()->create([
        'reference' => 'DSP-RIGGER-01',
        'client' => 'Highrise Builders',
        'title' => 'Tandem Steel Girder Lift',
        'site' => 'BGC Taguig',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Scheduled,
        'scheduled_start' => now()->addDay(),
        'scheduled_end' => now()->addDay()->addHours(4),
        'created_by' => $dispatcher->id,
    ]);

    $eligibility = app(DispatchResourceEligibility::class);
    $assessment = $eligibility->personnel($rigger, 'rigger', $job);

    expect($assessment['eligible'])->toBeTrue()
        ->and($assessment['credential']['kind'])->toBe('rigger_certification')
        ->and($assessment['credential']['status'])->toBe('valid');
});

it('allows assigning a certified rigger to a dispatch job', function (): void {
    $dispatcher = User::factory()->create(['name' => 'Lead Dispatcher']);
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    $rigger = User::factory()->create(['name' => 'Signalman Bob', 'is_active' => true]);
    $rigger->syncRoles([RoleName::Rigger->value]);

    PersonnelProfile::query()->create([
        'user_id' => $rigger->id,
        'availability_status' => 'available',
    ]);

    PersonnelCredential::query()->create([
        'user_id' => $rigger->id,
        'kind' => 'rigger_certification',
        'credential_number' => 'RIG-2026-002',
        'credential_type' => 'TESDA NC-II Rigger',
        'status' => 'active',
        'issued_at' => now()->subMonth(),
        'expires_at' => now()->addYear(),
    ]);

    $job = DispatchJob::query()->create([
        'reference' => 'DSP-RIGGER-02',
        'client' => 'Prime Builders',
        'title' => 'Tower Crane Jib Assembly',
        'site' => 'Makati Site',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Scheduled,
        'scheduled_start' => now()->addDay(),
        'scheduled_end' => now()->addDay()->addHours(4),
        'created_by' => $dispatcher->id,
    ]);

    $this->actingAs($dispatcher)
        ->postJson("/operations/dispatch-jobs/{$job->id}/assignments", [
            'personnel' => [
                [
                    'user_id' => $rigger->id,
                    'assignment_type' => 'rigger',
                ],
            ],
        ])
        ->assertRedirect();

    expect($job->personnelAssignments()->count())->toBe(1)
        ->and($job->personnelAssignments()->first()->assignment_type)->toBe('rigger')
        ->and($job->personnelAssignments()->first()->user_id)->toBe($rigger->id);
});

it('calculates gross load weight, deductions, and load moment ton-meters in critical lift plans', function (): void {
    $foreman = User::factory()->create(['name' => 'Foreman Carlo', 'is_active' => true]);
    $foreman->syncRoles([RoleName::FieldForeman->value]);

    $action = app(CreateCriticalLiftPlan::class);

    $plan = $action->handle($foreman, [
        'project_site' => 'Makati CBD Tower 3',
        'rigger_tesda_nc_number' => 'TESDA-NC2-RIG-1029',
        'net_load_weight_tons' => 12.0,
        'rigging_weight_tons' => 0.8,
        'hook_block_weight_tons' => 1.2,
        'crane_rated_capacity_tons' => 20.0,
        'boom_length_meters' => 45.0,
        'working_radius_meters' => 18.0,
        'ground_bearing_condition' => 'Engineered Steel Plates on Concrete',
        'weather_wind_speed_kph' => 15.0,
    ]);

    // Gross load = 12.0 (net) + 0.8 (rigging) + 1.2 (hook block) = 14.0 tons
    // Load percentage = (14.0 / 20.0) * 100 = 70.0%
    // Load moment = 14.0 tons * 18.0 m = 252.0 ton-meters
    expect($plan->gross_load_weight_tons)->toBe(14.0)
        ->and($plan->net_load_weight_tons)->toBe(12.0)
        ->and($plan->rigging_weight_tons)->toBe(0.8)
        ->and($plan->hook_block_weight_tons)->toBe(1.2)
        ->and($plan->load_percentage_of_capacity)->toBe(70.0)
        ->and($plan->load_moment_ton_meters)->toBe(252.0)
        ->and($plan->risk_level)->toBe('routine');
});

it('rejects critical lift plans exceeding DOLE statutory 95% capacity limit', function (): void {
    $foreman = User::factory()->create(['name' => 'Foreman Carlo', 'is_active' => true]);
    $foreman->syncRoles([RoleName::FieldForeman->value]);

    $action = app(CreateCriticalLiftPlan::class);

    expect(fn () => $action->handle($foreman, [
        'project_site' => 'Pasig River Bridge',
        'rigger_tesda_nc_number' => 'TESDA-NC2-RIG-9900',
        'net_load_weight_tons' => 19.5,
        'rigging_weight_tons' => 0.5,
        'hook_block_weight_tons' => 0.5,
        'crane_rated_capacity_tons' => 20.0, // Gross = 20.5T / 20T = 102.5%
        'boom_length_meters' => 30.0,
        'working_radius_meters' => 10.0,
        'ground_bearing_condition' => 'Concrete Pad',
    ]))->toThrow(ValidationException::class);
});

it('records tower crane shift logs with pre-climb inspection and free-slew verification', function (): void {
    $operator = User::factory()->create(['name' => 'Tower Crane Operator John', 'is_active' => true]);
    $operator->syncRoles([RoleName::CraneOperator->value]);

    $towerCrane = OperationalAsset::query()->create([
        'code' => 'TWR-POTAIN-01',
        'name' => 'Potain Topless Tower Crane',
        'kind' => 'equipment',
        'subtype' => 'Topless Tower Crane',
        'status' => AssetStatus::ReadyForService->value,
    ]);

    $action = app(RecordTowerCraneShiftLog::class);

    $shiftLog = $action->handle($operator, [
        'operational_asset_id' => $towerCrane->id,
        'shift_type' => 'day',
        'pre_climb_harness_inspected' => true,
        'pre_climb_ladder_cleared' => true,
        'anemometer_verified' => true,
        'operating_hours' => 7.5,
        'lift_count' => 42,
        'free_slew_engaged' => true,
        'notes' => 'Normal operations. Free-slew brake released at 17:00 shift end.',
    ]);

    expect($shiftLog->pre_climb_passed)->toBeTrue()
        ->and($shiftLog->operating_hours)->toBe(7.5)
        ->and($shiftLog->lift_count)->toBe(42)
        ->and($shiftLog->free_slew_engaged)->toBeTrue()
        ->and(TowerCraneShiftLog::query()->count())->toBe(1);
});

it('rejects recording tower crane shift logs for mobile transit assets', function (): void {
    $operator = User::factory()->create(['name' => 'Operator John', 'is_active' => true]);
    $operator->syncRoles([RoleName::CraneOperator->value]);

    $truck = OperationalAsset::query()->create([
        'code' => 'TRK-01',
        'name' => 'Prime Mover Truck',
        'kind' => 'truck',
        'status' => AssetStatus::ReadyForService->value,
    ]);

    $action = app(RecordTowerCraneShiftLog::class);

    expect(fn () => $action->handle($operator, [
        'operational_asset_id' => $truck->id,
        'shift_type' => 'day',
        'pre_climb_harness_inspected' => true,
    ]))->toThrow(ValidationException::class);
});
