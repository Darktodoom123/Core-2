<?php

use App\Modules\Assignment\Enums\AssignmentResponse;
use App\Modules\Assignment\Models\DispatchAssetAssignment;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Enums\DelayContext;
use App\Modules\Dispatch\Enums\DelayReason;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Models\DispatchJobDelay;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Notifications\Jobs\SendQueuedNotificationJob;
use App\Platform\Workspace\Events\WorkspaceUpdated;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
    $this->adminUser = User::factory()->create(['is_active' => true]);
    $this->adminUser->syncRoles([RoleName::OperationsManager->value]);
});

it('rejects unauthenticated requests to report job delay', function (): void {
    $job = DispatchJob::query()->create([
        'reference' => 'DISP-DELAY-001',
        'client' => 'Acme Corp',
        'title' => 'Test Crane Lift',
        'site' => 'North Gate',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Accepted,
        'version' => 1,
        'created_by' => $this->adminUser->id,
    ]);

    $response = $this->postJson("/api/v1/dispatch-jobs/{$job->id}/delays", [
        'context' => 'transit',
        'reason' => 'traffic',
    ]);

    $response->assertUnauthorized();
});

it('rejects delay reports from users with only view permissions', function (): void {
    /** @var User $viewOnlyUser */
    $viewOnlyUser = User::factory()->create(['is_active' => true]);
    $viewOnlyUser->syncPermissions([PermissionName::DispatchViewAll->value]);
    $token = $viewOnlyUser->createToken('Mobile Token')->plainTextToken;

    $job = DispatchJob::query()->create([
        'reference' => 'DISP-DELAY-002',
        'client' => 'Acme Corp',
        'title' => 'Test Crane Lift',
        'site' => 'North Gate',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Accepted,
        'version' => 1,
        'created_by' => $this->adminUser->id,
    ]);

    $response = $this->withToken($token)->postJson("/api/v1/dispatch-jobs/{$job->id}/delays", [
        'context' => 'transit',
        'reason' => 'traffic',
    ], ['X-Command-Id' => (string) Str::uuid()]);

    $response->assertForbidden();
});

it('allows delay reports from an authorized dispatcher', function (): void {
    /** @var User $dispatcher */
    $dispatcher = User::factory()->create(['is_active' => true]);
    $dispatcher->syncPermissions([PermissionName::DispatchUpdate->value]);
    $token = $dispatcher->createToken('Mobile Token')->plainTextToken;

    $job = DispatchJob::query()->create([
        'reference' => 'DISP-DELAY-002A',
        'client' => 'Acme Corp',
        'title' => 'Test Crane Lift',
        'site' => 'North Gate',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Accepted,
        'version' => 1,
        'created_by' => $this->adminUser->id,
    ]);

    $response = $this->withToken($token)->postJson("/api/v1/dispatch-jobs/{$job->id}/delays", [
        'context' => 'transit',
        'reason' => 'traffic',
        'estimated_minutes' => 30,
    ], ['X-Command-Id' => (string) Str::uuid()]);

    $response->assertCreated();
});

it('rejects delay reports from unassigned operators even if they hold update_own_status permission', function (): void {
    /** @var User $unassignedWorker */
    $unassignedWorker = User::factory()->create(['is_active' => true]);
    $unassignedWorker->syncRoles([RoleName::CraneOperator->value]);
    $token = $unassignedWorker->createToken('Mobile Token')->plainTextToken;

    $job = DispatchJob::query()->create([
        'reference' => 'DISP-DELAY-002B',
        'client' => 'Acme Corp',
        'title' => 'Test Crane Lift',
        'site' => 'North Gate',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Accepted,
        'version' => 1,
        'created_by' => $this->adminUser->id,
    ]);

    $response = $this->withToken($token)->postJson("/api/v1/dispatch-jobs/{$job->id}/delays", [
        'context' => 'transit',
        'reason' => 'traffic',
        'estimated_minutes' => 30,
    ], ['X-Command-Id' => (string) Str::uuid()]);

    $response->assertForbidden();
});

