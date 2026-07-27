<?php

use App\Enums\AssignmentResponse;
use App\Enums\DispatchPriority;
use App\Enums\DispatchStatus;
use App\Enums\RoleName;
use App\Models\DispatchAssetAssignment;
use App\Models\DispatchJob;
use App\Models\DispatchPersonnelAssignment;
use App\Models\OperationalAsset;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('allows field workers to view only their active assigned jobs', function (): void {
    /** @var User $worker1 */
    $worker1 = User::factory()->create(['is_active' => true]);
    $worker1->syncRoles([RoleName::Driver->value]);
    $token1 = $worker1->createToken('Mobile Token')->plainTextToken;

    /** @var User $worker2 */
    $worker2 = User::factory()->create(['is_active' => true]);
    $worker2->syncRoles([RoleName::Driver->value]);

    /** @var DispatchJob $job1 */
    $job1 = DispatchJob::query()->create([
        'reference' => 'DISP-MOBILE-001',
        'client' => 'Acme Corp',
        'title' => 'Site Transport 1',
        'site' => 'Site A',
        'priority' => DispatchPriority::Priority,
        'status' => DispatchStatus::Dispatched,
        'version' => 1,
        'created_by' => $worker1->id,
    ]);

    /** @var DispatchJob $job2 */
    $job2 = DispatchJob::query()->create([
        'reference' => 'DISP-MOBILE-002',
        'client' => 'Beta Logistics',
        'title' => 'Site Transport 2',
        'site' => 'Site B',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Dispatched,
        'version' => 1,
        'created_by' => $worker2->id,
    ]);

    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job1->id,
        'user_id' => $worker1->id,
        'assignment_type' => 'driver',
        'assigned_by' => $worker1->id,
        'response_status' => AssignmentResponse::Pending,
        'created_at' => now(),
    ]);

    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job2->id,
        'user_id' => $worker2->id,
        'assignment_type' => 'driver',
        'assigned_by' => $worker2->id,
        'response_status' => AssignmentResponse::Pending,
        'created_at' => now(),
    ]);

    $response = $this->withToken($token1)->getJson('/api/v1/dispatch-jobs');

    $response->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.reference', 'DISP-MOBILE-001');
});

it('returns detailed dispatch job information for active assigned worker', function (): void {
    /** @var User $worker */
    $worker = User::factory()->create(['is_active' => true]);
    $worker->syncRoles([RoleName::Driver->value]);
    $token = $worker->createToken('Mobile Token')->plainTextToken;

    /** @var OperationalAsset $asset */
    $asset = OperationalAsset::query()->create([
        'code' => 'TRK-99',
        'name' => 'Heavy Truck 99',
        'kind' => 'truck',
        'status' => 'available',
    ]);

    /** @var DispatchJob $job */
    $job = DispatchJob::query()->create([
        'reference' => 'DISP-MOBILE-100',
        'client' => 'Global Logistics',
        'title' => 'Equipment Delivery',
        'site' => 'Zone 4',
        'site_notes' => 'Gate code #4411',
        'priority' => DispatchPriority::Emergency,
        'status' => DispatchStatus::Dispatched,
        'version' => 1,
        'created_by' => $worker->id,
    ]);

    $assignment = DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $worker->id,
        'assignment_type' => 'driver',
        'assigned_by' => $worker->id,
        'response_status' => AssignmentResponse::Pending,
        'created_at' => now(),
    ]);

    DispatchAssetAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'operational_asset_id' => $asset->id,
        'assignment_type' => 'primary',
        'assigned_by' => $worker->id,
        'created_at' => now(),
    ]);

    $response = $this->withToken($token)->getJson("/api/v1/dispatch-jobs/{$job->id}");

    $response->assertOk()
        ->assertJsonPath('data.reference', 'DISP-MOBILE-100')
        ->assertJsonPath('data.site_notes', 'Gate code #4411')
        ->assertJsonPath('data.my_assignment.id', $assignment->id)
        ->assertJsonPath('data.my_assignment.response_status', 'pending')
        ->assertJsonPath('data.capabilities.can_respond', true)
        ->assertJsonPath('data.capabilities.can_update_status', true);
});

