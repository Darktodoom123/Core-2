<?php

use App\Modules\Dispatch\Enums\ApprovalStatus;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\ApprovalRequest;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Enums\PermissionName;
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

function exceptionalWorkflowUser(RoleName $role, string $name): User
{
    $user = User::factory()->create(['name' => $name]);
    $user->syncRoles([$role->value]);

    return $user;
}

function exceptionalWorkflowJob(
    User $creator,
    string $reference,
    DispatchPriority $priority = DispatchPriority::Routine,
    int $version = 1,
): DispatchJob {
    return DispatchJob::query()->create([
        'reference' => $reference,
        'client' => 'Core Test Client',
        'title' => 'Exceptional dispatch activation',
        'site' => 'Pasig City',
        'site_notes' => 'Review access and lifting conditions.',
        'scheduled_start' => now()->addDays(2)->startOfHour(),
        'scheduled_end' => now()->addDays(2)->startOfHour()->addHours(4),
        'priority' => $priority,
        'status' => DispatchStatus::Draft,
        'created_by' => $creator->id,
        'version' => $version,
    ]);
}

/** @return array{driver: User, asset: OperationalAsset} */
function assignExceptionalWorkflowResources(
    DispatchJob $job,
    User $dispatcher,
    string $suffix,
): array {
    $driver = exceptionalWorkflowUser(RoleName::Driver, "Driver {$suffix}");
    $driver->personnelCredentials()->create([
        'kind' => 'driver_license',
        'credential_number' => "DL-{$suffix}",
        'credential_type' => 'professional',
        'issued_at' => now()->subYear(),
        'expires_at' => now()->addYear(),
        'status' => 'active',
    ]);
    $asset = OperationalAsset::query()->create([
        'code' => "TR-{$suffix}",
        'name' => "Truck {$suffix}",
        'kind' => 'truck',
        'status' => AssetStatus::ReadyForService,
    ]);

    $job->personnelAssignments()->create([
        'user_id' => $driver->id,
        'assignment_type' => 'driver',
        'assigned_by' => $dispatcher->id,
        'active_from' => $job->scheduled_start,
    ]);
    $job->assetAssignments()->create([
        'operational_asset_id' => $asset->id,
        'assignment_type' => 'truck',
        'assigned_by' => $dispatcher->id,
        'active_from' => $job->scheduled_start,
    ]);

    return ['driver' => $driver, 'asset' => $asset];
}

function requestExceptionalWorkflowApproval(
    DispatchJob $job,
    User $requester,
    User $driver,
    OperationalAsset $asset,
): ApprovalRequest {
    return ApprovalRequest::query()->create([
        'subject_type' => (new DispatchJob)->getMorphClass(),
        'subject_id' => $job->id,
        'kind' => 'assignment_override',
        'requested_changes' => [
            'personnel' => [
                ['user_id' => $driver->id, 'assignment_type' => 'driver'],
            ],
            'assets' => [
                ['operational_asset_id' => $asset->id, 'assignment_type' => 'truck'],
            ],
        ],
        'status' => ApprovalStatus::Pending,
        'requested_by' => $requester->id,
    ]);
}