it('rejects delay reports from an operator assigned only to another job (cross-job isolation)', function (): void {
    /** @var User $otherWorker */
    $otherWorker = User::factory()->create(['is_active' => true]);
    $otherWorker->syncRoles([RoleName::CraneOperator->value]);
    $token = $otherWorker->createToken('Mobile Token')->plainTextToken;

    $otherJob = DispatchJob::query()->create([
        'reference' => 'DISP-OTHER-JOB',
        'client' => 'Other Client',
        'title' => 'Other Job',
        'site' => 'Other Site',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::EnRoute,
        'version' => 1,
        'created_by' => $this->adminUser->id,
    ]);

    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $otherJob->id,
        'user_id' => $otherWorker->id,
        'assignment_type' => 'driver',
        'assigned_by' => $otherWorker->id,
        'response_status' => AssignmentResponse::Accepted,
        'created_at' => now(),
    ]);

    $targetJob = DispatchJob::query()->create([
        'reference' => 'DISP-TARGET-JOB',
        'client' => 'Target Client',
        'title' => 'Target Lift',
        'site' => 'Target Site',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::EnRoute,
        'version' => 1,
        'created_by' => $this->adminUser->id,
    ]);

    $response = $this->withToken($token)->postJson("/api/v1/dispatch-jobs/{$targetJob->id}/delays", [
        'context' => 'transit',
        'reason' => 'traffic',
        'estimated_minutes' => 30,
    ], ['X-Command-Id' => (string) Str::uuid()]);

    $response->assertForbidden();
});

it('rejects delay reports on completed or cancelled jobs', function (DispatchStatus $invalidStatus): void {
    /** @var User $worker */
    $worker = User::factory()->create(['is_active' => true]);
    $worker->syncRoles([RoleName::CraneOperator->value]);
    $token = $worker->createToken('Mobile Token')->plainTextToken;

    $job = DispatchJob::query()->create([
        'reference' => 'DISP-DELAY-003',
        'client' => 'Acme Corp',
        'title' => 'Test Lift',
        'site' => 'Site A',
        'priority' => DispatchPriority::Routine,
        'status' => $invalidStatus,
        'version' => 1,
        'created_by' => $this->adminUser->id,
    ]);

    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $worker->id,
        'assignment_type' => 'driver',
        'assigned_by' => $worker->id,
        'response_status' => AssignmentResponse::Accepted,
        'created_at' => now(),
    ]);

    $response = $this->withToken($token)->postJson("/api/v1/dispatch-jobs/{$job->id}/delays", [
        'context' => 'transit',
        'reason' => 'traffic',
    ], ['X-Command-Id' => (string) Str::uuid()]);

    $response->assertUnprocessable()
        ->assertJsonValidationErrors(['status']);
})->with([
    DispatchStatus::Completed,
    DispatchStatus::Cancelled,
    DispatchStatus::Draft,
]);