it('handles assignment accept and reject with version control and idempotency', function (): void {
    /** @var User $worker */
    $worker = User::factory()->create(['is_active' => true]);
    $worker->syncRoles([RoleName::Driver->value]);
    $token = $worker->createToken('Mobile Token')->plainTextToken;

    /** @var DispatchJob $job */
    $job = DispatchJob::query()->create([
        'reference' => 'DISP-MOBILE-200',
        'client' => 'Omega Heavy',
        'title' => 'Crane Move',
        'site' => 'Port South',
        'priority' => DispatchPriority::Priority,
        'status' => DispatchStatus::Dispatched,
        'version' => 1,
        'created_by' => $worker->id,
    ]);

    $assignment = DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $worker->id,
        'assignment_type' => 'driver',
        'assigned_by' => $worker->id,
        'response_status' => AssignmentResponse::Pending,
        'created_at' => now(),
    ]);

    $commandId = (string) Str::uuid();

    // Rejection without reason fails
    $this->withToken($token)
        ->withHeader('Idempotency-Key', (string) Str::uuid())
        ->postJson("/api/v1/dispatch-jobs/{$job->id}/assignments/{$assignment->id}/response", [
            'response' => 'rejected',
            'version' => 1,
            'command_id' => $commandId,
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['reason']);

    // Acceptance with idempotency key succeeds
    $response = $this->withToken($token)
        ->withHeader('Idempotency-Key', $commandId)
        ->postJson("/api/v1/dispatch-jobs/{$job->id}/assignments/{$assignment->id}/response", [
            'response' => 'accepted',
            'version' => 1,
        ]);

    $response->assertOk()
        ->assertJsonPath('data.my_assignment.response_status', 'accepted')
        ->assertJsonPath('data.version', 2);

    // Replaying exact same request with same Idempotency-Key returns identical response
    $replayResponse = $this->withToken($token)
        ->withHeader('Idempotency-Key', $commandId)
        ->postJson("/api/v1/dispatch-jobs/{$job->id}/assignments/{$assignment->id}/response", [
            'response' => 'accepted',
            'version' => 1,
        ]);

    $replayResponse->assertOk()
        ->assertJsonPath('data.my_assignment.response_status', 'accepted')
        ->assertJsonPath('data.version', 2);
});

it('returns 409 conflict when responding with an outdated version', function (): void {
    /** @var User $worker */
    $worker = User::factory()->create(['is_active' => true]);
    $worker->syncRoles([RoleName::Driver->value]);
    $token = $worker->createToken('Mobile Token')->plainTextToken;

    /** @var DispatchJob $job */
    $job = DispatchJob::query()->create([
        'reference' => 'DISP-MOBILE-300',
        'client' => 'Alpha Heavy',
        'title' => 'Haul Job',
        'site' => 'Site 9',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Dispatched,
        'version' => 5, // Server is at version 5
        'created_by' => $worker->id,
    ]);

    $assignment = DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $worker->id,
        'assignment_type' => 'driver',
        'assigned_by' => $worker->id,
        'response_status' => AssignmentResponse::Pending,
        'created_at' => now(),
    ]);

    $response = $this->withToken($token)
        ->withHeader('Idempotency-Key', (string) Str::uuid())
        ->postJson("/api/v1/dispatch-jobs/{$job->id}/assignments/{$assignment->id}/response", [
            'response' => 'accepted',
            'version' => 4, // Outdated version submitted
        ]);

    $response->assertStatus(409)
        ->assertJson([
            'error' => 'stale_version',
            'current_version' => 5,
        ])
        ->assertJsonPath('data.id', $job->id)
        ->assertJsonPath('data.version', 5);
});

it('enforces forward-only status progression using API command contract', function (): void {
    /** @var User $worker */
    $worker = User::factory()->create(['is_active' => true]);
    $worker->syncRoles([RoleName::Driver->value]);
    $token = $worker->createToken('Mobile Token')->plainTextToken;

    /** @var DispatchJob $job */
    $job = DispatchJob::query()->create([
        'reference' => 'DISP-MOBILE-400',
        'client' => 'Forward Corp',
        'title' => 'Staged Progression',
        'site' => 'Site Alpha',
        'priority' => DispatchPriority::Priority,
        'status' => DispatchStatus::Dispatched,
        'version' => 1,
        'created_by' => $worker->id,
    ]);

    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $worker->id,
        'assignment_type' => 'driver',
        'assigned_by' => $worker->id,
        'response_status' => AssignmentResponse::Accepted,
        'created_at' => now(),
    ]);

    // Invalid skip from dispatched to working fails with 422
    $this->withToken($token)
        ->withHeader('Idempotency-Key', (string) Str::uuid())
        ->postJson("/api/v1/dispatch-jobs/{$job->id}/status", [
            'status' => 'working',
            'version' => 1,
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['status']);

    // Valid forward step: dispatched -> accepted
    $step1 = $this->withToken($token)
        ->withHeader('Idempotency-Key', (string) Str::uuid())
        ->postJson("/api/v1/dispatch-jobs/{$job->id}/status", [
            'status' => 'accepted',
            'version' => 1,
        ]);

    $step1->assertOk()
        ->assertJsonPath('data.status.value', 'accepted')
        ->assertJsonPath('data.version', 2);

    // Valid forward step: accepted -> en_route
    $step2 = $this->withToken($token)
        ->withHeader('Idempotency-Key', (string) Str::uuid())
        ->postJson("/api/v1/dispatch-jobs/{$job->id}/status", [
            'status' => 'en_route',
            'version' => 2,
        ]);

    $step2->assertOk()
        ->assertJsonPath('data.status.value', 'en_route')
        ->assertJsonPath('data.version', 3);
});

