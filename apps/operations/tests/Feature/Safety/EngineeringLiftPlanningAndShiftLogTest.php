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
