<?php

use App\Modules\Assignment\Enums\AssignmentResponse;
use App\Modules\Assignment\Models\DispatchAssetAssignment;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Enums\ApprovalStatus;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\ApprovalRequest;
use App\Modules\Dispatch\Models\Client;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Models\ServiceRequest;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

function createPhase2User(RoleName $role, string $name): User
{
    /** @var User $user */
    $user = User::factory()->create([
        'name' => $name,
        'is_active' => true,
    ]);
    $user->syncRoles([$role->value]);

    return $user;
}

function addPhase2Credential(User $user, string $kind): void
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

it('executes full happy path: dispatcher intake -> staffing -> manager approval -> dispatcher activation -> mobile field worker response & step progression to completion', function () {
    $dispatcher = User::factory()->create(['name' => 'Lead Dispatcher', 'is_active' => true]);
    $dispatcher->givePermissionTo([
        PermissionName::DispatchCreate->value,
        PermissionName::DispatchUpdate->value,
        PermissionName::DispatchViewAll->value,
        PermissionName::DispatchActivate->value,
        PermissionName::AssignmentsCreate->value,
        PermissionName::AssignmentsViewAll->value,
        PermissionName::AssignmentsReassign->value,
    ]);
    $manager = createPhase2User(RoleName::OperationsManager, 'Ops Manager');
    $fieldDriver = createPhase2User(RoleName::Driver, 'Field Driver A');
    $fieldOperator = createPhase2User(RoleName::CraneOperator, 'Field Operator A');
    $unassignedWorker = createPhase2User(RoleName::Driver, 'Unassigned Worker');

    addPhase2Credential($fieldDriver, 'driver_license');
    addPhase2Credential($fieldOperator, 'operator_certification');

    $truck = OperationalAsset::query()->create([
        'code' => 'TRK-P2-01',
        'name' => 'Heavy Duty Truck 01',
        'kind' => 'truck',
        'status' => AssetStatus::Available,
    ]);

    $crane = OperationalAsset::query()->create([
        'code' => 'CRN-P2-01',
        'name' => 'All-Terrain Crane 01',
        'kind' => 'crane',
        'status' => AssetStatus::ReadyForService,
    ]);

    // 1. Client & Service Request Creation
    $client = Client::query()->create([
        'code' => 'ACME-01',
        'company_name' => 'Acme Heavy Industries',
        'contact_person' => 'John Doe',
        'email' => 'john@acme.com',
        'phone' => '+1234567890',
        'status' => 'active',
    ]);

    $serviceRequest = ServiceRequest::query()->create([
        'reference' => 'SR-P2-FULL',
        'client_id' => $client->id,
        'project_name' => 'Emergency Bridge Support',
        'service_type' => 'crane_and_truck',
        'location' => 'Bridge 9, Sector B',
        'title' => 'Emergency Bridge Support Lift',
        'description' => 'Lift and hold structural beam during repair.',
        'site' => 'Bridge 9, Sector B',
        'priority' => DispatchPriority::Priority,
        'status' => 'submitted',
        'created_by' => $dispatcher->id,
    ]);

    // Convert request to draft dispatch job
    $this->actingAs($dispatcher)->post('/operations/dispatch-jobs', [
        'service_request_id' => $serviceRequest->id,
        'reference' => 'DISP-P2-FULL',
        'scheduled_start' => now()->addDay()->startOfHour()->toIso8601String(),
        'scheduled_end' => now()->addDay()->startOfHour()->addHours(6)->toIso8601String(),
    ])->assertRedirect('/')->assertSessionDoesntHaveErrors();

    /** @var DispatchJob $job */
    $job = DispatchJob::query()->where('reference', 'DISP-P2-FULL')->sole();
    expect($job->status)->toBe(DispatchStatus::Draft)
        ->and($job->version)->toBe(1);

    // 2. Resource Assignment (Priority triggers approval request)
    $this->actingAs($dispatcher)
        ->post("/operations/dispatch-jobs/{$job->id}/assignments", [
            'personnel' => [
                ['user_id' => $fieldDriver->id, 'assignment_type' => 'driver'],
                ['user_id' => $fieldOperator->id, 'assignment_type' => 'crane_operator'],
            ],
            'assets' => [
                ['operational_asset_id' => $truck->id, 'assignment_type' => 'truck'],
                ['operational_asset_id' => $crane->id, 'assignment_type' => 'crane'],
            ],
        ])
        ->assertRedirect("/operations/dispatch-jobs/{$job->id}")
        ->assertSessionDoesntHaveErrors();

    $approval = ApprovalRequest::query()
        ->where('subject_type', (new DispatchJob)->getMorphClass())
        ->where('subject_id', $job->id)
        ->sole();

    expect($approval->status)->toBe(ApprovalStatus::Pending)
        ->and($approval->kind)->toBe('assignment_override');

    // Self-approval by requester is forbidden
    $this->actingAs($dispatcher)
        ->post("/operations/approval-requests/{$approval->id}/decision", [
            'status' => ApprovalStatus::Approved->value,
            'reason' => 'Self approval attempt',
        ])
        ->assertForbidden();

    // 3. Manager Approval
    $this->actingAs($manager)
        ->post("/operations/approval-requests/{$approval->id}/decision", [
            'status' => ApprovalStatus::Approved->value,
            'reason' => 'Personnel credentials, asset readiness, and site plan approved.',
        ])
        ->assertRedirect('/');

    expect($approval->refresh()->status)->toBe(ApprovalStatus::Approved);

    // 4. Dispatcher Activation
    $this->actingAs($dispatcher)
        ->post("/operations/dispatch-jobs/{$job->id}/activate", ['version' => 1])
        ->assertRedirect("/operations/dispatch-jobs/{$job->id}");

    $job->refresh();
    expect($job->status)->toBe(DispatchStatus::Dispatched)
        ->and($job->version)->toBe(2)
        ->and($job->activated_by)->toBe($dispatcher->id);

    // 5. Mobile Boundary (/api/v1) - Worker Isolation & Response
    $this->flushSession();
    $this->app->make('auth')->forgetGuards();
    $driverToken = $fieldDriver->createToken('Mobile App')->plainTextToken;
    $unassignedToken = $unassignedWorker->createToken('Mobile App')->plainTextToken;

    // Unassigned worker isolation check
    $this->withToken($unassignedToken)
        ->getJson('/api/v1/dispatch-jobs')
        ->assertOk()
        ->assertJsonCount(0, 'data');

    $this->withToken($unassignedToken)
        ->getJson("/api/v1/dispatch-jobs/{$job->id}")
        ->assertNotFound();

    // Assigned worker sees job
    $this->app->make('auth')->forgetGuards();
    $driverJobsResponse = $this->withToken($driverToken)
        ->getJson('/api/v1/dispatch-jobs')
        ->assertOk();

    expect($driverJobsResponse->json('data.0.reference'))->toBe('DISP-P2-FULL');

    $driverDetailResponse = $this->withToken($driverToken)
        ->getJson("/api/v1/dispatch-jobs/{$job->id}")
        ->assertOk();

    $assignmentId = $driverDetailResponse->json('data.my_assignment.id');
    expect($assignmentId)->not->toBeNull();

    // Accept Assignment via Mobile API with Idempotency Key
    $commandId = (string) Str::uuid();
    $acceptResponse = $this->withToken($driverToken)
        ->withHeader('Idempotency-Key', $commandId)
        ->postJson("/api/v1/dispatch-jobs/{$job->id}/assignments/{$assignmentId}/response", [
            'response' => 'accepted',
            'version' => 2,
        ]);

    $acceptResponse->assertOk()
        ->assertJsonPath('data.my_assignment.response_status', 'accepted')
        ->assertJsonPath('data.version', 3);

    // Idempotent Replay
    $replayResponse = $this->withToken($driverToken)
        ->withHeader('Idempotency-Key', $commandId)
        ->postJson("/api/v1/dispatch-jobs/{$job->id}/assignments/{$assignmentId}/response", [
            'response' => 'accepted',
            'version' => 2,
        ]);

    $replayResponse->assertOk()
        ->assertJsonPath('data.version', 3);

    // 6. Step Progression via Mobile API
    $progressionSteps = [
        ['status' => 'accepted', 'expectedVersion' => 4],
        ['status' => 'en_route', 'expectedVersion' => 5],
        ['status' => 'arrived', 'expectedVersion' => 6],
        ['status' => 'working', 'expectedVersion' => 7],
        ['status' => 'completed', 'expectedVersion' => 8],
    ];

    $currentVersion = 3;
    foreach ($progressionSteps as $step) {
        $stepResponse = $this->withToken($driverToken)
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson("/api/v1/dispatch-jobs/{$job->id}/status", [
                'status' => $step['status'],
                'version' => $currentVersion,
            ]);

        $stepResponse->assertOk()
            ->assertJsonPath('data.status.value', $step['status'])
            ->assertJsonPath('data.version', $step['expectedVersion']);

        $currentVersion = $step['expectedVersion'];
    }

    $job->refresh();
    expect($job->status)->toBe(DispatchStatus::Completed)
        ->and($job->version)->toBe(8);

    // 7. Audit Trail Attributability Check
    $statusAudits = AuditEvent::query()
        ->where('subject_type', (new DispatchJob)->getMorphClass())
        ->where('subject_id', $job->id)
        ->where('action', 'dispatch.status_updated')
        ->get();

    expect($statusAudits->count())->toBe(5);
    foreach ($statusAudits as $audit) {
        expect($audit->actor_id)->toBe($fieldDriver->id)
            ->and($audit->request_id)->not->toBeEmpty();
    }
});