it('activates a ready routine dispatch through the browser and records the actor and version', function () {
    $dispatcher = exceptionalWorkflowUser(RoleName::Dispatcher, 'Routine Dispatcher');
    $manager = exceptionalWorkflowUser(RoleName::OperationsManager, 'Routine Manager');
    $job = exceptionalWorkflowJob($dispatcher, 'CON-6001');
    $resources = assignExceptionalWorkflowResources($job, $dispatcher, '6001');
    $approval = requestExceptionalWorkflowApproval($job, $dispatcher, $resources['driver'], $resources['asset']);

    $this->actingAs($manager)
        ->post("/operations/approval-requests/{$approval->id}/decision", [
            'status' => ApprovalStatus::Approved->value,
            'reason' => 'Routine assignment verified by operations.',
        ]);

    $this->actingAs($dispatcher)
        ->from("/operations/dispatch-jobs/{$job->id}")
        ->post("/operations/dispatch-jobs/{$job->id}/activate", ['version' => 1])
        ->assertRedirect("/operations/dispatch-jobs/{$job->id}")
        ->assertSessionHas('flash', [
            'tone' => 'success',
            'message' => 'Dispatch CON-6001 was activated.',
        ]);

    expect($job->refresh())
        ->status->toBe(DispatchStatus::Dispatched)
        ->version->toBe(2)
        ->activated_by->toBe($dispatcher->id);

    $events = AuditEvent::query()
        ->where('subject_type', (new DispatchJob)->getMorphClass())
        ->where('subject_id', $job->id)
        ->orderBy('id')
        ->get();

    expect($events->pluck('action')->all())->toBe([
        'dispatch.activation_attempted',
        'dispatch.activated',
    ])
        ->and($events->first()->actor_id)->toBe($dispatcher->id)
        ->and($events->first()->after)->toBe(['requested_version' => 1])
        ->and($events->last()->after)->toBe([
            'status' => DispatchStatus::Dispatched->value,
            'version' => 2,
        ]);
});

it('prevents activation without both active personnel and asset assignments', function () {
    $dispatcher = exceptionalWorkflowUser(RoleName::Dispatcher, 'Assignment Dispatcher');
    $driver = exceptionalWorkflowUser(RoleName::Driver, 'Only Driver');
    $driver->personnelCredentials()->create([
        'kind' => 'driver_license',
        'credential_number' => 'DL-6002',
        'credential_type' => 'professional',
        'issued_at' => now()->subYear(),
        'expires_at' => now()->addYear(),
        'status' => 'active',
    ]);
    $personnelOnly = exceptionalWorkflowJob($dispatcher, 'CON-6002');
    $personnelOnly->personnelAssignments()->create([
        'user_id' => $driver->id,
        'assignment_type' => 'driver',
        'assigned_by' => $dispatcher->id,
        'active_from' => $personnelOnly->scheduled_start,
    ]);

    $this->actingAs($dispatcher)
        ->from("/operations/dispatch-jobs/{$personnelOnly->id}")
        ->post("/operations/dispatch-jobs/{$personnelOnly->id}/activate", ['version' => 1])
        ->assertRedirect("/operations/dispatch-jobs/{$personnelOnly->id}")
        ->assertSessionHasErrors('assets');

    $assetOnly = exceptionalWorkflowJob($dispatcher, 'CON-6003');
    $asset = OperationalAsset::query()->create([
        'code' => 'TR-6003',
        'name' => 'Only Truck',
        'kind' => 'truck',
        'status' => AssetStatus::Available,
    ]);
    $assetOnly->assetAssignments()->create([
        'operational_asset_id' => $asset->id,
        'assignment_type' => 'truck',
        'assigned_by' => $dispatcher->id,
        'active_from' => $assetOnly->scheduled_start,
    ]);

    $this->actingAs($dispatcher)
        ->from("/operations/dispatch-jobs/{$assetOnly->id}")
        ->post("/operations/dispatch-jobs/{$assetOnly->id}/activate", ['version' => 1])
        ->assertRedirect("/operations/dispatch-jobs/{$assetOnly->id}")
        ->assertSessionHasErrors('personnel');

    expect($personnelOnly->refresh()->status)->toBe(DispatchStatus::Draft)
        ->and($assetOnly->refresh()->status)->toBe(DispatchStatus::Draft)
        ->and(AuditEvent::query()->where('action', 'dispatch.activation_attempted')->count())->toBe(2)
        ->and(AuditEvent::query()->where('action', 'dispatch.activated')->count())->toBe(0);
});

