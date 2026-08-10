<?php

use App\Modules\Assignment\Models\DispatchAssetAssignment;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
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
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);
beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

function operationsUser(RoleName $role): User
{
    $user = User::factory()->create();
    $user->syncRoles([$role->value]);

    return $user;
}

function workflowDispatchJob(
    User $creator,
    string $reference,
    DispatchPriority $priority = DispatchPriority::Routine,
): DispatchJob {
    return DispatchJob::query()->create([
        'reference' => $reference,
        'client' => 'Core Test Client',
        'title' => 'Resource assignment test',
        'site' => 'Pasig City',
        'scheduled_start' => now()->addDays(2)->startOfHour(),
        'scheduled_end' => now()->addDays(2)->startOfHour()->addHours(4),
        'priority' => $priority,
        'status' => DispatchStatus::Draft,
        'created_by' => $creator->id,
    ]);
}

function addWorkflowCredential(User $user, string $kind): void
{
    $user->personnelCredentials()->create([
        'kind' => $kind,
        'credential_number' => strtoupper($kind).'-'.$user->id,
        'credential_type' => 'professional',
        'issued_at' => now()->subYear(),
        'expires_at' => now()->addYear(),
        'status' => 'active',
    ]);
}

it('lets a dispatcher create and assign a routine dispatch while preserving assigned-only scope', function () {
    $dispatcher = operationsUser(RoleName::Dispatcher);
    $driver = operationsUser(RoleName::Driver);
    $driver->personnelCredentials()->create(['kind' => 'driver_license', 'credential_number' => 'DL-1001', 'credential_type' => 'professional', 'issued_at' => now()->subYear(), 'expires_at' => now()->addYear(), 'status' => 'active']);
    $other = operationsUser(RoleName::Driver);
    $asset = OperationalAsset::query()->create(['code' => 'TR-01', 'name' => 'Truck 01', 'kind' => 'truck', 'status' => AssetStatus::Available]);
    $this->actingAs($dispatcher)->post('/operations/dispatch-jobs', ['reference' => 'CON-1001', 'client' => 'Arcwell', 'title' => 'HVAC lift', 'site' => 'Quezon City', 'scheduled_start' => now()->addDay(), 'scheduled_end' => now()->addDay()->addHours(4), 'priority' => DispatchPriority::Routine->value, 'requirements' => []])->assertRedirect('/');
    $jobId = DispatchJob::query()->where('reference', 'CON-1001')->sole()->id;
    $this->actingAs($dispatcher)
        ->from("/operations/dispatch-jobs/{$jobId}")
        ->post("/operations/dispatch-jobs/{$jobId}/assignments", [
            'personnel' => [['user_id' => $driver->id, 'assignment_type' => 'driver']],
            'assets' => [['operational_asset_id' => $asset->id, 'assignment_type' => 'truck']],
        ])
        ->assertRedirect("/operations/dispatch-jobs/{$jobId}")
        ->assertSessionHas('flash', [
            'tone' => 'success',
            'message' => 'Resources were assigned to CON-1001.',
        ]);
    $this->actingAs($driver)->getJson("/operations/dispatch-jobs/{$jobId}")->assertOk();
    $this->actingAs($other)->getJson("/operations/dispatch-jobs/{$jobId}")->assertNotFound();
});

