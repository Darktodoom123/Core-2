<?php

use App\Modules\Dispatch\Enums\ApprovalStatus;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\ApprovalRequest;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\PersonnelCredential;
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

function createReassignmentUser(RoleName $role, string $name): User
{
    $user = User::factory()->create(['name' => $name]);
    $user->syncRoles([$role->value]);

    return $user;
}

function createReassignmentJob(
    User $creator,
    string $reference = 'DSP-REASSIGN-001',
    DispatchStatus $status = DispatchStatus::Scheduled,
    DispatchPriority $priority = DispatchPriority::Routine,
    int $version = 1,
): DispatchJob {
    return DispatchJob::query()->create([
        'reference' => $reference,
        'client' => 'Test Reassignment Client',
        'title' => 'Equipment Transfer & Lifting',
        'site' => 'Taguig City',
        'site_notes' => 'Verify ground stability before setup.',
        'scheduled_start' => now()->addDays(2)->startOfHour(),
        'scheduled_end' => now()->addDays(2)->startOfHour()->addHours(4),
        'priority' => $priority,
        'status' => $status,
        'created_by' => $creator->id,
        'version' => $version,
    ]);
}

test('authorized dispatcher can end active personnel and asset assignments preserving history', function (): void {
    $dispatcher = createReassignmentUser(RoleName::OperationsManager, 'Dispatcher Alpha');
    $dispatcher->givePermissionTo(PermissionName::AssignmentsOverride->value);
    $job = createReassignmentJob($dispatcher);

    $driver = createReassignmentUser(RoleName::Driver, 'Driver Bob');
    $asset = OperationalAsset::query()->create([
        'code' => 'TR-100',
        'name' => 'Flatbed Truck 100',
        'kind' => 'truck',
        'status' => AssetStatus::ReadyForService,
    ]);

    $pAssignment = $job->personnelAssignments()->create([
        'user_id' => $driver->id,
        'assignment_type' => 'driver',
        'assigned_by' => $dispatcher->id,
        'active_from' => $job->scheduled_start,
    ]);

    $aAssignment = $job->assetAssignments()->create([
        'operational_asset_id' => $asset->id,
        'assignment_type' => 'truck',
        'assigned_by' => $dispatcher->id,
        'active_from' => $job->scheduled_start,
    ]);

    $response = $this->actingAs($dispatcher)->post("/operations/dispatch-jobs/{$job->id}/reassign", [
        'end_personnel_assignment_ids' => [$pAssignment->id],
        'end_asset_assignment_ids' => [$aAssignment->id],
        'version' => 1,
        'reason' => 'Ending assignments due to schedule adjustment.',
    ]);

    $response->assertRedirect("/operations/dispatch-jobs/{$job->id}");
    $response->assertSessionHas('flash.tone', 'success');

    $pAssignment->refresh();
    $aAssignment->refresh();

    expect($pAssignment->active_until)->not->toBeNull()
        ->and($aAssignment->active_until)->not->toBeNull()
        ->and($job->refresh()->version)->toBe(2);

    $audit = AuditEvent::query()->where('action', 'dispatch.resources_reassigned')->latest('id')->first();
    expect($audit)->not->toBeNull()
        ->and($audit->actor_id)->toBe($dispatcher->id)
        ->and($audit->reason)->toBe('Ending assignments due to schedule adjustment.');
});

test('reassignment validates replacement resource eligibility server-side', function (): void {
    $dispatcher = createReassignmentUser(RoleName::OperationsManager, 'Dispatcher Beta');
    $job = createReassignmentJob($dispatcher);

    $oldDriver = createReassignmentUser(RoleName::Driver, 'Old Driver');
    $oldAssignment = $job->personnelAssignments()->create([
        'user_id' => $oldDriver->id,
        'assignment_type' => 'driver',
        'assigned_by' => $dispatcher->id,
        'active_from' => $job->scheduled_start,
    ]);

    // Unlicensed driver candidate
    $unlicensedDriver = createReassignmentUser(RoleName::Driver, 'Unlicensed Driver');

    $response = $this->actingAs($dispatcher)->post("/operations/dispatch-jobs/{$job->id}/reassign", [
        'end_personnel_assignment_ids' => [$oldAssignment->id],
        'personnel' => [
            ['user_id' => $unlicensedDriver->id, 'assignment_type' => 'driver'],
        ],
        'version' => 1,
    ]);

    $response->assertSessionHasErrors(['personnel']);

    $oldAssignment->refresh();
    expect($oldAssignment->active_until)->toBeNull();
    expect($job->personnelAssignments()->where('user_id', $unlicensedDriver->id)->exists())->toBeFalse();
});