it('requires an independent manager approval for exceptional dispatch activation', function (
    string $priority,
    string $reference,
) {
    $dispatcher = exceptionalWorkflowUser(RoleName::Dispatcher, "Dispatcher {$reference}");
    $manager = exceptionalWorkflowUser(RoleName::OperationsManager, "Manager {$reference}");
    $job = exceptionalWorkflowJob($dispatcher, $reference, DispatchPriority::from($priority));
    $resources = assignExceptionalWorkflowResources($job, $dispatcher, $reference);
    $approval = requestExceptionalWorkflowApproval($job, $dispatcher, $resources['driver'], $resources['asset']);

    $this->actingAs($manager)
        ->post("/operations/approval-requests/{$approval->id}/decision", [
            'status' => ApprovalStatus::Approved->value,
            'reason' => 'Personnel, timing, and asset readiness were independently verified.',
        ])
        ->assertRedirect('/');

    expect($approval->refresh())
        ->status->toBe(ApprovalStatus::Approved)
        ->decided_by->toBe($manager->id)
        ->reason->toBe('Personnel, timing, and asset readiness were independently verified.')
        ->decided_at->not->toBeNull();

    $this->actingAs($dispatcher)
        ->from("/operations/dispatch-jobs/{$job->id}")
        ->post("/operations/dispatch-jobs/{$job->id}/activate", ['version' => 1])
        ->assertRedirect("/operations/dispatch-jobs/{$job->id}");

    expect($job->refresh()->status)->toBe(DispatchStatus::Dispatched);
})->with([
    'routine' => [DispatchPriority::Routine->value, 'CON-6100'],
    'priority' => [DispatchPriority::Priority->value, 'CON-6101'],
    'emergency' => [DispatchPriority::Emergency->value, 'CON-6102'],
]);

it('blocks activation of unapproved routine dispatches and requires operations approval', function () {
    $dispatcher = exceptionalWorkflowUser(RoleName::Dispatcher, 'Unapproved Dispatcher');
    $job = exceptionalWorkflowJob($dispatcher, 'CON-6150', DispatchPriority::Routine);
    assignExceptionalWorkflowResources($job, $dispatcher, '6150');

    $this->actingAs($dispatcher)
        ->from("/operations/dispatch-jobs/{$job->id}")
        ->post("/operations/dispatch-jobs/{$job->id}/activate", ['version' => 1])
        ->assertRedirect("/operations/dispatch-jobs/{$job->id}")
        ->assertSessionHasErrors([
            'approval' => 'Operations Manager approval is required before activation.',
        ]);

    expect($job->refresh()->status)->toBe(DispatchStatus::Draft);
});

it('keeps rejected exceptional work inactive and preserves the rejection reason', function () {
    $dispatcher = exceptionalWorkflowUser(RoleName::Dispatcher, 'Rejected Dispatcher');
    $manager = exceptionalWorkflowUser(RoleName::OperationsManager, 'Rejecting Manager');
    $job = exceptionalWorkflowJob($dispatcher, 'CON-6201', DispatchPriority::Emergency);
    $resources = assignExceptionalWorkflowResources($job, $dispatcher, '6201');
    $approval = requestExceptionalWorkflowApproval($job, $dispatcher, $resources['driver'], $resources['asset']);

    $this->actingAs($manager)
        ->post("/operations/approval-requests/{$approval->id}/decision", [
            'status' => ApprovalStatus::Rejected->value,
            'reason' => 'The emergency lift plan does not provide a safe exclusion zone.',
        ])
        ->assertRedirect('/');

    $this->actingAs($dispatcher)
        ->from("/operations/dispatch-jobs/{$job->id}")
        ->post("/operations/dispatch-jobs/{$job->id}/activate", ['version' => 1])
        ->assertRedirect("/operations/dispatch-jobs/{$job->id}")
        ->assertSessionHasErrors('approval');

    expect($approval->refresh())
        ->status->toBe(ApprovalStatus::Rejected)
        ->reason->toBe('The emergency lift plan does not provide a safe exclusion zone.')
        ->and($job->refresh()->status)->toBe(DispatchStatus::Draft)
        ->and(AuditEvent::query()->where('action', 'approval.decided')->sole()->reason)
        ->toBe('The emergency lift plan does not provide a safe exclusion zone.')
        ->and(AuditEvent::query()->where('action', 'dispatch.activation_attempted')->count())->toBe(1)
        ->and(AuditEvent::query()->where('action', 'dispatch.activated')->count())->toBe(0);
});

