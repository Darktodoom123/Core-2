<?php

use App\Modules\Dispatch\Commands\DispatchV2Commands;
use App\Modules\Dispatch\Data\DispatchV2Mutation;
use App\Modules\Dispatch\Enums\ApprovalStatus;
use App\Modules\Dispatch\Enums\DispatchAssignmentOfferStatus;
use App\Modules\Dispatch\Enums\DispatchAttemptStatus;
use App\Modules\Dispatch\Enums\DispatchPlanApprovalStatus;
use App\Modules\Dispatch\Enums\DispatchPlanVersionStatus;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\ApprovalRequest;
use App\Modules\Dispatch\Models\DispatchAssignmentOffer;
use App\Modules\Dispatch\Models\DispatchExecutionAttempt;
use App\Modules\Dispatch\Models\DispatchHandoff;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Models\DispatchPlanApproval;
use App\Modules\Dispatch\Models\DispatchPlanVersion;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\PersonnelCredential;
use App\Platform\Identity\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    config([
        'dispatch.v2_commands_enabled' => true,
        'dispatch.phase3_commands_enabled' => true,
    ]);
    $this->seed(RolePermissionSeeder::class);
});

function createWebAdapterFixture(): array
{
    /** @var User $dispatcher */
    $dispatcher = User::factory()->create(['name' => 'Web Dispatcher', 'is_active' => true]);
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    /** @var User $manager */
    $manager = User::factory()->create(['name' => 'Web Manager', 'is_active' => true]);
    $manager->syncRoles([RoleName::OperationsManager->value]);

    /** @var User $worker */
    $worker = User::factory()->create(['name' => 'Web Worker', 'is_active' => true]);
    $worker->syncRoles([RoleName::Driver->value]);

    PersonnelCredential::query()->create([
        'user_id' => $worker->id,
        'kind' => 'driver_license',
        'credential_number' => 'WEB-DL-'.$worker->id,
        'credential_type' => 'professional',
        'status' => 'active',
        'issued_at' => now()->subYear(),
        'expires_at' => now()->addYear(),
    ]);

    $job = DispatchJob::query()->create([
        'reference' => 'WEB-JOB-001',
        'client' => 'Web Logistics',
        'title' => 'Web Interface Dispatch',
        'site' => 'Zone 1',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Draft,
        'scheduled_start' => now()->addHour(),
        'scheduled_end' => now()->addHours(2),
        'version' => 1,
        'created_by' => $dispatcher->id,
    ]);

    $handoff = DispatchHandoff::query()->create([
        'workspace_key' => 'operations',
        'source_type' => 'legacy_dispatch_job',
        'source_id' => $job->id,
        'source_reference' => $job->reference,
        'legacy_dispatch_job_id' => $job->id,
        'created_by' => $dispatcher->id,
        'compatibility_state' => 'v2_command',
    ]);

    $attempt = DispatchExecutionAttempt::query()->create([
        'handoff_id' => $handoff->id,
        'workspace_key' => 'operations',
        'attempt_number' => 1,
        'legacy_dispatch_job_id' => $job->id,
        'status' => DispatchAttemptStatus::Draft,
        'scheduled_start' => $job->scheduled_start,
        'scheduled_end' => $job->scheduled_end,
        'version' => 1,
        'created_by' => $dispatcher->id,
    ]);

    $plan = DispatchPlanVersion::query()->create([
        'attempt_id' => $attempt->id,
        'workspace_key' => 'operations',
        'version' => 1,
        'status' => DispatchPlanVersionStatus::Approved,
        'snapshot' => ['mandatory_assignments' => [['slot' => 'driver', 'assignment_type' => 'driver']]],
        'content_hash' => hash('sha256', 'web-plan-'.$attempt->id),
        'submitted_by' => $dispatcher->id,
        'submitted_at' => now(),
        'created_by' => $dispatcher->id,
    ]);

    DispatchPlanApproval::query()->create([
        'plan_version_id' => $plan->id,
        'kind' => 'plan_version',
        'status' => DispatchPlanApprovalStatus::Approved,
        'requested_by' => $dispatcher->id,
        'decided_by' => $manager->id,
        'decided_at' => now(),
        'reason' => 'Approved for web adapter test',
    ]);

    $offer = DispatchAssignmentOffer::query()->create([
        'attempt_id' => $attempt->id,
        'plan_version_id' => $plan->id,
        'workspace_key' => 'operations',
        'user_id' => $worker->id,
        'assignment_type' => 'driver',
        'is_mandatory' => true,
        'status' => DispatchAssignmentOfferStatus::Accepted,
        'offered_at' => now(),
        'accepted_at' => now(),
        'created_by' => $dispatcher->id,
    ]);

    $attempt->update([
        'designated_lead_offer_id' => $offer->id,
        'lead_designated_by' => $dispatcher->id,
        'lead_designated_at' => now(),
    ]);

    return compact('dispatcher', 'manager', 'worker', 'job', 'handoff', 'attempt', 'plan', 'offer');
}

