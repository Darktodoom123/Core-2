<?php

use App\Modules\Assignment\Enums\AssignmentResponse;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Commands\DispatchV2Commands;
use App\Modules\Dispatch\Data\DispatchV2Mutation;
use App\Modules\Dispatch\Enums\DispatchAssignmentOfferStatus;
use App\Modules\Dispatch\Enums\DispatchAttemptStatus;
use App\Modules\Dispatch\Enums\DispatchPlanVersionStatus;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchAssignmentOffer;
use App\Modules\Dispatch\Models\DispatchExecutionAttempt;
use App\Modules\Dispatch\Models\DispatchHandoff;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Models\DispatchPlanVersion;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\PersonnelCredential;
use App\Platform\Identity\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    config([
        'dispatch.v2_commands_enabled' => true,
        'dispatch.phase3_commands_enabled' => true,
    ]);
    $this->seed(RolePermissionSeeder::class);
});

function createV1CompatFixture(): array
{
    /** @var User $dispatcher */
    $dispatcher = User::factory()->create(['name' => 'V1 Dispatcher', 'is_active' => true]);
    $dispatcher->syncRoles([RoleName::Dispatcher->value]);

    /** @var User $manager */
    $manager = User::factory()->create(['name' => 'V1 Manager', 'is_active' => true]);
    $manager->syncRoles([RoleName::OperationsManager->value]);

    /** @var User $leadWorker */
    $leadWorker = User::factory()->create(['name' => 'V1 Lead Worker', 'is_active' => true]);
    $leadWorker->syncRoles([RoleName::Driver->value]);

    /** @var User $otherWorker */
    $otherWorker = User::factory()->create(['name' => 'V1 Other Worker', 'is_active' => true]);
    $otherWorker->syncRoles([RoleName::Driver->value]);

    foreach ([$leadWorker, $otherWorker] as $worker) {
        PersonnelCredential::query()->create([
            'user_id' => $worker->id,
            'kind' => 'driver_license',
            'credential_number' => 'V1-DL-'.$worker->id,
            'credential_type' => 'professional',
            'status' => 'active',
            'issued_at' => now()->subYear(),
            'expires_at' => now()->addYear(),
        ]);
    }

    $job = DispatchJob::query()->create([
        'reference' => 'DISP-V1-'.Str::upper(Str::random(5)),
        'client' => 'Compat Logistics',
        'title' => 'V1 Mobile Compatibility Delivery',
        'site' => 'Dock 4',
        'site_notes' => 'Ring bell on arrival',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Dispatched,
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
        'status' => DispatchAttemptStatus::Dispatched,
        'scheduled_start' => now()->addHour(),
        'scheduled_end' => now()->addHours(3),
        'version' => 1,
        'created_by' => $dispatcher->id,
    ]);

    $plan = DispatchPlanVersion::query()->create([
        'attempt_id' => $attempt->id,
        'workspace_key' => 'operations',
        'version' => 1,
        'status' => DispatchPlanVersionStatus::Approved,
        'snapshot' => ['mandatory_assignments' => [['slot' => 'driver', 'assignment_type' => 'driver']]],
        'content_hash' => hash('sha256', 'v1-plan-'.$attempt->id),
        'submitted_by' => $dispatcher->id,
        'submitted_at' => now(),
        'created_by' => $dispatcher->id,
    ]);

    $legacyAssignment = DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $leadWorker->id,
        'assignment_type' => 'driver',
        'assigned_by' => $dispatcher->id,
        'response_status' => AssignmentResponse::Pending,
        'created_at' => now(),
    ]);

    $leadOffer = DispatchAssignmentOffer::query()->create([
        'attempt_id' => $attempt->id,
        'plan_version_id' => $plan->id,
        'workspace_key' => 'operations',
        'user_id' => $leadWorker->id,
        'legacy_assignment_id' => $legacyAssignment->id,
        'assignment_type' => 'driver',
        'is_mandatory' => true,
        'status' => DispatchAssignmentOfferStatus::Offered,
        'offered_at' => now(),
        'created_by' => $dispatcher->id,
    ]);

    $attempt->update([
        'designated_lead_offer_id' => $leadOffer->id,
        'lead_designated_by' => $dispatcher->id,
        'lead_designated_at' => now(),
    ]);

    return compact('dispatcher', 'manager', 'leadWorker', 'otherWorker', 'job', 'handoff', 'attempt', 'plan', 'legacyAssignment', 'leadOffer');
}