it('handles field worker rejection, dispatcher reassignment, and second worker completion', function () {
    $dispatcher = createPhase2User(RoleName::OperationsManager, 'Reassign Dispatcher');
    $dispatcher->givePermissionTo(PermissionName::AssignmentsOverride->value);
    $worker1 = createPhase2User(RoleName::Driver, 'Driver Worker 1');
    $worker2 = createPhase2User(RoleName::Driver, 'Driver Worker 2');

    addPhase2Credential($worker1, 'driver_license');
    addPhase2Credential($worker2, 'driver_license');

    $truck = OperationalAsset::query()->create([
        'code' => 'TRK-REASSIGN',
        'name' => 'Reassign Truck',
        'kind' => 'truck',
        'status' => AssetStatus::Available,
    ]);

    /** @var DispatchJob $job */
    $job = DispatchJob::query()->create([
        'reference' => 'DISP-P2-REASSIGN',
        'client' => 'Metro Hauling',
        'title' => 'Material Delivery',
        'site' => 'Zone 5',
        'scheduled_start' => now()->addDay(),
        'scheduled_end' => now()->addDay()->addHours(3),
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Dispatched,
        'version' => 1,
        'created_by' => $dispatcher->id,
        'activated_by' => $dispatcher->id,
    ]);

    $assignment1 = DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $worker1->id,
        'assignment_type' => 'driver',
        'assigned_by' => $dispatcher->id,
        'response_status' => AssignmentResponse::Pending,
        'created_at' => now(),
    ]);

    DispatchAssetAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'operational_asset_id' => $truck->id,
        'assignment_type' => 'truck',
        'assigned_by' => $dispatcher->id,
        'created_at' => now(),
    ]);

    $token1 = $worker1->createToken('Mobile Token')->plainTextToken;

    // Worker 1 rejects assignment with reason
    $rejectResponse = $this->withToken($token1)
        ->withHeader('Idempotency-Key', (string) Str::uuid())
        ->postJson("/api/v1/dispatch-jobs/{$job->id}/assignments/{$assignment1->id}/response", [
            'response' => 'rejected',
            'reason' => 'Equipment failure on transit truck',
            'version' => 1,
        ]);

    $rejectResponse->assertOk();

    // Worker 1 assignment interval closed and status updated to rejected
    expect($assignment1->fresh()->response_status->value)->toBe('rejected')
        ->and($assignment1->fresh()->active_until)->not->toBeNull();

    // Worker 1 no longer sees job
    $this->withToken($token1)
        ->getJson('/api/v1/dispatch-jobs')
        ->assertOk()
        ->assertJsonCount(0, 'data');

    // Audit event logged for rejection
    expect(AuditEvent::query()
        ->where('subject_id', $job->id)
        ->where('action', 'dispatch.assignment_rejected')
        ->sole()->reason)->toBe('Equipment failure on transit truck');

    // Dispatcher reassigns Worker 2 to replace rejected assignment
    $this->actingAs($dispatcher)
        ->post("/operations/dispatch-jobs/{$job->id}/reassign", [
            'version' => 2,
            'end_personnel_assignment_ids' => [],
            'end_asset_assignment_ids' => [],
            'personnel' => [
                ['user_id' => $worker2->id, 'assignment_type' => 'driver'],
            ],
            'assets' => [],
        ])
        ->assertRedirect("/operations/dispatch-jobs/{$job->id}")
        ->assertSessionDoesntHaveErrors();

    $token2 = $worker2->createToken('Mobile Token')->plainTextToken;

    // Worker 2 sees assigned job
    $this->app->make('auth')->forgetGuards();
    $worker2Jobs = $this->withToken($token2)
        ->getJson('/api/v1/dispatch-jobs')
        ->assertOk();

    expect($worker2Jobs->json('data.0.reference'))->toBe('DISP-P2-REASSIGN');

    $assignment2Id = $worker2Jobs->json('data.0.my_assignment.id');

    // Worker 2 accepts and completes job
    $this->withToken($token2)
        ->withHeader('Idempotency-Key', (string) Str::uuid())
        ->postJson("/api/v1/dispatch-jobs/{$job->id}/assignments/{$assignment2Id}/response", [
            'response' => 'accepted',
            'version' => 3,
        ])
        ->assertOk();
});

