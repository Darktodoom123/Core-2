<?php

use App\Modules\Assignment\Models\DispatchAssetAssignment;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Actions\ActivateDispatchJob;
use App\Modules\Dispatch\Enums\ApprovalStatus;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\ApprovalRequest;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\PersonnelCredential;
use App\Platform\Identity\Models\User;
use App\Platform\Safety\Models\CriticalLiftPlan;
use App\Platform\Safety\Models\WorkStoppageNotice;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

function createReadyDispatchJob(string $site = 'Makati Sky Tower 2'): array
{
    $manager = User::factory()->create(['name' => 'Ops Manager', 'is_active' => true]);
    $manager->syncRoles([RoleName::OperationsManager->value]);

    $foreman = User::factory()->create(['name' => 'Foreman Carlo', 'is_active' => true]);
    $foreman->syncRoles([RoleName::FieldForeman->value]);

    PersonnelCredential::query()->create([
        'user_id' => $foreman->id,
        'kind' => 'operator_certification',
        'credential_number' => 'CERT-LEAD-991',
        'credential_type' => 'Master Rigger / Crane Supervisor',
        'status' => 'active',
        'issued_at' => now()->subMonth(),
        'expires_at' => now()->addYear(),
    ]);

    $asset = OperationalAsset::query()->create([
        'code' => 'CR-SANY-501',
        'name' => '50T Crawler Crane',
        'kind' => 'crane',
        'status' => AssetStatus::Available,
    ]);

    $job = DispatchJob::query()->create([
        'reference' => 'DSP-SAFE-001',
        'client' => 'Highrise Builders PH',
        'title' => 'Structural Girder Erection',
        'site' => $site,
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Draft,
        'version' => 1,
        'created_by' => $manager->id,
    ]);

    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $foreman->id,
        'assignment_type' => 'foreman',
        'response_status' => 'accepted',
        'assigned_by' => $manager->id,
        'active_from' => now()->subMinute(),
    ]);

    DispatchAssetAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'operational_asset_id' => $asset->id,
        'assignment_type' => 'crane',
        'assigned_by' => $manager->id,
        'active_from' => now()->subMinute(),
    ]);

    ApprovalRequest::query()->create([
        'subject_type' => (new DispatchJob)->getMorphClass(),
        'subject_id' => $job->id,
        'kind' => 'dispatch_activation',
        'status' => ApprovalStatus::Approved,
        'requested_by' => $manager->id,
        'decided_by' => $manager->id,
        'decided_at' => now(),
    ]);

    return [$manager, $job, $foreman, $asset];
}

it('blocks dispatch activation when an active statutory Work Stoppage Order is in effect for the site', function (): void {
    [$manager, $job] = createReadyDispatchJob('Makati Sky Tower 2');

    $safetyOfficer = User::factory()->create(['name' => 'Engr. Morales', 'is_active' => true]);
    $safetyOfficer->syncRoles([RoleName::SafetyOfficer->value]);

    // 1. Active WSO on site
    WorkStoppageNotice::query()->create([
        'notice_number' => 'WSO-2026-001',
        'project_site' => 'Makati Sky Tower 2',
        'safety_officer_id' => $safetyOfficer->id,
        'dole_regulation_reference' => 'DOLE D.O. 13 Section 8',
        'reason' => 'Ground settlement observed near outrigger pad.',
        'affected_area' => 'Grid B-4',
        'is_active' => true,
    ]);

    $action = app(ActivateDispatchJob::class);

    // Should throw ValidationException blocking activation
    expect(fn () => $action->handle($manager, $job, 1))
        ->toThrow(ValidationException::class);

    expect($job->fresh()->status)->toBe(DispatchStatus::Draft);
});

it('allows dispatch activation once the Safety Officer lifts the Work Stoppage Order', function (): void {
    [$manager, $job] = createReadyDispatchJob('Makati Sky Tower 2');

    $safetyOfficer = User::factory()->create(['name' => 'Engr. Morales', 'is_active' => true]);
    $safetyOfficer->syncRoles([RoleName::SafetyOfficer->value]);

    $wso = WorkStoppageNotice::query()->create([
        'notice_number' => 'WSO-2026-001',
        'project_site' => 'Makati Sky Tower 2',
        'safety_officer_id' => $safetyOfficer->id,
        'dole_regulation_reference' => 'DOLE D.O. 13 Section 8',
        'reason' => 'Ground settlement observed near outrigger pad.',
        'affected_area' => 'Grid B-4',
        'is_active' => true,
    ]);

    // Lift the WSO
    $wso->update([
        'is_active' => false,
        'lifted_by' => $safetyOfficer->id,
        'lifted_at' => now(),
        'lift_reason' => 'Steel road plates installed and ground compaction certified.',
    ]);

    $action = app(ActivateDispatchJob::class);
    $activated = $action->handle($manager, $job, 1);

    expect($activated->status)->toBe(DispatchStatus::Dispatched);
});

it('blocks dispatch activation if a Critical Lift Plan is pending Safety Officer authorization', function (): void {
    [$manager, $job, $foreman, $asset] = createReadyDispatchJob('Makati Sky Tower 2');

    $liftPlan = CriticalLiftPlan::query()->create([
        'lift_reference' => 'LIFT-2026-881',
        'dispatch_job_id' => $job->id,
        'operational_asset_id' => $asset->id,
        'project_site' => 'Makati Sky Tower 2',
        'rigger_tesda_nc_number' => 'TESDA-NC2-9988',
        'risk_level' => 'critical',
        'gross_load_weight_tons' => 28.5,
        'crane_rated_capacity_tons' => 34.0,
        'load_percentage_of_capacity' => 83.82,
        'boom_length_meters' => 38.0,
        'working_radius_meters' => 14.5,
        'ground_bearing_condition' => 'Engineered Timber Pads',
        'weather_wind_speed_kph' => 14.0,
        'status' => 'pending_so_review',
        'foreman_id' => $foreman->id,
    ]);

    $action = app(ActivateDispatchJob::class);

    // 1. Pending review blocks activation
    expect(fn () => $action->handle($manager, $job, 1))
        ->toThrow(ValidationException::class);

    // 2. Safety Officer approves lift plan
    $safetyOfficer = User::factory()->create(['name' => 'Engr. Morales', 'is_active' => true]);
    $safetyOfficer->syncRoles([RoleName::SafetyOfficer->value]);

    $liftPlan->update([
        'status' => 'approved',
        'safety_officer_id' => $safetyOfficer->id,
        'safety_officer_signed_at' => now(),
    ]);

    // 3. Now activation succeeds
    $activated = $action->handle($manager, $job, 1);
    expect($activated->status)->toBe(DispatchStatus::Dispatched);
});