test('reassignment succeeds when replacing with eligible driver and asset', function (): void {
    $dispatcher = createReassignmentUser(RoleName::OperationsManager, 'Dispatcher Gamma');
    $dispatcher->givePermissionTo(PermissionName::AssignmentsOverride->value);
    $job = createReassignmentJob($dispatcher);

    $oldDriver = createReassignmentUser(RoleName::Driver, 'Old Driver');
    $oldAssignment = $job->personnelAssignments()->create([
        'user_id' => $oldDriver->id,
        'assignment_type' => 'driver',
        'assigned_by' => $dispatcher->id,
        'active_from' => $job->scheduled_start,
    ]);

    $newDriver = createReassignmentUser(RoleName::Driver, 'New Driver');
    PersonnelCredential::query()->create([
        'user_id' => $newDriver->id,
        'kind' => 'driver_license',
        'credential_number' => 'DL-99999',
        'credential_type' => 'Professional License',
        'status' => 'active',
        'issued_at' => now()->subYear(),
        'expires_at' => now()->addYear(),
    ]);

    $newAsset = OperationalAsset::query()->create([
        'code' => 'TR-200',
        'name' => 'Truck 200',
        'kind' => 'truck',
        'status' => AssetStatus::ReadyForService,
    ]);

    $response = $this->actingAs($dispatcher)->post("/operations/dispatch-jobs/{$job->id}/reassign", [
        'end_personnel_assignment_ids' => [$oldAssignment->id],
        'personnel' => [
            ['user_id' => $newDriver->id, 'assignment_type' => 'driver'],
        ],
        'assets' => [
            ['operational_asset_id' => $newAsset->id, 'assignment_type' => 'truck'],
        ],
        'version' => 1,
    ]);

    $response->assertRedirect("/operations/dispatch-jobs/{$job->id}");

    $oldAssignment->refresh();
    expect($oldAssignment->active_until)->not->toBeNull();

    $activeDriverAssignment = $job->personnelAssignments()->where('user_id', $newDriver->id)->whereNull('active_until')->first();
    $activeAssetAssignment = $job->assetAssignments()->where('operational_asset_id', $newAsset->id)->whereNull('active_until')->first();

    expect($activeDriverAssignment)->not->toBeNull()
        ->and($activeAssetAssignment)->not->toBeNull()
        ->and($job->refresh()->version)->toBe(2);
});

test('stale job version rejects reassignment request', function (): void {
    $dispatcher = createReassignmentUser(RoleName::OperationsManager, 'Dispatcher Delta');
    $job = createReassignmentJob($dispatcher, 'DSP-REASSIGN-STALE', DispatchStatus::Scheduled, DispatchPriority::Routine, 2);

    $driver = createReassignmentUser(RoleName::Driver, 'Driver Delta');
    $assignment = $job->personnelAssignments()->create([
        'user_id' => $driver->id,
        'assignment_type' => 'driver',
        'assigned_by' => $dispatcher->id,
        'active_from' => $job->scheduled_start,
    ]);

    $response = $this->actingAs($dispatcher)->post("/operations/dispatch-jobs/{$job->id}/reassign", [
        'end_personnel_assignment_ids' => [$assignment->id],
        'version' => 1, // Stale version
    ]);

    $response->assertSessionHasErrors(['version']);

    $assignment->refresh();
    expect($assignment->active_until)->toBeNull();
});