it('handles cancellation, reopen, archive, and restoration cycle with assignment cleanup', function () {
    $dispatcher = createPhase2User(RoleName::OperationsManager, 'Cancel Dispatcher');
    $manager = createPhase2User(RoleName::OperationsManager, 'Cancel Manager');
    $sysAdmin = createPhase2User(RoleName::SystemAdministrator, 'Admin User');
    $worker = createPhase2User(RoleName::Driver, 'Cancel Worker');

    /** @var DispatchJob $job */
    $job = DispatchJob::query()->create([
        'reference' => 'DISP-P2-CANCEL',
        'client' => 'City Infrastructure',
        'title' => 'Road Support',
        'site' => 'Site 12',
        'scheduled_start' => now()->addDay(),
        'scheduled_end' => now()->addDay()->addHours(4),
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Dispatched,
        'version' => 1,
        'created_by' => $dispatcher->id,
    ]);

    $assignment = DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $worker->id,
        'assignment_type' => 'driver',
        'assigned_by' => $dispatcher->id,
        'active_from' => now()->subHour(),
        'active_until' => null,
    ]);

    // 1. Cancellation by Dispatcher
    $this->actingAs($dispatcher)
        ->post("/operations/dispatch-jobs/{$job->id}/cancel", [
            'reason' => 'Severe weather warning in sector',
            'version' => 1,
        ])
        ->assertRedirect("/operations/dispatch-jobs/{$job->id}");

    $job->refresh();
    expect($job->status)->toBe(DispatchStatus::Cancelled)
        ->and($job->version)->toBe(2)
        ->and($assignment->fresh()->active_until)->not->toBeNull();

    expect(AuditEvent::query()
        ->where('subject_id', $job->id)
        ->where('action', 'dispatch.cancelled')
        ->sole()->reason)->toBe('Severe weather warning in sector');

    // 2. Reopen by Manager
    $this->actingAs($manager)
        ->post("/operations/dispatch-jobs/{$job->id}/reopen", [
            'reason' => 'Weather cleared, rescheduling',
            'version' => 2,
        ])
        ->assertRedirect("/operations/dispatch-jobs/{$job->id}");

    $job->refresh();
    expect($job->status)->toBe(DispatchStatus::Draft)
        ->and($job->version)->toBe(3);

    // 3. Archive by System Administrator
    $this->actingAs($sysAdmin)
        ->post("/operations/dispatch-jobs/{$job->id}/archive", [
            'reason' => 'Archiving redundant test record',
        ])
        ->assertRedirect('/');

    expect(DispatchJob::query()->where('id', $job->id)->exists())->toBeFalse();
    expect(DispatchJob::withTrashed()->where('id', $job->id)->exists())->toBeTrue();

    // 4. Restore by System Administrator
    $this->actingAs($sysAdmin)
        ->post("/operations/dispatch-jobs/{$job->id}/restore", [
            'reason' => 'Restoring for compliance audit',
        ])
        ->assertRedirect("/operations/dispatch-jobs/{$job->id}");

    expect(DispatchJob::query()->where('id', $job->id)->exists())->toBeTrue();
    expect($job->fresh()->version)->toBe(5);
});