it('validates context and reason compatibility', function (): void {
    /** @var User $worker */
    $worker = User::factory()->create(['is_active' => true]);
    $worker->syncRoles([RoleName::CraneOperator->value]);
    $token = $worker->createToken('Mobile Token')->plainTextToken;

    $job = DispatchJob::query()->create([
        'reference' => 'DISP-DELAY-004',
        'client' => 'Acme Corp',
        'title' => 'Test Lift',
        'site' => 'Site A',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::EnRoute,
        'version' => 1,
        'created_by' => $this->adminUser->id,
    ]);

    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $worker->id,
        'assignment_type' => 'driver',
        'assigned_by' => $worker->id,
        'response_status' => AssignmentResponse::Accepted,
        'created_at' => now(),
    ]);

    // Invalid context
    $res1 = $this->withToken($token)->postJson("/api/v1/dispatch-jobs/{$job->id}/delays", [
        'context' => 'invalid_context',
        'reason' => 'traffic',
    ], ['X-Command-Id' => (string) Str::uuid()]);
    $res1->assertUnprocessable()->assertJsonValidationErrors(['context']);

    // Mismatched reason: site_not_ready is an on_site reason, but context is transit
    $res2 = $this->withToken($token)->postJson("/api/v1/dispatch-jobs/{$job->id}/delays", [
        'context' => 'transit',
        'reason' => 'site_not_ready',
    ], ['X-Command-Id' => (string) Str::uuid()]);
    $res2->assertUnprocessable()->assertJsonValidationErrors(['reason']);

    // Mismatched reason: low_clearance is transit reason, but context is on_site
    $res3 = $this->withToken($token)->postJson("/api/v1/dispatch-jobs/{$job->id}/delays", [
        'context' => 'on_site',
        'reason' => 'low_clearance',
    ], ['X-Command-Id' => (string) Str::uuid()]);
    $res3->assertUnprocessable()->assertJsonValidationErrors(['reason']);
});

it('validates that operational_asset_id must be assigned to the job if provided', function (): void {
    /** @var User $worker */
    $worker = User::factory()->create(['is_active' => true]);
    $worker->syncRoles([RoleName::CraneOperator->value]);
    $token = $worker->createToken('Mobile Token')->plainTextToken;

    $job = DispatchJob::query()->create([
        'reference' => 'DISP-DELAY-005',
        'client' => 'Acme Corp',
        'title' => 'Test Lift',
        'site' => 'Site A',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::EnRoute,
        'version' => 1,
        'created_by' => $this->adminUser->id,
    ]);

    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $worker->id,
        'assignment_type' => 'driver',
        'assigned_by' => $worker->id,
        'response_status' => AssignmentResponse::Accepted,
        'created_at' => now(),
    ]);

    $unassignedAsset = OperationalAsset::query()->create([
        'code' => 'CRN-UNASSIGNED',
        'name' => 'Unassigned Crane',
        'kind' => 'mobile_crane',
        'status' => 'available',
    ]);

    $response = $this->withToken($token)->postJson("/api/v1/dispatch-jobs/{$job->id}/delays", [
        'context' => 'transit',
        'reason' => 'traffic',
        'operational_asset_id' => $unassignedAsset->id,
    ], ['X-Command-Id' => (string) Str::uuid()]);

    $response->assertUnprocessable()->assertJsonValidationErrors(['operational_asset_id']);
});

it('detects optimistic version conflict and returns 409', function (): void {
    /** @var User $worker */
    $worker = User::factory()->create(['is_active' => true]);
    $worker->syncRoles([RoleName::CraneOperator->value]);
    $token = $worker->createToken('Mobile Token')->plainTextToken;

    $job = DispatchJob::query()->create([
        'reference' => 'DISP-DELAY-006',
        'client' => 'Acme Corp',
        'title' => 'Test Lift',
        'site' => 'Site A',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::EnRoute,
        'version' => 5, // Server version is 5
        'created_by' => $this->adminUser->id,
    ]);

    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $worker->id,
        'assignment_type' => 'driver',
        'assigned_by' => $worker->id,
        'response_status' => AssignmentResponse::Accepted,
        'created_at' => now(),
    ]);

    // Client expects version 3
    $response = $this->withToken($token)->postJson("/api/v1/dispatch-jobs/{$job->id}/delays", [
        'context' => 'transit',
        'reason' => 'traffic',
        'version' => 3,
    ], ['X-Command-Id' => (string) Str::uuid()]);

    $response->assertStatus(409)
        ->assertJsonPath('current_version', 5);
});