it('requires a reason for approval and rejection decisions', function (string $status) {
    $dispatcher = exceptionalWorkflowUser(RoleName::Dispatcher, "Reason Dispatcher {$status}");
    $manager = exceptionalWorkflowUser(RoleName::OperationsManager, "Reason Manager {$status}");
    $job = exceptionalWorkflowJob($dispatcher, "CON-63{$status}", DispatchPriority::Priority);
    $resources = assignExceptionalWorkflowResources($job, $dispatcher, "63{$status}");
    $approval = requestExceptionalWorkflowApproval($job, $dispatcher, $resources['driver'], $resources['asset']);

    $this->actingAs($manager)
        ->from('/')
        ->post("/operations/approval-requests/{$approval->id}/decision", [
            'status' => $status,
            'reason' => '   ',
        ])
        ->assertRedirect('/')
        ->assertSessionHasErrors('reason');

    expect($approval->refresh()->status)->toBe(ApprovalStatus::Pending)
        ->and(AuditEvent::query()->where('action', 'approval.decided')->count())->toBe(0);
})->with([
    ApprovalStatus::Approved->value,
    ApprovalStatus::Rejected->value,
]);

it('allows a privileged requester to decide their own exceptional work', function () {
    $administrator = exceptionalWorkflowUser(RoleName::SystemAdministrator, 'Requesting Administrator');
    $job = exceptionalWorkflowJob($administrator, 'CON-6401', DispatchPriority::Priority);
    $resources = assignExceptionalWorkflowResources($job, $administrator, '6401');
    $approval = requestExceptionalWorkflowApproval($job, $administrator, $resources['driver'], $resources['asset']);

    $this->actingAs($administrator)
        ->post("/operations/approval-requests/{$approval->id}/decision", [
            'status' => ApprovalStatus::Approved->value,
            'reason' => 'Authorized self approval by administrator.',
        ])
        ->assertRedirect('/')
        ->assertSessionHas('flash', [
            'tone' => 'success',
            'message' => 'Approval request was approved.',
        ]);

    expect($approval->refresh())
        ->status->toBe(ApprovalStatus::Approved)
        ->decided_by->toBe($administrator->id)
        ->and(AuditEvent::query()->where('action', 'approval.decided')->count())->toBe(1);
});

it('forbids unauthorized decision and activation access while auditing the activation attempt', function () {
    $dispatcher = exceptionalWorkflowUser(RoleName::Dispatcher, 'Authorized Dispatcher');
    $driver = exceptionalWorkflowUser(RoleName::Driver, 'Unauthorized Driver');
    $job = exceptionalWorkflowJob($dispatcher, 'CON-6501', DispatchPriority::Priority);
    $resources = assignExceptionalWorkflowResources($job, $dispatcher, '6501');
    $approval = requestExceptionalWorkflowApproval($job, $dispatcher, $resources['driver'], $resources['asset']);

    $this->actingAs($driver)
        ->post("/operations/approval-requests/{$approval->id}/decision", [
            'status' => ApprovalStatus::Approved->value,
            'reason' => 'I should not be able to decide this.',
        ])
        ->assertForbidden();

    $this->actingAs($driver)
        ->post("/operations/dispatch-jobs/{$job->id}/activate", ['version' => 1])
        ->assertForbidden();

    expect($approval->refresh()->status)->toBe(ApprovalStatus::Pending)
        ->and($job->refresh()->status)->toBe(DispatchStatus::Draft);

    $attempt = AuditEvent::query()->where('action', 'dispatch.activation_attempted')->sole();
    expect($attempt->actor_id)->toBe($driver->id)
        ->and($attempt->after)->toBe(['requested_version' => 1]);
});