it('assigns every supported personnel and asset type atomically and records the audit event', function () {
    $dispatcher = operationsUser(RoleName::Dispatcher);
    $driver = operationsUser(RoleName::Driver);
    $operator = operationsUser(RoleName::CraneOperator);
    $technician = operationsUser(RoleName::FieldTechnician);
    addWorkflowCredential($driver, 'driver_license');
    addWorkflowCredential($operator, 'operator_certification');
    $job = workflowDispatchJob($dispatcher, 'CON-1101');
    $truck = OperationalAsset::query()->create(['code' => 'TR-1101', 'name' => 'Truck 1101', 'kind' => 'truck', 'status' => AssetStatus::Available]);
    $crane = OperationalAsset::query()->create(['code' => 'CR-1101', 'name' => 'Crane 1101', 'kind' => 'crane', 'status' => AssetStatus::ReadyForService]);
    $equipment = OperationalAsset::query()->create(['code' => 'EQ-1101', 'name' => 'Rigging Kit', 'kind' => 'equipment', 'status' => AssetStatus::Available]);

    $this->actingAs($dispatcher)
        ->post("/operations/dispatch-jobs/{$job->id}/assignments", [
            'personnel' => [
                ['user_id' => $driver->id, 'assignment_type' => 'driver'],
                ['user_id' => $operator->id, 'assignment_type' => 'crane_operator'],
                ['user_id' => $technician->id, 'assignment_type' => 'field_technician'],
            ],
            'assets' => [
                ['operational_asset_id' => $truck->id, 'assignment_type' => 'truck'],
                ['operational_asset_id' => $crane->id, 'assignment_type' => 'crane'],
                ['operational_asset_id' => $equipment->id, 'assignment_type' => 'equipment'],
            ],
        ])
        ->assertRedirect("/operations/dispatch-jobs/{$job->id}");

    expect($job->personnelAssignments()->pluck('assignment_type')->sort()->values()->all())
        ->toBe(['crane_operator', 'driver', 'field_technician'])
        ->and($job->assetAssignments()->pluck('assignment_type')->sort()->values()->all())
        ->toBe(['crane', 'equipment', 'truck']);

    $audit = AuditEvent::query()
        ->where('subject_type', (new DispatchJob)->getMorphClass())
        ->where('subject_id', $job->id)
        ->where('action', 'dispatch.resources_assigned')
        ->sole();

    expect($audit->actor_id)->toBe($dispatcher->id)
        ->and($audit->after['personnel'])->toHaveCount(3)
        ->and($audit->after['assets'])->toHaveCount(3);
});

it('creates an independent approval request for priority resource assignments', function () {
    $dispatcher = operationsUser(RoleName::Dispatcher);
    $driver = operationsUser(RoleName::Driver);
    addWorkflowCredential($driver, 'driver_license');
    $job = workflowDispatchJob($dispatcher, 'CON-1151', DispatchPriority::Priority);

    $this->actingAs($dispatcher)
        ->post("/operations/dispatch-jobs/{$job->id}/assignments", [
            'personnel' => [['user_id' => $driver->id, 'assignment_type' => 'driver']],
        ])
        ->assertRedirect("/operations/dispatch-jobs/{$job->id}");

    $approval = $job->approvals()->sole();
    expect($approval->kind)->toBe('assignment_override')
        ->and($approval->status)->toBe(ApprovalStatus::Pending)
        ->and($approval->requested_by)->toBe($dispatcher->id)
        ->and($approval->requested_changes['personnel'])->toBe([
            ['user_id' => $driver->id, 'assignment_type' => 'driver'],
        ]);
});

it('rolls back assignments and approval when audit persistence fails', function () {
    $dispatcher = operationsUser(RoleName::Dispatcher);
    $driver = operationsUser(RoleName::Driver);
    addWorkflowCredential($driver, 'driver_license');
    $job = workflowDispatchJob($dispatcher, 'CON-1152', DispatchPriority::Priority);

    DB::unprepared(<<<'SQL'
        CREATE TRIGGER fail_assignment_audit
        BEFORE INSERT ON audit_events
        WHEN NEW.action = 'dispatch.resources_assigned'
        BEGIN
            SELECT RAISE(ABORT, 'forced assignment audit failure');
        END
        SQL);

    $this->actingAs($dispatcher)
        ->post("/operations/dispatch-jobs/{$job->id}/assignments", [
            'personnel' => [['user_id' => $driver->id, 'assignment_type' => 'driver']],
        ])
        ->assertServerError();

    expect($job->personnelAssignments()->count())->toBe(0)
        ->and($job->approvals()->count())->toBe(0)
        ->and(AuditEvent::query()->where('subject_id', $job->id)->count())->toBe(0);
});

it('forbids a user with assignment permission but without job visibility', function () {
    $dispatcher = operationsUser(RoleName::Dispatcher);
    $driver = operationsUser(RoleName::Driver);
    $driver->givePermissionTo(PermissionName::AssignmentsCreate->value);
    addWorkflowCredential($driver, 'driver_license');
    $job = workflowDispatchJob($dispatcher, 'CON-1201');

    $this->actingAs($driver)
        ->post("/operations/dispatch-jobs/{$job->id}/assignments", [
            'personnel' => [['user_id' => $driver->id, 'assignment_type' => 'driver']],
        ])
        ->assertForbidden();

    expect(DispatchPersonnelAssignment::query()->count())->toBe(0)
        ->and(AuditEvent::query()->where('action', 'dispatch.resources_assigned')->count())->toBe(0);
});