it('successfully records delay, dispatches notification, and preserves duty status without status mutation', function (): void {
    Event::fake([WorkspaceUpdated::class]);
    Queue::fake();

    /** @var User $worker */
    $worker = User::factory()->create(['is_active' => true]);
    $worker->syncRoles([RoleName::CraneOperator->value]);
    $token = $worker->createToken('Mobile Token')->plainTextToken;

    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-50T',
        'name' => '50T Liebherr Crane',
        'kind' => 'mobile_crane',
        'status' => 'available',
    ]);

    $job = DispatchJob::query()->create([
        'reference' => 'DISP-DELAY-007',
        'client' => 'First Gen Energy',
        'title' => 'Turbine Rigging',
        'site' => 'Batangas Power Plant',
        'priority' => DispatchPriority::Priority,
        'status' => DispatchStatus::Working,
        'version' => 2,
        'created_by' => $this->adminUser->id,
    ]);

    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $worker->id,
        'assignment_type' => 'operator',
        'assigned_by' => $worker->id,
        'response_status' => AssignmentResponse::Accepted,
        'created_at' => now(),
    ]);

    DispatchAssetAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'operational_asset_id' => $asset->id,
        'assignment_type' => 'primary',
        'status' => 'assigned',
        'assigned_by' => $worker->id,
        'created_at' => now(),
    ]);

    $commandId = (string) Str::uuid();

    $response = $this->withToken($token)->postJson("/api/v1/dispatch-jobs/{$job->id}/delays", [
        'context' => 'on_site',
        'reason' => 'site_not_ready',
        'operational_asset_id' => $asset->id,
        'estimated_minutes' => 45,
        'notes' => 'Crane pad ground unlevel; awaiting contractor grader.',
        'version' => 2,
    ], ['X-Command-Id' => $commandId]);

    $response->assertCreated()
        ->assertJsonPath('data.delay.context', 'on_site')
        ->assertJsonPath('data.delay.context_label', 'On-Site Delay')
        ->assertJsonPath('data.delay.reason', 'site_not_ready')
        ->assertJsonPath('data.delay.reason_label', 'Site Not Ready')
        ->assertJsonPath('data.delay.estimated_minutes', 45)
        ->assertJsonPath('data.delay.notes', 'Crane pad ground unlevel; awaiting contractor grader.')
        ->assertJsonPath('data.delay.operational_asset_id', $asset->id)
        ->assertJsonPath('data.delay.reported_by.id', $worker->id);

    // Verify DB record
    $delay = DispatchJobDelay::query()->where('command_id', $commandId)->first();
    expect($delay)->not->toBeNull()
        ->and($delay->dispatch_job_id)->toBe($job->id)
        ->and($delay->context)->toBe(DelayContext::OnSite)
        ->and($delay->reason)->toBe(DelayReason::SiteNotReady)
        ->and($delay->reason_label)->toBe('Site Not Ready')
        ->and($delay->estimated_minutes)->toBe(45)
        ->and($delay->notes)->toBe('Crane pad ground unlevel; awaiting contractor grader.')
        ->and($delay->reported_by)->toBe($worker->id)
        ->and($delay->operational_asset_id)->toBe($asset->id);

    // CRITICAL REGULATORY GUARDRAIL: Job status and version must NOT be automatically modified
    $freshJob = $job->fresh();
    expect($freshJob->status)->toBe(DispatchStatus::Working)
        ->and($freshJob->version)->toBe(2);

    // Verify audit log recorded
    $this->assertDatabaseHas('audit_events', [
        'subject_type' => $job->getMorphClass(),
        'subject_id' => $job->id,
        'action' => 'dispatch.delay_reported',
        'actor_id' => $worker->id,
    ]);

    // Verify workspace event broadcasted
    Event::assertDispatched(WorkspaceUpdated::class);
});