it('translates legacy status accepted to accepting the caller open offer without corrupting execution attempt status', function (): void {
    $fixture = createV1CompatFixture();
    $token = $fixture['leadWorker']->createToken('Mobile Token')->plainTextToken;
    $commandId = (string) Str::uuid();

    $response = $this->withToken($token)
        ->withHeader('Idempotency-Key', $commandId)
        ->postJson("/api/v1/dispatch-jobs/{$fixture['job']->id}/status", [
            'status' => 'accepted',
            'version' => 1,
            'command_id' => $commandId,
        ]);

    $response->assertOk()
        ->assertHeader('Deprecation', '@1755129600')
        ->assertHeader('Sunset', 'Sun, 14 Feb 2027 00:00:00 GMT')
        ->assertJsonPath('data.my_assignment.response_status', 'accepted');

    // Execution attempt status remains dispatched (not corrupted to accepted)
    expect($fixture['attempt']->fresh()->status)->toBe(DispatchAttemptStatus::Dispatched)
        ->and($fixture['leadOffer']->fresh()->status)->toBe(DispatchAssignmentOfferStatus::Accepted);
});

it('translates legacy status transitions to v2 progress commands for designated lead', function (): void {
    $fixture = createV1CompatFixture();
    $commands = app(DispatchV2Commands::class);
    $commands->acceptOffer($fixture['leadWorker'], $fixture['leadOffer'], DispatchV2Mutation::forVersion(1));
    $fixture['attempt']->refresh();

    $token = $fixture['leadWorker']->createToken('Mobile Token')->plainTextToken;
    $commandId = (string) Str::uuid();

    $response = $this->withToken($token)
        ->withHeader('Idempotency-Key', $commandId)
        ->postJson("/api/v1/dispatch-jobs/{$fixture['job']->id}/status", [
            'status' => 'en_route',
            'version' => $fixture['attempt']->version,
            'command_id' => $commandId,
        ]);

    $response->assertOk()
        ->assertJsonPath('data.status.value', 'en_route');

    expect($fixture['attempt']->fresh()->status)->toBe(DispatchAttemptStatus::EnRoute);
});

it('translates legacy assignment response endpoint to v2 accept/reject offer commands', function (): void {
    $fixture = createV1CompatFixture();
    $token = $fixture['leadWorker']->createToken('Mobile Token')->plainTextToken;
    $commandId = (string) Str::uuid();

    $response = $this->withToken($token)
        ->withHeader('Idempotency-Key', $commandId)
        ->postJson("/api/v1/dispatch-jobs/{$fixture['job']->id}/assignments/{$fixture['legacyAssignment']->id}/response", [
            'response' => 'accepted',
            'version' => 1,
            'command_id' => $commandId,
        ]);

    $response->assertOk()
        ->assertJsonPath('data.my_assignment.response_status', 'accepted');

    expect($fixture['leadOffer']->fresh()->status)->toBe(DispatchAssignmentOfferStatus::Accepted);
});

it('preserves 409 stale_version responses on v1 status transition conflicts', function (): void {
    $fixture = createV1CompatFixture();
    $commands = app(DispatchV2Commands::class);
    $commands->acceptOffer($fixture['leadWorker'], $fixture['leadOffer'], DispatchV2Mutation::forVersion(1));
    $fixture['attempt']->refresh();

    $token = $fixture['leadWorker']->createToken('Mobile Token')->plainTextToken;
    $commandId = (string) Str::uuid();

    $response = $this->withToken($token)
        ->withHeader('Idempotency-Key', $commandId)
        ->postJson("/api/v1/dispatch-jobs/{$fixture['job']->id}/status", [
            'status' => 'en_route',
            'version' => 999,
            'command_id' => $commandId,
        ]);

    $response->assertStatus(409)
        ->assertJsonPath('error', 'stale_version');
});