it('routes web activate workflow through DispatchV2Commands::dispatch', function (): void {
    $fixture = createWebAdapterFixture();

    $response = $this->actingAs($fixture['dispatcher'])
        ->post("/operations/dispatch-jobs/{$fixture['job']->id}/activate", [
            'version' => 1,
        ]);

    $response->assertSessionDoesntHaveErrors();
    $response->assertRedirect();
    expect($fixture['attempt']->fresh()->status)->toBe(DispatchAttemptStatus::Dispatched)
        ->and($fixture['job']->fresh()->status)->toBe(DispatchStatus::Dispatched);
});

it('routes web cancel workflow through DispatchV2Commands::cancel', function (): void {
    $fixture = createWebAdapterFixture();

    $response = $this->actingAs($fixture['dispatcher'])
        ->post("/operations/dispatch-jobs/{$fixture['job']->id}/cancel", [
            'version' => 1,
            'reason' => 'Web cancellation reason',
        ]);

    $response->assertRedirect();
    expect($fixture['attempt']->fresh()->status)->toBe(DispatchAttemptStatus::Cancelled);
});

it('routes web reopen workflow through DispatchV2Commands::reopen', function (): void {
    $fixture = createWebAdapterFixture();
    $commands = app(DispatchV2Commands::class);
    $commands->cancel($fixture['dispatcher'], $fixture['attempt'], DispatchV2Mutation::forVersion(1, reason: 'Web cancel'));
    $fixture['attempt']->refresh();

    $response = $this->actingAs($fixture['manager'])
        ->post("/operations/dispatch-jobs/{$fixture['job']->id}/reopen", [
            'version' => $fixture['attempt']->version,
            'reason' => 'Web reopen reason',
        ]);

    $response->assertRedirect();
    expect(DispatchExecutionAttempt::query()->where('handoff_id', $fixture['handoff']->id)->count())->toBe(2);
});

it('routes web archive workflow through DispatchV2Commands::archive', function (): void {
    $fixture = createWebAdapterFixture();
    $commands = app(DispatchV2Commands::class);
    $commands->cancel($fixture['dispatcher'], $fixture['attempt'], DispatchV2Mutation::forVersion(1, reason: 'Web cancel'));
    $fixture['attempt']->refresh();

    /** @var User $admin */
    $admin = User::factory()->create(['name' => 'Web Admin', 'is_active' => true]);
    $admin->syncRoles([RoleName::SystemAdministrator->value]);

    $response = $this->actingAs($admin)
        ->post("/operations/dispatch-jobs/{$fixture['job']->id}/archive", [
            'version' => $fixture['attempt']->version,
            'reason' => 'Web archive reason',
        ]);

    $response->assertRedirect();
    expect($fixture['attempt']->fresh()->archived_at)->not->toBeNull();
});

it('routes web approval decision workflow through DispatchV2Commands::approvePlan', function (): void {
    $fixture = createWebAdapterFixture();
    $fixture['plan']->update(['status' => DispatchPlanVersionStatus::Submitted]);

    $approvalRequest = ApprovalRequest::query()->create([
        'subject_type' => DispatchJob::class,
        'subject_id' => $fixture['job']->id,
        'kind' => 'plan_version',
        'status' => ApprovalStatus::Pending,
        'requested_by' => $fixture['dispatcher']->id,
    ]);

    $planApproval = DispatchPlanApproval::query()->create([
        'plan_version_id' => $fixture['plan']->id,
        'approval_request_id' => $approvalRequest->id,
        'kind' => 'plan_version',
        'status' => DispatchPlanApprovalStatus::Pending,
        'requested_by' => $fixture['dispatcher']->id,
    ]);

    $response = $this->actingAs($fixture['manager'])
        ->post("/operations/approval-requests/{$approvalRequest->id}/decision", [
            'status' => 'approved',
            'reason' => 'Approved via web UI',
        ]);

    $response->assertRedirect();
    expect($fixture['plan']->fresh()->status)->toBe(DispatchPlanVersionStatus::Approved);
});