test('post-activation reassignment creates approval request when actor lacks override permission', function (): void {
    $dispatcher = User::factory()->create(['name' => 'Dispatcher Epsilon']);
    $dispatcher->givePermissionTo([
        PermissionName::AssignmentsReassign->value,
        PermissionName::AssignmentsViewAll->value,
        PermissionName::DispatchViewAll->value,
    ]);
    $job = createReassignmentJob($dispatcher, 'DSP-REASSIGN-POST', DispatchStatus::Dispatched);

    $oldDriver = createReassignmentUser(RoleName::Driver, 'Active Driver');
    $oldAssignment = $job->personnelAssignments()->create([
        'user_id' => $oldDriver->id,
        'assignment_type' => 'driver',
        'assigned_by' => $dispatcher->id,
        'active_from' => $job->scheduled_start,
    ]);

    $newDriver = createReassignmentUser(RoleName::Driver, 'Replacement Driver');
    PersonnelCredential::query()->create([
        'user_id' => $newDriver->id,
        'kind' => 'driver_license',
        'credential_number' => 'DL-88888',
        'credential_type' => 'Professional License',
        'status' => 'active',
        'issued_at' => now()->subYear(),
        'expires_at' => now()->addYear(),
    ]);

    $response = $this->actingAs($dispatcher)->post("/operations/dispatch-jobs/{$job->id}/reassign", [
        'end_personnel_assignment_ids' => [$oldAssignment->id],
        'personnel' => [
            ['user_id' => $newDriver->id, 'assignment_type' => 'driver'],
        ],
        'version' => 1,
        'reason' => 'Driver replacement needed mid-dispatch.',
    ]);

    $response->assertRedirect("/operations/dispatch-jobs/{$job->id}");

    $oldAssignment->refresh();
    expect($oldAssignment->active_until)->toBeNull(); // Not modified immediately

    $approval = ApprovalRequest::query()
        ->where('subject_type', (new DispatchJob)->getMorphClass())
        ->where('subject_id', $job->id)
        ->where('kind', 'reassignment_override')
        ->first();

    expect($approval)->not->toBeNull()
        ->and($approval->status)->toBe(ApprovalStatus::Pending)
        ->and($approval->requested_by)->toBe($dispatcher->id);

    $audit = AuditEvent::query()->where('action', 'dispatch.reassignment_approval_requested')->first();
    expect($audit)->not->toBeNull();
});

test('approved reassignment applies atomically with requester and approver attribution', function (): void {
    $dispatcher = User::factory()->create(['name' => 'Dispatcher Approval']);
    $dispatcher->givePermissionTo([
        PermissionName::AssignmentsReassign->value,
        PermissionName::AssignmentsViewAll->value,
        PermissionName::DispatchViewAll->value,
    ]);
    $manager = createReassignmentUser(RoleName::OperationsManager, 'Manager Approval');
    $job = createReassignmentJob($dispatcher, 'DSP-REASSIGN-APPROVED', DispatchStatus::Dispatched);

    $oldDriver = createReassignmentUser(RoleName::Driver, 'Old Approved Driver');
    $oldAssignment = $job->personnelAssignments()->create([
        'user_id' => $oldDriver->id,
        'assignment_type' => 'driver',
        'assigned_by' => $dispatcher->id,
        'active_from' => $job->scheduled_start,
    ]);
    $newDriver = createReassignmentUser(RoleName::Driver, 'New Approved Driver');
    PersonnelCredential::query()->create([
        'user_id' => $newDriver->id,
        'kind' => 'driver_license',
        'credential_number' => 'DL-APPROVED',
        'credential_type' => 'Professional License',
        'status' => 'active',
        'issued_at' => now()->subYear(),
        'expires_at' => now()->addYear(),
    ]);

    $this->actingAs($dispatcher)->post("/operations/dispatch-jobs/{$job->id}/reassign", [
        'end_personnel_assignment_ids' => [$oldAssignment->id],
        'personnel' => [['user_id' => $newDriver->id, 'assignment_type' => 'driver']],
        'version' => 1,
        'reason' => 'Replacement requested for an active dispatch.',
    ])->assertSessionHas('flash.message', "The reassignment for {$job->reference} was sent for independent approval.");

    $approval = ApprovalRequest::query()->where('kind', 'reassignment_override')->sole();

    $this->actingAs($manager)
        ->get('/')
        ->assertInertia(fn (Assert $page) => $page
            ->loadDeferredProps('workspace-overview', fn (Assert $section) => $section
                ->has('approvals', 1)
                ->where('approvals.0.kind', 'reassignment_override')
                ->where('approvals.0.requested_changes.ended_personnel.0.name', $oldDriver->name)
                ->where('approvals.0.requested_changes.personnel.0.name', "User #{$newDriver->id}")
                ->where('approvals.0.can_decide', true)
            )
        );

    $this->actingAs($manager)
        ->post("/operations/approval-requests/{$approval->id}/decision", [
            'status' => ApprovalStatus::Approved->value,
            'reason' => 'Replacement verified for active work.',
        ])
        ->assertRedirect('/');

    expect($approval->refresh())
        ->status->toBe(ApprovalStatus::Approved)
        ->and($approval->decided_by)->toBe($manager->id)
        ->and($oldAssignment->refresh()->active_until)->not->toBeNull()
        ->and($job->refresh()->version)->toBe(3);

    $replacement = $job->personnelAssignments()
        ->where('user_id', $newDriver->id)
        ->whereNull('active_until')
        ->sole();

    expect($replacement->assigned_by)->toBe($dispatcher->id)
        ->and($replacement->approved_by)->toBe($manager->id)
        ->and(AuditEvent::query()->where('action', 'dispatch.resources_reassigned')->count())->toBe(1)
        ->and(AuditEvent::query()->where('action', 'approval.decided')->count())->toBe(1);
});