it('allows an operations manager to approve their own requested approval', function () {
    $manager = exceptionalWorkflowUser(RoleName::OperationsManager, 'Requester Manager');
    $job = exceptionalWorkflowJob($manager, 'CON-6503', DispatchPriority::Priority);
    $resources = assignExceptionalWorkflowResources($job, $manager, '6503');
    $approval = requestExceptionalWorkflowApproval($job, $manager, $resources['driver'], $resources['asset']);

    // Requester manager can decide their own approval
    $this->actingAs($manager)
        ->post("/operations/approval-requests/{$approval->id}/decision", [
            'status' => ApprovalStatus::Approved->value,
            'reason' => 'Self-approving my own request as authorized manager.',
        ])
        ->assertRedirect('/')
        ->assertSessionHas('flash', [
            'tone' => 'success',
            'message' => 'Approval request was approved.',
        ]);

    expect($approval->refresh()->status)->toBe(ApprovalStatus::Approved)
        ->and($approval->decided_by)->toBe($manager->id);
});

it('allows a system administrator to approve their own requested approval', function () {
    $admin = exceptionalWorkflowUser(RoleName::SystemAdministrator, 'Requester Admin');
    $job = exceptionalWorkflowJob($admin, 'CON-6503-A', DispatchPriority::Priority);
    $resources = assignExceptionalWorkflowResources($job, $admin, '6503A');
    $approval = requestExceptionalWorkflowApproval($job, $admin, $resources['driver'], $resources['asset']);

    // Requester admin can decide their own approval
    $this->actingAs($admin)
        ->post("/operations/approval-requests/{$approval->id}/decision", [
            'status' => ApprovalStatus::Approved->value,
            'reason' => 'Self-approving my own request as administrator.',
        ])
        ->assertRedirect('/')
        ->assertSessionHas('flash', [
            'tone' => 'success',
            'message' => 'Approval request was approved.',
        ]);

    expect($approval->refresh()->status)->toBe(ApprovalStatus::Approved)
        ->and($approval->decided_by)->toBe($admin->id);
});

it('allows an operations manager to approve and activate a priority dispatch atomically', function () {
    $dispatcher = exceptionalWorkflowUser(RoleName::Dispatcher, 'Atomic Dispatcher');
    $manager = exceptionalWorkflowUser(RoleName::OperationsManager, 'Atomic Manager');
    $job = exceptionalWorkflowJob($dispatcher, 'CON-6504', DispatchPriority::Priority);
    $resources = assignExceptionalWorkflowResources($job, $dispatcher, '6504');
    $approval = requestExceptionalWorkflowApproval($job, $dispatcher, $resources['driver'], $resources['asset']);

    $this->actingAs($manager)
        ->post("/operations/approval-requests/{$approval->id}/decision", [
            'status' => ApprovalStatus::Approved->value,
            'reason' => 'Approved and activated atomically.',
            'activate_after_approval' => true,
        ])
        ->assertRedirect('/')
        ->assertSessionHas('flash', [
            'tone' => 'success',
            'message' => 'Approval request was approved and dispatch was activated.',
        ]);

    expect($approval->refresh()->status)->toBe(ApprovalStatus::Approved)
        ->and($job->refresh()->status)->toBe(DispatchStatus::Dispatched)
        ->and($job->version)->toBe(2)
        ->and($job->activated_by)->toBe($manager->id);

    $activationEvent = AuditEvent::query()
        ->where('subject_type', (new DispatchJob)->getMorphClass())
        ->where('subject_id', $job->id)
        ->where('action', 'dispatch.activated')
        ->sole();

    expect($activationEvent->actor_id)->toBe($manager->id);
});

it('requires activation capability and dispatch visibility for activation', function () {
    $dispatcher = exceptionalWorkflowUser(RoleName::Dispatcher, 'Visibility Dispatcher');
    $activator = User::factory()->create(['name' => 'Unscoped Activator']);
    $activator->givePermissionTo(PermissionName::DispatchActivate->value);
    $job = exceptionalWorkflowJob($dispatcher, 'CON-6502');
    assignExceptionalWorkflowResources($job, $dispatcher, '6502');

    $this->actingAs($activator)
        ->post("/operations/dispatch-jobs/{$job->id}/activate", ['version' => 1])
        ->assertForbidden();

    expect($job->refresh()->status)->toBe(DispatchStatus::Draft);
});