it('rejects drivers with an expired credential at the dispatch schedule', function () {
    $dispatcher = operationsUser(RoleName::Dispatcher);
    $driver = operationsUser(RoleName::Driver);
    $driver->personnelCredentials()->create([
        'kind' => 'driver_license',
        'credential_number' => 'DL-EXPIRED',
        'credential_type' => 'professional',
        'issued_at' => now()->subYears(2),
        'expires_at' => now()->subDay(),
        'status' => 'active',
    ]);
    $job = workflowDispatchJob($dispatcher, 'CON-1301');

    $response = $this->actingAs($dispatcher)
        ->from("/operations/dispatch-jobs/{$job->id}")
        ->post("/operations/dispatch-jobs/{$job->id}/assignments", [
            'personnel' => [['user_id' => $driver->id, 'assignment_type' => 'driver']],
        ]);

    $response->assertRedirect("/operations/dispatch-jobs/{$job->id}")
        ->assertSessionHasErrors('personnel');
    expect(session('errors')->first('personnel'))->toContain('expired');
    expect(DispatchPersonnelAssignment::query()->count())->toBe(0);
});

it('rejects crane operators with a missing credential', function () {
    $dispatcher = operationsUser(RoleName::Dispatcher);
    $operator = operationsUser(RoleName::CraneOperator);
    $job = workflowDispatchJob($dispatcher, 'CON-1302');

    $response = $this->actingAs($dispatcher)
        ->from("/operations/dispatch-jobs/{$job->id}")
        ->post("/operations/dispatch-jobs/{$job->id}/assignments", [
            'personnel' => [['user_id' => $operator->id, 'assignment_type' => 'crane_operator']],
        ]);

    $response->assertRedirect("/operations/dispatch-jobs/{$job->id}")
        ->assertSessionHasErrors('personnel');
    expect(session('errors')->first('personnel'))->toContain('missing');
    expect(DispatchPersonnelAssignment::query()->count())->toBe(0);
});

it('rejects unavailable, suspended, and role-mismatched personnel', function () {
    $dispatcher = operationsUser(RoleName::Dispatcher);
    $unavailableDriver = operationsUser(RoleName::Driver);
    $unavailableDriver->personnelProfile()->create(['availability_status' => 'on_leave']);
    addWorkflowCredential($unavailableDriver, 'driver_license');
    $suspendedDriver = operationsUser(RoleName::Driver);
    $suspendedDriver->update(['suspended_at' => now()]);
    addWorkflowCredential($suspendedDriver, 'driver_license');
    $technician = operationsUser(RoleName::FieldTechnician);
    $job = workflowDispatchJob($dispatcher, 'CON-1401');

    foreach ([
        [$unavailableDriver, 'driver', 'leave'],
        [$suspendedDriver, 'driver', 'suspended'],
        [$technician, 'driver', 'role'],
    ] as [$person, $assignmentType, $expectedConflict]) {
        $response = $this->actingAs($dispatcher)
            ->from("/operations/dispatch-jobs/{$job->id}")
            ->post("/operations/dispatch-jobs/{$job->id}/assignments", [
                'personnel' => [['user_id' => $person->id, 'assignment_type' => $assignmentType]],
            ]);

        $response->assertSessionHasErrors('personnel');
        expect(strtolower(session('errors')->first('personnel')))->toContain($expectedConflict);
    }

    expect(DispatchPersonnelAssignment::query()->count())->toBe(0);
});

it('rejects blocking maintenance and mismatched asset kinds', function () {
    $dispatcher = operationsUser(RoleName::Dispatcher);
    $job = workflowDispatchJob($dispatcher, 'CON-1501');
    $blockedCrane = OperationalAsset::query()->create(['code' => 'CR-1501', 'name' => 'Blocked crane', 'kind' => 'crane', 'status' => AssetStatus::Available]);
    $blockedCrane->maintenanceWorkOrders()->create([
        'technician_id' => operationsUser(RoleName::FieldTechnician)->id,
        'status' => 'open',
        'defect' => 'Boom inspection required',
        'dispatch_blocking' => true,
    ]);
    $truck = OperationalAsset::query()->create(['code' => 'TR-1501', 'name' => 'Truck', 'kind' => 'truck', 'status' => AssetStatus::Available]);

    $maintenanceResponse = $this->actingAs($dispatcher)
        ->from("/operations/dispatch-jobs/{$job->id}")
        ->post("/operations/dispatch-jobs/{$job->id}/assignments", [
            'assets' => [['operational_asset_id' => $blockedCrane->id, 'assignment_type' => 'crane']],
        ]);
    $maintenanceResponse->assertSessionHasErrors('assets');
    expect(strtolower(session('errors')->first('assets')))->toContain('maintenance');

    $kindResponse = $this->actingAs($dispatcher)
        ->from("/operations/dispatch-jobs/{$job->id}")
        ->post("/operations/dispatch-jobs/{$job->id}/assignments", [
            'assets' => [['operational_asset_id' => $truck->id, 'assignment_type' => 'crane']],
        ]);
    $kindResponse->assertSessionHasErrors('assets');
    expect(strtolower(session('errors')->first('assets')))->toContain('kind');

    expect(DispatchAssetAssignment::query()->count())->toBe(0);
});