test('manager approval fails closed when the staged dispatch version is stale', function (): void {
    $dispatcher = User::factory()->create(['name' => 'Dispatcher Stale Approval']);
    $dispatcher->givePermissionTo([
        PermissionName::AssignmentsReassign->value,
        PermissionName::AssignmentsViewAll->value,
        PermissionName::DispatchViewAll->value,
    ]);
    $manager = createReassignmentUser(RoleName::OperationsManager, 'Manager Stale Approval');
    $job = createReassignmentJob($dispatcher, 'DSP-REASSIGN-STALE-APPROVAL', DispatchStatus::Dispatched);

    $oldDriver = createReassignmentUser(RoleName::Driver, 'Old Stale Approval Driver');
    $oldAssignment = $job->personnelAssignments()->create([
        'user_id' => $oldDriver->id,
        'assignment_type' => 'driver',
        'assigned_by' => $dispatcher->id,
        'active_from' => $job->scheduled_start,
    ]);
    $newDriver = createReassignmentUser(RoleName::Driver, 'New Stale Approval Driver');
    PersonnelCredential::query()->create([
        'user_id' => $newDriver->id,
        'kind' => 'driver_license',
        'credential_number' => 'DL-STALE-APPROVAL',
        'credential_type' => 'Professional License',
        'status' => 'active',
        'issued_at' => now()->subYear(),
        'expires_at' => now()->addYear(),
    ]);

    $this->actingAs($dispatcher)->post("/operations/dispatch-jobs/{$job->id}/reassign", [
        'end_personnel_assignment_ids' => [$oldAssignment->id],
        'personnel' => [['user_id' => $newDriver->id, 'assignment_type' => 'driver']],
        'version' => 1,
    ]);

    $approval = ApprovalRequest::query()->where('kind', 'reassignment_override')->sole();
    $job->update(['version' => 3]);

    $this->actingAs($manager)
        ->from('/')
        ->post("/operations/approval-requests/{$approval->id}/decision", [
            'status' => ApprovalStatus::Approved->value,
            'reason' => 'Attempted approval after a concurrent dispatch change.',
        ])
        ->assertRedirect('/')
        ->assertSessionHasErrors('version');

    expect($approval->refresh()->status)->toBe(ApprovalStatus::Pending)
        ->and($oldAssignment->refresh()->active_until)->toBeNull()
        ->and($job->personnelAssignments()->where('user_id', $newDriver->id)->exists())->toBeFalse()
        ->and(AuditEvent::query()->where('action', 'dispatch.resources_reassigned')->exists())->toBeFalse();
});