it('denies status transitions for unassigned workers', function (): void {
    /** @var User $worker1 */
    $worker1 = User::factory()->create(['is_active' => true]);
    $worker1->syncRoles([RoleName::Driver->value]);

    /** @var User $worker2 */
    $worker2 = User::factory()->create(['is_active' => true]);
    $worker2->syncRoles([RoleName::Driver->value]);
    $token2 = $worker2->createToken('Mobile Token')->plainTextToken;

    /** @var DispatchJob $job */
    $job = DispatchJob::query()->create([
        'reference' => 'DISP-MOBILE-500',
        'client' => 'Private Corp',
        'title' => 'Assigned Only',
        'site' => 'Site X',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Dispatched,
        'version' => 1,
        'created_by' => $worker1->id,
    ]);

    // Assigned worker is worker1
    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $worker1->id,
        'assignment_type' => 'driver',
        'assigned_by' => $worker1->id,
        'response_status' => AssignmentResponse::Pending,
        'created_at' => now(),
    ]);

    // Unassigned worker2 attempts transition -> rejected with 404 (scoped view)
    $this->withToken($token2)
        ->withHeader('Idempotency-Key', (string) Str::uuid())
        ->postJson("/api/v1/dispatch-jobs/{$job->id}/status", [
            'status' => 'accepted',
            'version' => 1,
        ])
        ->assertNotFound();
});

it('excludes assignments after their active window from the mobile boundary', function (): void {
    /** @var User $worker */
    $worker = User::factory()->create(['is_active' => true]);
    $worker->syncRoles([RoleName::Driver->value]);
    $token = $worker->createToken('Mobile Token')->plainTextToken;

    /** @var DispatchJob $job */
    $job = DispatchJob::query()->create([
        'reference' => 'DISP-MOBILE-WINDOW',
        'client' => 'Window Corp',
        'title' => 'Ended Assignment',
        'site' => 'Site Ended',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Dispatched,
        'version' => 1,
        'created_by' => $worker->id,
    ]);

    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $worker->id,
        'assignment_type' => 'driver',
        'assigned_by' => $worker->id,
        'active_from' => now()->subHour(),
        'active_until' => now()->subMinute(),
        'response_status' => AssignmentResponse::Pending,
    ]);

    $this->withToken($token)
        ->getJson('/api/v1/dispatch-jobs')
        ->assertOk()
        ->assertJsonCount(0, 'data');

    $this->withToken($token)
        ->getJson("/api/v1/dispatch-jobs/{$job->id}")
        ->assertNotFound();
});

it('requires an idempotency key for mobile commands', function (): void {
    /** @var User $worker */
    $worker = User::factory()->create(['is_active' => true]);
    $worker->syncRoles([RoleName::Driver->value]);
    $token = $worker->createToken('Mobile Token')->plainTextToken;

    /** @var DispatchJob $job */
    $job = DispatchJob::query()->create([
        'reference' => 'DISP-MOBILE-COMMAND',
        'client' => 'Command Corp',
        'title' => 'Command Contract',
        'site' => 'Site Command',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Dispatched,
        'version' => 1,
        'created_by' => $worker->id,
    ]);

    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $worker->id,
        'assignment_type' => 'driver',
        'assigned_by' => $worker->id,
        'response_status' => AssignmentResponse::Accepted,
    ]);

    $this->withToken($token)
        ->postJson("/api/v1/dispatch-jobs/{$job->id}/status", [
            'status' => 'accepted',
            'version' => 1,
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['command_id']);

    expect($job->refresh()->version)->toBe(1);
});