it('enforces command idempotency when replaying the same command_id', function (): void {
    /** @var User $worker */
    $worker = User::factory()->create(['is_active' => true]);
    $worker->syncRoles([RoleName::CraneOperator->value]);
    $token = $worker->createToken('Mobile Token')->plainTextToken;

    $job = DispatchJob::query()->create([
        'reference' => 'DISP-DELAY-008',
        'client' => 'DMCI Holdings',
        'title' => 'Structural Lift',
        'site' => 'Subic Bay Yard',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::EnRoute,
        'version' => 1,
        'created_by' => $this->adminUser->id,
    ]);

    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $worker->id,
        'assignment_type' => 'driver',
        'assigned_by' => $worker->id,
        'response_status' => AssignmentResponse::Accepted,
        'created_at' => now(),
    ]);

    $commandId = (string) Str::uuid();

    // First attempt
    $res1 = $this->withToken($token)->postJson("/api/v1/dispatch-jobs/{$job->id}/delays", [
        'context' => 'transit',
        'reason' => 'traffic',
        'estimated_minutes' => 30,
        'notes' => 'Toll plaza jam',
    ], ['X-Command-Id' => $commandId]);

    $res1->assertCreated();

    // Replay attempt with same commandId
    $res2 = $this->withToken($token)->postJson("/api/v1/dispatch-jobs/{$job->id}/delays", [
        'context' => 'transit',
        'reason' => 'traffic',
        'estimated_minutes' => 30,
        'notes' => 'Toll plaza jam',
    ], ['X-Command-Id' => $commandId]);

    // Same response, no duplicate records
    $res2->assertSuccessful();
    expect(DispatchJobDelay::query()->where('dispatch_job_id', $job->id)->count())->toBe(1);
});

it('dispatches queued notifications to dispatchers after database transaction commits', function (): void {
    Queue::fake([SendQueuedNotificationJob::class]);

    /** @var User $worker */
    $worker = User::factory()->create(['is_active' => true]);
    $worker->syncRoles([RoleName::CraneOperator->value]);
    $token = $worker->createToken('Mobile Token')->plainTextToken;

    $job = DispatchJob::query()->create([
        'reference' => 'DISP-DELAY-009',
        'client' => 'DMCI Holdings',
        'title' => 'Bridge Girder Lift',
        'site' => 'Batangas Port',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::EnRoute,
        'version' => 1,
        'created_by' => $this->adminUser->id,
    ]);

    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $worker->id,
        'assignment_type' => 'driver',
        'assigned_by' => $worker->id,
        'response_status' => AssignmentResponse::Accepted,
        'created_at' => now(),
    ]);

    $response = $this->withToken($token)->postJson("/api/v1/dispatch-jobs/{$job->id}/delays", [
        'context' => 'transit',
        'reason' => 'low_clearance',
        'estimated_minutes' => 45,
        'notes' => 'Overhead power cable clearance check required before proceeding.',
    ], ['X-Command-Id' => (string) Str::uuid()]);

    $response->assertCreated();

    // Verify SendQueuedNotificationJob was dispatched to the operations manager
    Queue::assertPushed(SendQueuedNotificationJob::class, function ($job): bool {
        return $job->recipient->id === $this->adminUser->id;
    });
});

it('does not send notifications if request fails validation or encounters conflict', function (): void {
    Queue::fake([SendQueuedNotificationJob::class]);

    /** @var User $worker */
    $worker = User::factory()->create(['is_active' => true]);
    $worker->syncRoles([RoleName::CraneOperator->value]);
    $token = $worker->createToken('Mobile Token')->plainTextToken;

    $job = DispatchJob::query()->create([
        'reference' => 'DISP-DELAY-009A',
        'client' => 'DMCI Holdings',
        'title' => 'Bridge Girder Lift',
        'site' => 'Batangas Port',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::EnRoute,
        'version' => 5,
        'created_by' => $this->adminUser->id,
    ]);

    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $worker->id,
        'assignment_type' => 'driver',
        'assigned_by' => $worker->id,
        'response_status' => AssignmentResponse::Accepted,
        'created_at' => now(),
    ]);

    // Send with version conflict
    $response = $this->withToken($token)->postJson("/api/v1/dispatch-jobs/{$job->id}/delays", [
        'context' => 'transit',
        'reason' => 'traffic',
        'version' => 1,
    ], ['X-Command-Id' => (string) Str::uuid()]);

    $response->assertStatus(409);
    Queue::assertNothingPushed();
});