it('rejects a stale activation version with a refresh and review error and audits the attempt', function () {
    $dispatcher = exceptionalWorkflowUser(RoleName::Dispatcher, 'Stale Dispatcher');
    $job = exceptionalWorkflowJob($dispatcher, 'CON-6601', DispatchPriority::Routine, version: 2);
    assignExceptionalWorkflowResources($job, $dispatcher, '6601');

    $this->actingAs($dispatcher)
        ->from("/operations/dispatch-jobs/{$job->id}")
        ->post("/operations/dispatch-jobs/{$job->id}/activate", ['version' => 1])
        ->assertRedirect("/operations/dispatch-jobs/{$job->id}")
        ->assertSessionHasErrors([
            'version' => 'This dispatch changed on another device. Refresh and review it again.',
        ]);

    expect($job->refresh())
        ->status->toBe(DispatchStatus::Draft)
        ->version->toBe(2)
        ->and(AuditEvent::query()->where('action', 'dispatch.activation_attempted')->count())->toBe(1)
        ->and(AuditEvent::query()->where('action', 'dispatch.activated')->count())->toBe(0);
});

it('revalidates changed asset safety at activation time and audits the blocked attempt', function () {
    $dispatcher = exceptionalWorkflowUser(RoleName::Dispatcher, 'Safety Dispatcher');
    $technician = exceptionalWorkflowUser(RoleName::OperationsManager, 'Safety Technician');
    $manager = exceptionalWorkflowUser(RoleName::OperationsManager, 'Safety Manager');
    $statusJob = exceptionalWorkflowJob($dispatcher, 'CON-6701');
    $statusResources = assignExceptionalWorkflowResources($statusJob, $dispatcher, '6701');
    $approval1 = requestExceptionalWorkflowApproval($statusJob, $dispatcher, $statusResources['driver'], $statusResources['asset']);
    $this->actingAs($manager)->post("/operations/approval-requests/{$approval1->id}/decision", [
        'status' => ApprovalStatus::Approved->value,
        'reason' => 'Initial safety approval.',
    ]);
    $statusResources['asset']->update(['status' => AssetStatus::UnderMaintenance]);

    $this->actingAs($dispatcher)
        ->from("/operations/dispatch-jobs/{$statusJob->id}")
        ->post("/operations/dispatch-jobs/{$statusJob->id}/activate", ['version' => 1])
        ->assertRedirect("/operations/dispatch-jobs/{$statusJob->id}")
        ->assertSessionHasErrors('assets');

    expect(session('errors')->first('assets'))->toContain('TR-6701')
        ->and($statusJob->refresh()->status)->toBe(DispatchStatus::Draft);

    $maintenanceJob = exceptionalWorkflowJob($dispatcher, 'CON-6702');
    $maintenanceResources = assignExceptionalWorkflowResources($maintenanceJob, $dispatcher, '6702');
    $approval2 = requestExceptionalWorkflowApproval($maintenanceJob, $dispatcher, $maintenanceResources['driver'], $maintenanceResources['asset']);
    $this->actingAs($manager)->post("/operations/approval-requests/{$approval2->id}/decision", [
        'status' => ApprovalStatus::Approved->value,
        'reason' => 'Initial safety approval.',
    ]);
    $maintenanceResources['asset']->maintenanceWorkOrders()->create([
        'technician_id' => $technician->id,
        'status' => AssetStatus::UnderMaintenance->value,
        'defect' => 'Hydraulic leak discovered after assignment.',
        'dispatch_blocking' => true,
    ]);

    $this->actingAs($dispatcher)
        ->from("/operations/dispatch-jobs/{$maintenanceJob->id}")
        ->post("/operations/dispatch-jobs/{$maintenanceJob->id}/activate", ['version' => 1])
        ->assertRedirect("/operations/dispatch-jobs/{$maintenanceJob->id}")
        ->assertSessionHasErrors('assets');

    expect(session('errors')->first('assets'))->toContain('TR-6702')
        ->and($maintenanceJob->refresh()->status)->toBe(DispatchStatus::Draft)
        ->and(AuditEvent::query()->where('action', 'dispatch.activation_attempted')->count())->toBe(2)
        ->and(AuditEvent::query()->where('action', 'dispatch.activated')->count())->toBe(0);
});