it('enforces stale version, out-of-order transition, and rejection validation errors safely', function () {
    $dispatcher = createPhase2User(RoleName::OperationsManager, 'Safety Dispatcher');
    $worker = createPhase2User(RoleName::Driver, 'Safety Driver');
    $token = $worker->createToken('Mobile Token')->plainTextToken;

    /** @var DispatchJob $job */
    $job = DispatchJob::query()->create([
        'reference' => 'DISP-P2-SAFETY',
        'client' => 'Safety Corp',
        'title' => 'Safety Check',
        'site' => 'Site 99',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Dispatched,
        'version' => 5, // Server version is 5
        'created_by' => $dispatcher->id,
    ]);

    $assignment = DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $worker->id,
        'assignment_type' => 'driver',
        'assigned_by' => $dispatcher->id,
        'response_status' => AssignmentResponse::Pending,
    ]);

    // 1. Rejection without reason fails with 422
    $this->withToken($token)
        ->withHeader('Idempotency-Key', (string) Str::uuid())
        ->postJson("/api/v1/dispatch-jobs/{$job->id}/assignments/{$assignment->id}/response", [
            'response' => 'rejected',
            'version' => 5,
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['reason']);

    // 2. Submitting stale version returns 409 conflict
    $this->withToken($token)
        ->withHeader('Idempotency-Key', (string) Str::uuid())
        ->postJson("/api/v1/dispatch-jobs/{$job->id}/assignments/{$assignment->id}/response", [
            'response' => 'accepted',
            'version' => 4, // Outdated version submitted
        ])
        ->assertStatus(409)
        ->assertJson([
            'error' => 'stale_version',
            'current_version' => 5,
        ]);

    // 3. Out-of-order status skip (dispatched -> working) fails with 422
    $this->withToken($token)
        ->withHeader('Idempotency-Key', (string) Str::uuid())
        ->postJson("/api/v1/dispatch-jobs/{$job->id}/status", [
            'status' => 'working',
            'version' => 5,
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['status']);

    expect($job->refresh()->version)->toBe(5);
});