it('does not duplicate notification dispatch on command replay', function (): void {
    Queue::fake([SendQueuedNotificationJob::class]);

    /** @var User $worker */
    $worker = User::factory()->create(['is_active' => true]);
    $worker->syncRoles([RoleName::CraneOperator->value]);
    $token = $worker->createToken('Mobile Token')->plainTextToken;

    $job = DispatchJob::query()->create([
        'reference' => 'DISP-DELAY-009B',
        'client' => 'DMCI Holdings',
        'title' => 'Bridge Girder Lift',
        'site' => 'Batangas Port',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::EnRoute,
        'version' => 1,
        'created_by' => $this->adminUser->id,
    ]);

    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $worker->id,
        'assignment_type' => 'driver',
        'assigned_by' => $worker->id,
        'response_status' => AssignmentResponse::Accepted,
        'created_at' => now(),
    ]);

    $commandId = (string) Str::uuid();

    // First call
    $res1 = $this->withToken($token)->postJson("/api/v1/dispatch-jobs/{$job->id}/delays", [
        'context' => 'transit',
        'reason' => 'traffic',
        'estimated_minutes' => 30,
    ], ['X-Command-Id' => $commandId]);
    $res1->assertCreated();

    // Exactly one notification pushed
    Queue::assertPushed(SendQueuedNotificationJob::class, 1);

    // Replay call
    $res2 = $this->withToken($token)->postJson("/api/v1/dispatch-jobs/{$job->id}/delays", [
        'context' => 'transit',
        'reason' => 'traffic',
        'estimated_minutes' => 30,
    ], ['X-Command-Id' => $commandId]);
    $res2->assertSuccessful();

    // Still exactly one notification pushed (not duplicated)
    Queue::assertPushed(SendQueuedNotificationJob::class, 1);
});

it('isolates delay reporting per operational asset on multi-asset jobs', function (): void {
    /** @var User $worker */
    $worker = User::factory()->create(['is_active' => true]);
    $worker->syncRoles([RoleName::CraneOperator->value]);
    $token = $worker->createToken('Mobile Token')->plainTextToken;

    $assetCrane = OperationalAsset::query()->create([
        'code' => 'CRN-50T-01',
        'name' => '50T Tadano Crane',
        'kind' => 'mobile_crane',
        'status' => 'available',
    ]);
    $assetTruck = OperationalAsset::query()->create([
        'code' => 'TRK-FLAT-02',
        'name' => 'Flatbed Hauler',
        'kind' => 'hauler',
        'status' => 'available',
    ]);

    $job = DispatchJob::query()->create([
        'reference' => 'DISP-DELAY-010',
        'client' => 'Megawide',
        'title' => 'Dual Asset Tandem Lift',
        'site' => 'Clark Freeport',
        'priority' => DispatchPriority::Priority,
        'status' => DispatchStatus::EnRoute,
        'version' => 1,
        'created_by' => $this->adminUser->id,
    ]);

    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $worker->id,
        'assignment_type' => 'driver',
        'assigned_by' => $worker->id,
        'response_status' => AssignmentResponse::Accepted,
        'created_at' => now(),
    ]);

    DispatchAssetAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'operational_asset_id' => $assetCrane->id,
        'assignment_type' => 'primary',
        'status' => 'assigned',
        'assigned_by' => $this->adminUser->id,
        'created_at' => now(),
    ]);

    DispatchAssetAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'operational_asset_id' => $assetTruck->id,
        'assignment_type' => 'support',
        'status' => 'assigned',
        'assigned_by' => $this->adminUser->id,
        'created_at' => now(),
    ]);

    // Report delay specifically for the crane (e.g. tire puncture / equipment issue)
    $res1 = $this->withToken($token)->postJson("/api/v1/dispatch-jobs/{$job->id}/delays", [
        'context' => 'transit',
        'reason' => 'equipment_issue',
        'estimated_minutes' => 60,
        'operational_asset_id' => $assetCrane->id,
        'notes' => 'Hydraulic warning indicator on 50T Tadano Crane.',
    ], ['X-Command-Id' => (string) Str::uuid()]);

    $res1->assertCreated()
        ->assertJsonPath('data.delay.operational_asset_id', $assetCrane->id)
        ->assertJsonPath('data.delay.reason', 'equipment_issue');

    // Report a whole-job delay (e.g. road closure affecting all assets)
    $res2 = $this->withToken($token)->postJson("/api/v1/dispatch-jobs/{$job->id}/delays", [
        'context' => 'transit',
        'reason' => 'road_closure',
        'estimated_minutes' => 30,
        'operational_asset_id' => null,
        'notes' => 'Route bridge closed for maintenance affecting entire convoy.',
    ], ['X-Command-Id' => (string) Str::uuid()]);

    $res2->assertCreated()
        ->assertJsonPath('data.delay.operational_asset_id', null)
        ->assertJsonPath('data.delay.reason', 'road_closure');

    // Verify both delays exist and retain their isolated asset association
    $delays = DispatchJobDelay::query()->where('dispatch_job_id', $job->id)->orderBy('id')->get();
    expect($delays)->toHaveCount(2)
        ->and($delays[0]->operational_asset_id)->toBe($assetCrane->id)
        ->and($delays[1]->operational_asset_id)->toBeNull();
});