it('revalidates assigned personnel eligibility at activation time', function () {
    $dispatcher = exceptionalWorkflowUser(RoleName::Dispatcher, 'Personnel Safety Dispatcher');
    $job = exceptionalWorkflowJob($dispatcher, 'CON-6703');
    $resources = assignExceptionalWorkflowResources($job, $dispatcher, '6703');
    $resources['driver']->update(['is_active' => false]);

    $this->actingAs($dispatcher)
        ->get("/operations/dispatch-jobs/{$job->id}")
        ->assertInertia(fn (Assert $page) => $page
            ->where('activation.ready', false)
            ->where('activation.blockers.0', 'Driver 6703 is no longer eligible: Account is Inactive.'));

    $this->actingAs($dispatcher)
        ->from("/operations/dispatch-jobs/{$job->id}")
        ->post("/operations/dispatch-jobs/{$job->id}/activate", ['version' => 1])
        ->assertRedirect("/operations/dispatch-jobs/{$job->id}")
        ->assertSessionHasErrors('personnel');

    expect(session('errors')->first('personnel'))->toContain('Inactive')
        ->and($job->refresh()->status)->toBe(DispatchStatus::Draft)
        ->and(AuditEvent::query()->where('action', 'dispatch.activation_attempted')->count())->toBe(1)
        ->and(AuditEvent::query()->where('action', 'dispatch.activated')->count())->toBe(0);
});

it('provides managers enough context to independently review each pending request', function () {
    $dispatcher = exceptionalWorkflowUser(RoleName::Dispatcher, 'Context Dispatcher');
    $manager = exceptionalWorkflowUser(RoleName::OperationsManager, 'Context Manager');
    $job = exceptionalWorkflowJob($dispatcher, 'CON-6801', DispatchPriority::Emergency);
    $resources = assignExceptionalWorkflowResources($job, $dispatcher, '6801');
    requestExceptionalWorkflowApproval($job, $dispatcher, $resources['driver'], $resources['asset']);

    $this->actingAs($manager)
        ->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('workspace')
            ->loadDeferredProps('workspace-overview', fn (Assert $section) => $section
                ->has('approvals', 1)
                ->where('approvals.0.requester.name', 'Context Dispatcher')
                ->where('approvals.0.subject.reference', 'CON-6801')
                ->where('approvals.0.subject.title', 'Exceptional dispatch activation')
                ->where('approvals.0.subject.site', 'Pasig City')
                ->where('approvals.0.subject.priority.value', DispatchPriority::Emergency->value)
                ->where('approvals.0.subject.status.value', DispatchStatus::Draft->value)
                ->where('approvals.0.subject.version', 1)
                ->where('approvals.0.requested_changes.personnel.0.name', 'Driver 6801')
                ->where('approvals.0.requested_changes.personnel.0.assignment_type', 'driver')
                ->where('approvals.0.requested_changes.assets.0.code', 'TR-6801')
                ->where('approvals.0.requested_changes.assets.0.assignment_type', 'truck')
                ->where('approvals.0.can_decide', true)
                ->where('approvals.0.decision_blocker', null)
            )
        );
});

it('marks self-requested approvals as decidable for administrators in the live UI contract', function () {
    $administrator = exceptionalWorkflowUser(RoleName::SystemAdministrator, 'UI Requester');
    $job = exceptionalWorkflowJob($administrator, 'CON-6802', DispatchPriority::Priority);
    $resources = assignExceptionalWorkflowResources($job, $administrator, '6802');
    requestExceptionalWorkflowApproval($job, $administrator, $resources['driver'], $resources['asset']);

    $this->actingAs($administrator)
        ->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->loadDeferredProps('workspace-overview', fn (Assert $section) => $section
                ->has('approvals', 1)
                ->where('approvals.0.can_decide', true)
                ->where('approvals.0.decision_blocker', null)
            )
        );
});