test('replacement assignment requires a scheduled dispatch and a version', function (): void {
    $dispatcher = createReassignmentUser(RoleName::OperationsManager, 'Dispatcher Validation');
    $job = createReassignmentJob($dispatcher, 'DSP-REASSIGN-VALIDATION');
    $job->update(['scheduled_start' => null, 'scheduled_end' => null]);

    $oldDriver = createReassignmentUser(RoleName::Driver, 'Old Validation Driver');
    $oldAssignment = $job->personnelAssignments()->create([
        'user_id' => $oldDriver->id,
        'assignment_type' => 'driver',
        'assigned_by' => $dispatcher->id,
        'active_from' => now(),
    ]);
    $newDriver = createReassignmentUser(RoleName::Driver, 'New Validation Driver');
    PersonnelCredential::query()->create([
        'user_id' => $newDriver->id,
        'kind' => 'driver_license',
        'credential_number' => 'DL-VALIDATION',
        'credential_type' => 'Professional License',
        'status' => 'active',
        'issued_at' => now()->subYear(),
        'expires_at' => now()->addYear(),
    ]);

    $this->actingAs($dispatcher)
        ->post("/operations/dispatch-jobs/{$job->id}/reassign", [
            'end_personnel_assignment_ids' => [$oldAssignment->id],
            'personnel' => [['user_id' => $newDriver->id, 'assignment_type' => 'driver']],
            'version' => 1,
        ])
        ->assertSessionHasErrors('reassignment');

    $this->actingAs($dispatcher)
        ->post("/operations/dispatch-jobs/{$job->id}/reassign", [
            'end_personnel_assignment_ids' => [$oldAssignment->id],
        ])
        ->assertSessionHasErrors('version');

    expect($oldAssignment->refresh()->active_until)->toBeNull()
        ->and($job->personnelAssignments()->where('user_id', $newDriver->id)->exists())->toBeFalse();
});

test('actor with override permission executes post-activation reassignment directly', function (): void {
    $manager = createReassignmentUser(RoleName::OperationsManager, 'Manager Zeta');
    $manager->givePermissionTo(PermissionName::AssignmentsReassign->value);
    $manager->givePermissionTo(PermissionName::AssignmentsOverride->value);

    $job = createReassignmentJob($manager, 'DSP-REASSIGN-MGR', DispatchStatus::Dispatched);

    $oldDriver = createReassignmentUser(RoleName::Driver, 'Old Active Driver');
    $oldAssignment = $job->personnelAssignments()->create([
        'user_id' => $oldDriver->id,
        'assignment_type' => 'driver',
        'assigned_by' => $manager->id,
        'active_from' => $job->scheduled_start,
    ]);

    $response = $this->actingAs($manager)->post("/operations/dispatch-jobs/{$job->id}/reassign", [
        'end_personnel_assignment_ids' => [$oldAssignment->id],
        'version' => 1,
        'reason' => 'Emergency unassign by manager.',
    ]);

    $response->assertRedirect("/operations/dispatch-jobs/{$job->id}");

    $oldAssignment->refresh();
    expect($oldAssignment->active_until)->not->toBeNull();

    expect(ApprovalRequest::query()->where('subject_id', $job->id)->exists())->toBeFalse();
});

test('unauthorized user cannot end or reassign resources', function (): void {
    $driver = createReassignmentUser(RoleName::Driver, 'Driver Unauthorized');
    $dispatcher = createReassignmentUser(RoleName::OperationsManager, 'Dispatcher Eta');
    $job = createReassignmentJob($dispatcher);

    $pAssignment = $job->personnelAssignments()->create([
        'user_id' => $driver->id,
        'assignment_type' => 'driver',
        'assigned_by' => $dispatcher->id,
        'active_from' => $job->scheduled_start,
    ]);

    $response = $this->actingAs($driver)->post("/operations/dispatch-jobs/{$job->id}/reassign", [
        'end_personnel_assignment_ids' => [$pAssignment->id],
        'version' => 1,
    ]);

    $response->assertForbidden();

    $pAssignment->refresh();
    expect($pAssignment->active_until)->toBeNull();
});

test('completed or cancelled jobs reject reassignment attempts', function (): void {
    $dispatcher = createReassignmentUser(RoleName::OperationsManager, 'Dispatcher Theta');
    $job = createReassignmentJob($dispatcher, 'DSP-COMPLETED', DispatchStatus::Completed);

    $driver = createReassignmentUser(RoleName::Driver, 'Finished Driver');
    $pAssignment = $job->personnelAssignments()->create([
        'user_id' => $driver->id,
        'assignment_type' => 'driver',
        'assigned_by' => $dispatcher->id,
        'active_from' => $job->scheduled_start,
    ]);

    $response = $this->actingAs($dispatcher)->post("/operations/dispatch-jobs/{$job->id}/reassign", [
        'end_personnel_assignment_ids' => [$pAssignment->id],
        'version' => 1,
    ]);

    $response->assertForbidden();

    $pAssignment->refresh();
    expect($pAssignment->active_until)->toBeNull();
});