it('accepts valid reported_at timestamp from offline queue within bounds and rejects future timestamp', function (): void {
    /** @var User $worker */
    $worker = User::factory()->create(['is_active' => true]);
    $worker->syncRoles([RoleName::CraneOperator->value]);
    $token = $worker->createToken('Mobile Token')->plainTextToken;

    $job = DispatchJob::query()->create([
        'reference' => 'DISP-DELAY-011',
        'client' => 'EEI Corp',
        'title' => 'Substation Generator Positioning',
        'site' => 'Taguig Substation',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Working,
        'version' => 1,
        'created_by' => $this->adminUser->id,
    ]);

    DispatchJob::query()->where('id', $job->id)->update([
        'created_at' => now()->subHours(2),
    ]);
    $job->refresh();

    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $worker->id,
        'assignment_type' => 'driver',
        'assigned_by' => $worker->id,
        'response_status' => AssignmentResponse::Accepted,
        'created_at' => now()->subHours(2),
    ]);

    $pastReportedAt = now()->subMinutes(25)->toIso8601String();

    // Valid offline delayed timestamp
    $res = $this->withToken($token)->postJson("/api/v1/dispatch-jobs/{$job->id}/delays", [
        'context' => 'on_site',
        'reason' => 'awaiting_clearance',
        'estimated_minutes' => 20,
        'reported_at' => $pastReportedAt,
        'notes' => 'Recorded offline 25 mins ago while awaiting site hot-work permit.',
    ], ['X-Command-Id' => (string) Str::uuid()]);

    $res->assertCreated()
        ->assertJsonPath('data.delay.reported_at', function ($val) use ($pastReportedAt): bool {
            return Carbon\Carbon::parse($val)->toIso8601String() === Carbon\Carbon::parse($pastReportedAt)->toIso8601String();
        });

    // Invalid future timestamp > 5 mins
    $futureReportedAt = now()->addMinutes(15)->toIso8601String();
    $resFuture = $this->withToken($token)->postJson("/api/v1/dispatch-jobs/{$job->id}/delays", [
        'context' => 'on_site',
        'reason' => 'awaiting_clearance',
        'reported_at' => $futureReportedAt,
    ], ['X-Command-Id' => (string) Str::uuid()]);

    $resFuture->assertUnprocessable()
        ->assertJsonValidationErrors(['reported_at']);
});