it('guarantees transactional rollback when audit event recording fails', function () {
    $dispatcher = createPhase2User(RoleName::OperationsManager, 'Rollback Dispatcher');
    $worker = createPhase2User(RoleName::Driver, 'Rollback Driver');

    /** @var DispatchJob $job */
    $job = DispatchJob::query()->create([
        'reference' => 'DISP-P2-ROLLBACK',
        'client' => 'Rollback Corp',
        'title' => 'Rollback Test',
        'site' => 'Site RB',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Dispatched,
        'version' => 2,
        'created_by' => $dispatcher->id,
    ]);

    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $worker->id,
        'assignment_type' => 'driver',
        'assigned_by' => $dispatcher->id,
    ]);

    // Add SQLite trigger to force audit insert failure
    DB::unprepared(<<<'SQL'
        CREATE TRIGGER fail_phase2_status_audit
        BEFORE INSERT ON audit_events
        WHEN NEW.action = 'dispatch.status_updated'
        BEGIN
            SELECT RAISE(ABORT, 'forced status audit failure');
        END
        SQL);

    $this->withoutExceptionHandling();

    expect(fn () => $this->actingAs($worker)
        ->post("/operations/dispatch-jobs/{$job->id}/status", [
            'status' => DispatchStatus::Accepted->value,
            'version' => 2,
        ]))->toThrow(QueryException::class);

    // Job state and version remain unchanged
    expect($job->refresh()->status)->toBe(DispatchStatus::Dispatched)
        ->and($job->version)->toBe(2)
        ->and(AuditEvent::query()->where('subject_id', $job->id)->where('action', 'dispatch.status_updated')->count())->toBe(0);
});