it('limits the pending approval feed to kinds the reviewer is authorized to decide', function () {
    $dispatcher = exceptionalWorkflowUser(RoleName::Dispatcher, 'Scoped Dispatcher');
    $reviewer = User::factory()->create(['name' => 'Assignment Reviewer']);
    $reviewer->givePermissionTo([
        PermissionName::AssignmentsApprove->value,
        PermissionName::DispatchViewAll->value,
    ]);
    $job = exceptionalWorkflowJob($dispatcher, 'CON-6803', DispatchPriority::Priority);
    $resources = assignExceptionalWorkflowResources($job, $dispatcher, '6803');
    requestExceptionalWorkflowApproval($job, $dispatcher, $resources['driver'], $resources['asset']);
    ApprovalRequest::query()->create([
        'subject_type' => (new DispatchJob)->getMorphClass(),
        'subject_id' => $job->id,
        'kind' => 'dispatch_activation',
        'status' => ApprovalStatus::Pending,
        'requested_by' => $dispatcher->id,
    ]);

    $this->actingAs($reviewer)
        ->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->loadDeferredProps('workspace-overview', fn (Assert $section) => $section
                ->has('approvals', 1)
                ->where('approvals.0.kind', 'assignment_override')
            )
        );
});

it('does not expose pending approvals for dispatches outside the reviewer visibility scope', function () {
    $dispatcher = exceptionalWorkflowUser(RoleName::Dispatcher, 'Scoped Approval Requester');
    $reviewer = User::factory()->create(['name' => 'Assignment Reviewer Without Dispatch Visibility']);
    $reviewer->givePermissionTo(PermissionName::AssignmentsApprove->value);
    $job = exceptionalWorkflowJob($dispatcher, 'CON-6804', DispatchPriority::Priority);
    $resources = assignExceptionalWorkflowResources($job, $dispatcher, '6804');
    requestExceptionalWorkflowApproval($job, $dispatcher, $resources['driver'], $resources['asset']);

    $this->actingAs($reviewer)
        ->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->loadDeferredProps('workspace-overview', fn (Assert $section) => $section->has('approvals', 0)));
});

it('exposes dispatcher activation readiness without treating UI visibility as authorization', function () {
    $dispatcher = exceptionalWorkflowUser(RoleName::Dispatcher, 'Readiness Dispatcher');
    $manager = exceptionalWorkflowUser(RoleName::OperationsManager, 'Readiness Manager');
    $job = exceptionalWorkflowJob($dispatcher, 'CON-6901');
    $resources = assignExceptionalWorkflowResources($job, $dispatcher, '6901');

    // Before approval
    $this->actingAs($dispatcher)
        ->get("/operations/dispatch-jobs/{$job->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('dispatch-detail')
            ->where('capabilities.activate', true)
            ->where('activation.ready', false)
            ->where('activation.approval_required', true)
            ->where('activation.approval_status', null)
            ->where('activation.blockers.0', 'Independent Operations Manager approval is still required.')
        );

    // After approval
    $approval = requestExceptionalWorkflowApproval($job, $dispatcher, $resources['driver'], $resources['asset']);
    $this->actingAs($manager)->post("/operations/approval-requests/{$approval->id}/decision", [
        'status' => ApprovalStatus::Approved->value,
        'reason' => 'Readiness verified.',
    ]);

    $this->actingAs($dispatcher)
        ->get("/operations/dispatch-jobs/{$job->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('dispatch-detail')
            ->where('capabilities.activate', true)
            ->where('activation.ready', true)
            ->where('activation.approval_required', true)
            ->where('activation.approval_status', ApprovalStatus::Approved->value)
            ->has('activation.blockers', 0)
        );
});