it('rejects overlapping personnel and asset schedules', function () {
    $dispatcher = operationsUser(RoleName::Dispatcher);
    $driver = operationsUser(RoleName::Driver);
    addWorkflowCredential($driver, 'driver_license');
    $truck = OperationalAsset::query()->create(['code' => 'TR-1601', 'name' => 'Truck', 'kind' => 'truck', 'status' => AssetStatus::Available]);
    $existingJob = workflowDispatchJob($dispatcher, 'CON-1600');
    $targetJob = workflowDispatchJob($dispatcher, 'CON-1601');
    $existingJob->personnelAssignments()->create([
        'user_id' => $driver->id,
        'assignment_type' => 'driver',
        'assigned_by' => $dispatcher->id,
        'active_from' => $existingJob->scheduled_start,
    ]);
    $existingJob->assetAssignments()->create([
        'operational_asset_id' => $truck->id,
        'assignment_type' => 'truck',
        'assigned_by' => $dispatcher->id,
        'active_from' => $existingJob->scheduled_start,
    ]);

    $personnelResponse = $this->actingAs($dispatcher)
        ->from("/operations/dispatch-jobs/{$targetJob->id}")
        ->post("/operations/dispatch-jobs/{$targetJob->id}/assignments", [
            'personnel' => [['user_id' => $driver->id, 'assignment_type' => 'driver']],
        ]);
    $personnelResponse->assertSessionHasErrors('personnel');
    expect(session('errors')->first('personnel'))->toContain('CON-1600');

    $assetResponse = $this->actingAs($dispatcher)
        ->from("/operations/dispatch-jobs/{$targetJob->id}")
        ->post("/operations/dispatch-jobs/{$targetJob->id}/assignments", [
            'assets' => [['operational_asset_id' => $truck->id, 'assignment_type' => 'truck']],
        ]);
    $assetResponse->assertSessionHasErrors('assets');
    expect(session('errors')->first('assets'))->toContain('CON-1600');

    expect($targetJob->personnelAssignments()->count())->toBe(0)
        ->and($targetJob->assetAssignments()->count())->toBe(0);
});

