<?php

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

function assignmentWorkspaceUser(RoleName $role, string $name): User
{
    $user = User::factory()->create(['name' => $name]);
    $user->syncRoles([$role->value]);

    return $user;
}

function assignmentWorkspaceJob(User $dispatcher, string $reference): DispatchJob
{
    return DispatchJob::query()->create([
        'reference' => $reference,
        'client' => 'Arcwell',
        'title' => 'Live assignment workspace',
        'site' => 'Quezon City',
        'scheduled_start' => now()->addDays(3)->startOfHour(),
        'scheduled_end' => now()->addDays(3)->startOfHour()->addHours(3),
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Draft,
        'created_by' => $dispatcher->id,
    ]);
}

it('shows server-authoritative personnel eligibility, credentials, asset readiness, maintenance, and schedule conflicts', function () {
    $dispatcher = assignmentWorkspaceUser(RoleName::Dispatcher, 'Dispatcher');
    $driver = assignmentWorkspaceUser(RoleName::Driver, 'Available Driver');
    $driver->personnelProfile()->create(['availability_status' => 'available']);
    $driver->personnelCredentials()->create([
        'kind' => 'driver_license',
        'credential_number' => 'DL-WORKSPACE',
        'credential_type' => 'professional',
        'issued_at' => now()->subYear(),
        'expires_at' => now()->addYear(),
        'status' => 'active',
    ]);
    $operator = assignmentWorkspaceUser(RoleName::CraneOperator, 'Expired Operator');
    $operator->personnelCredentials()->create([
        'kind' => 'operator_certification',
        'credential_number' => 'OP-EXPIRED',
        'credential_type' => 'mobile_crane',
        'issued_at' => now()->subYears(2),
        'expires_at' => now()->subDay(),
        'status' => 'active',
    ]);
    $technician = assignmentWorkspaceUser(RoleName::FieldTechnician, 'Unavailable Technician');
    $technician->personnelProfile()->create(['availability_status' => 'unavailable']);

    $job = assignmentWorkspaceJob($dispatcher, 'CON-5101');
    $conflictingJob = assignmentWorkspaceJob($dispatcher, 'CON-5100');
    $readyTruck = OperationalAsset::query()->create(['code' => 'TR-5101', 'name' => 'Ready Truck', 'kind' => 'truck', 'status' => AssetStatus::ReadyForService]);
    $blockedCrane = OperationalAsset::query()->create(['code' => 'CR-5101', 'name' => 'Blocked Crane', 'kind' => 'crane', 'status' => AssetStatus::Available]);
    $blockedCrane->maintenanceWorkOrders()->create([
        'technician_id' => $technician->id,
        'status' => 'open',
        'defect' => 'Hydraulic leak',
        'dispatch_blocking' => true,
    ]);
    $conflictingEquipment = OperationalAsset::query()->create(['code' => 'EQ-5101', 'name' => 'Busy Equipment', 'kind' => 'equipment', 'status' => AssetStatus::Available]);
    $conflictingJob->assetAssignments()->create([
        'operational_asset_id' => $conflictingEquipment->id,
        'assignment_type' => 'equipment',
        'assigned_by' => $dispatcher->id,
        'active_from' => $conflictingJob->scheduled_start,
    ]);

    $this->actingAs($dispatcher)
        ->get("/operations/dispatch-jobs/{$job->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('dispatch-detail')
            ->where('job.reference', 'CON-5101')
            ->where('capabilities.assign_resources', true)
            ->where('capabilities.view_assignment_candidates', true)
            ->missing('personnel_candidates')
            ->missing('asset_candidates')
            ->loadDeferredProps('dispatch-candidates', fn (Assert $deferred) => $deferred
                ->has('personnel_candidates.data', 3)
                ->where('personnel_candidates.data.0.name', 'Available Driver')
                ->where('personnel_candidates.data.0.assignment_type', 'driver')
                ->where('personnel_candidates.data.0.availability.label', 'Available')
                ->where('personnel_candidates.data.0.credential.status', 'valid')
                ->where('personnel_candidates.data.0.eligible', true)
                ->where('personnel_candidates.data.1.name', 'Expired Operator')
                ->where('personnel_candidates.data.1.credential.status', 'expired')
                ->where('personnel_candidates.data.1.eligible', false)
                ->where('personnel_candidates.data.2.name', 'Unavailable Technician')
                ->where('personnel_candidates.data.2.availability.value', 'unavailable')
                ->where('personnel_candidates.data.2.eligible', false)
                ->has('asset_candidates.data', 3)
                ->where('asset_candidates.data.0.code', 'TR-5101')
                ->where('asset_candidates.data.0.readiness.value', 'ready_for_service')
                ->where('asset_candidates.data.0.eligible', true)
                ->where('asset_candidates.data.1.code', 'CR-5101')
                ->where('asset_candidates.data.1.blocking_maintenance_count', 1)
                ->where('asset_candidates.data.1.eligible', false)
                ->where('asset_candidates.data.2.code', 'EQ-5101')
                ->where('asset_candidates.data.2.schedule_conflicts.0.reference', 'CON-5100')
                ->where('asset_candidates.data.2.eligible', false))
        );
});

it('does not expose the assignment candidate pool to assigned field personnel', function () {
    $dispatcher = assignmentWorkspaceUser(RoleName::Dispatcher, 'Dispatcher');
    $driver = assignmentWorkspaceUser(RoleName::Driver, 'Assigned Driver');
    $otherDriver = assignmentWorkspaceUser(RoleName::Driver, 'Other Driver');
    $job = assignmentWorkspaceJob($dispatcher, 'CON-5201');
    $job->personnelAssignments()->create([
        'user_id' => $driver->id,
        'assignment_type' => 'driver',
        'assigned_by' => $dispatcher->id,
        'active_from' => $job->scheduled_start,
    ]);

    $this->actingAs($driver)
        ->get("/operations/dispatch-jobs/{$job->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('dispatch-detail')
            ->where('capabilities.assign_resources', false)
            ->where('capabilities.view_assignment_candidates', false)
            ->has('personnel_candidates', 0)
            ->has('asset_candidates', 0)
            ->where('job.personnel_assignments.0.name', 'Assigned Driver')
        );

    $this->actingAs($otherDriver)
        ->get("/operations/dispatch-jobs/{$job->id}")
        ->assertNotFound();
});