it('rejects duplicate resources before entering the assignment transaction', function () {
    $dispatcher = operationsUser(RoleName::Dispatcher);
    $driver = operationsUser(RoleName::Driver);
    addWorkflowCredential($driver, 'driver_license');
    $job = workflowDispatchJob($dispatcher, 'CON-1701');

    $this->actingAs($dispatcher)
        ->postJson("/operations/dispatch-jobs/{$job->id}/assignments", [
            'personnel' => [
                ['user_id' => $driver->id, 'assignment_type' => 'driver'],
                ['user_id' => $driver->id, 'assignment_type' => 'driver'],
            ],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('personnel.1.user_id');

    expect(DispatchPersonnelAssignment::query()->count())->toBe(0)
        ->and(AuditEvent::query()->where('action', 'dispatch.resources_assigned')->count())->toBe(0);
});

it('revalidates a stale eligible resource snapshot and rolls back the whole assignment batch', function () {
    $dispatcher = operationsUser(RoleName::Dispatcher);
    $driver = operationsUser(RoleName::Driver);
    $technician = operationsUser(RoleName::FieldTechnician);
    addWorkflowCredential($driver, 'driver_license');
    $targetJob = workflowDispatchJob($dispatcher, 'CON-1801');
    $conflictingJob = workflowDispatchJob($dispatcher, 'CON-1800');
    $truck = OperationalAsset::query()->create(['code' => 'TR-1801', 'name' => 'Truck', 'kind' => 'truck', 'status' => AssetStatus::Available]);

    $this->actingAs($dispatcher)
        ->get("/operations/dispatch-jobs/{$targetJob->id}")
        ->assertOk();

    $conflictingJob->personnelAssignments()->create([
        'user_id' => $driver->id,
        'assignment_type' => 'driver',
        'assigned_by' => $dispatcher->id,
        'active_from' => $conflictingJob->scheduled_start,
    ]);

    $response = $this->actingAs($dispatcher)
        ->from("/operations/dispatch-jobs/{$targetJob->id}")
        ->post("/operations/dispatch-jobs/{$targetJob->id}/assignments", [
            'personnel' => [
                ['user_id' => $technician->id, 'assignment_type' => 'field_technician'],
                ['user_id' => $driver->id, 'assignment_type' => 'driver'],
            ],
            'assets' => [['operational_asset_id' => $truck->id, 'assignment_type' => 'truck']],
        ]);

    $response->assertSessionHasErrors('personnel');
    expect(session('errors')->first('personnel'))->toContain('CON-1800')
        ->and($targetJob->personnelAssignments()->count())->toBe(0)
        ->and($targetJob->assetAssignments()->count())->toBe(0)
        ->and(AuditEvent::query()->where('subject_id', $targetJob->id)->where('action', 'dispatch.resources_assigned')->count())->toBe(0);
});

it('requires independent manager approval before a priority dispatch activates', function () {
    $dispatcher = operationsUser(RoleName::Dispatcher);
    $manager = operationsUser(RoleName::OperationsManager);
    $driver = operationsUser(RoleName::Driver);
    addWorkflowCredential($driver, 'driver_license');
    $job = DispatchJob::query()->create(['reference' => 'CON-2001', 'client' => 'Northline', 'title' => 'Priority lift', 'site' => 'Marikina', 'scheduled_start' => now()->addDay(), 'scheduled_end' => now()->addDay()->addHours(2), 'priority' => DispatchPriority::Priority, 'status' => DispatchStatus::Draft, 'created_by' => $dispatcher->id]);
    $asset = OperationalAsset::query()->create(['code' => 'TR-2001', 'name' => 'Truck 2001', 'kind' => 'truck', 'status' => AssetStatus::Available]);
    $job->personnelAssignments()->create(['user_id' => $driver->id, 'assignment_type' => 'driver', 'assigned_by' => $dispatcher->id, 'active_from' => $job->scheduled_start]);
    $job->assetAssignments()->create(['operational_asset_id' => $asset->id, 'assignment_type' => 'truck', 'assigned_by' => $dispatcher->id, 'active_from' => $job->scheduled_start]);
    $approval = ApprovalRequest::query()->create(['subject_type' => (new DispatchJob)->getMorphClass(), 'subject_id' => $job->id, 'kind' => 'dispatch_activation', 'status' => ApprovalStatus::Pending, 'requested_by' => $dispatcher->id]);
    $this->actingAs($dispatcher)->from("/operations/dispatch-jobs/{$job->id}")->post("/operations/dispatch-jobs/{$job->id}/activate", ['version' => 1])->assertSessionHasErrors('approval');
    $this->actingAs($manager)->post("/operations/approval-requests/{$approval->id}/decision", ['status' => 'approved', 'reason' => 'Resources and timing verified'])->assertRedirect('/');
    $this->actingAs($dispatcher)->from("/operations/dispatch-jobs/{$job->id}")->post("/operations/dispatch-jobs/{$job->id}/activate", ['version' => 1])->assertRedirect("/operations/dispatch-jobs/{$job->id}");
    expect($job->refresh()->status)->toBe(DispatchStatus::Dispatched);
});

it('blocks unsafe assets from assignment', function () {
    $dispatcher = operationsUser(RoleName::Dispatcher);
    $job = DispatchJob::query()->create(['reference' => 'CON-3001', 'client' => 'Apex', 'title' => 'Lift', 'site' => 'Pasig', 'scheduled_start' => now()->addDay(), 'scheduled_end' => now()->addDay()->addHours(2), 'priority' => DispatchPriority::Routine, 'status' => DispatchStatus::Draft, 'created_by' => $dispatcher->id]);
    $asset = OperationalAsset::query()->create(['code' => 'CR-01', 'name' => 'Crane 01', 'kind' => 'crane', 'status' => AssetStatus::UnderMaintenance]);
    $this->actingAs($dispatcher)->postJson("/operations/dispatch-jobs/{$job->id}/assignments", ['assets' => [['operational_asset_id' => $asset->id, 'assignment_type' => 'crane']]])->assertUnprocessable();
});
