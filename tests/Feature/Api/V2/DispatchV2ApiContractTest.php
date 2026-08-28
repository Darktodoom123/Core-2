<?php

use App\Modules\Dispatch\Commands\DispatchV2Commands;
use App\Modules\Dispatch\Data\DispatchV2Mutation;
use App\Modules\Dispatch\Enums\DispatchAssignmentOfferStatus;
use App\Modules\Dispatch\Enums\DispatchAttemptStatus;
use App\Modules\Dispatch\Enums\DispatchPlanApprovalStatus;
use App\Modules\Dispatch\Enums\DispatchPlanVersionStatus;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
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
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    config([
        'dispatch.v2_commands_enabled' => true,
        'dispatch.phase3_commands_enabled' => true,
    ]);
    $this->seed(RolePermissionSeeder::class);
});

function createV2User(RoleName $role, string $name, string $workspace = 'operations'): User
{
    /** @var User $user */
    $user = User::factory()->create(['name' => $name, 'is_active' => true]);
    $user->syncRoles([$role->value]);

    return $user;
}

/**
 * @return array{
 *     dispatcher: User,
 *     manager: User,
 *     leadWorker: User,
 *     secondWorker: User,
 *     job: DispatchJob,
 *     handoff: DispatchHandoff,
 *     attempt: DispatchExecutionAttempt,
 *     plan: DispatchPlanVersion,
 *     leadOffer: DispatchAssignmentOffer,
 *     secondOffer: DispatchAssignmentOffer
 * }
 */
function createV2Fixture(bool $approved = true, bool $acceptedOffers = true): array
{
    $dispatcher = createV2User(RoleName::OperationsManager, 'V2 Dispatcher');
    $manager = createV2User(RoleName::OperationsManager, 'V2 Manager');
    $leadWorker = createV2User(RoleName::Driver, 'V2 Lead Driver');
    $secondWorker = createV2User(RoleName::Driver, 'V2 Second Driver');

    foreach ([$leadWorker, $secondWorker] as $worker) {
        PersonnelCredential::query()->create([
            'user_id' => $worker->id,
            'kind' => 'driver_license',
            'credential_number' => 'V2-DL-'.$worker->id,
            'credential_type' => 'professional',
            'status' => 'active',
            'issued_at' => now()->subYear(),
            'expires_at' => now()->addYear(),
        ]);
    }

    $job = DispatchJob::query()->create([
        'reference' => 'V2-JOB-'.Str::upper(Str::random(6)),
        'client' => 'V2 Enterprise Client',
        'title' => 'V2 Heavy Equipment Transport',
        'site' => 'Zone 9',
        'site_notes' => 'Deliver via North Gate',
        'priority' => DispatchPriority::Priority,
        'status' => DispatchStatus::Draft,
        'scheduled_start' => now()->addHour(),
        'scheduled_end' => now()->addHours(3),
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
        'status' => $approved ? DispatchPlanVersionStatus::Approved : DispatchPlanVersionStatus::Draft,
        'snapshot' => [
            'mandatory_assignments' => [
                ['slot' => 'lead_driver', 'assignment_type' => 'driver'],
                ['slot' => 'support_driver', 'assignment_type' => 'driver'],
            ],
        ],
        'content_hash' => hash('sha256', 'v2-plan-'.$attempt->id),
        'submitted_by' => $dispatcher->id,
        'submitted_at' => now(),
        'created_by' => $dispatcher->id,
    ]);

    if ($approved) {
        DispatchPlanApproval::query()->create([
            'plan_version_id' => $plan->id,
            'kind' => 'plan_version',
            'status' => DispatchPlanApprovalStatus::Approved,
            'requested_by' => $dispatcher->id,
            'decided_by' => $manager->id,
            'decided_at' => now(),
            'reason' => 'Approved for test execution',
        ]);
    }

    $leadOffer = DispatchAssignmentOffer::query()->create([
        'attempt_id' => $attempt->id,
        'plan_version_id' => $plan->id,
        'workspace_key' => 'operations',
        'user_id' => $leadWorker->id,
        'assignment_type' => 'driver',
        'is_mandatory' => true,
        'status' => $acceptedOffers ? DispatchAssignmentOfferStatus::Accepted : DispatchAssignmentOfferStatus::Offered,
        'offered_at' => now(),
        'accepted_at' => $acceptedOffers ? now() : null,
        'created_by' => $dispatcher->id,
    ]);

    $secondOffer = DispatchAssignmentOffer::query()->create([
        'attempt_id' => $attempt->id,
        'plan_version_id' => $plan->id,
        'workspace_key' => 'operations',
        'user_id' => $secondWorker->id,
        'assignment_type' => 'driver',
        'is_mandatory' => true,
        'status' => $acceptedOffers ? DispatchAssignmentOfferStatus::Accepted : DispatchAssignmentOfferStatus::Offered,
        'offered_at' => now(),
        'accepted_at' => $acceptedOffers ? now() : null,
        'created_by' => $dispatcher->id,
    ]);

    if ($acceptedOffers) {
        $attempt->update([
            'designated_lead_offer_id' => $leadOffer->id,
            'lead_designated_by' => $dispatcher->id,
            'lead_designated_at' => now(),
        ]);
    }

    return compact('dispatcher', 'manager', 'leadWorker', 'secondWorker', 'job', 'handoff', 'attempt', 'plan', 'leadOffer', 'secondOffer');
}

it('lists dispatch jobs in v2 with execution status, readiness summary, and designated lead', function (): void {
    $fixture = createV2Fixture();
    $token = $fixture['dispatcher']->createToken('v2-token')->plainTextToken;

    $response = $this->withToken($token)->getJson('/api/v2/dispatch-jobs');

    $response->assertOk()
        ->assertJsonStructure([
            'data' => [
                '*' => [
                    'id',
                    'reference',
                    'title',
                    'client',
                    'status',
                    'version',
                    'designated_lead' => ['user_id', 'user_name'],
                    'readiness' => ['ready', 'blocking_codes'],
                ],
            ],
        ]);
});

it('shows complete v2 dispatch job details with attempts, offers, plan, and actor capabilities', function (): void {
    $fixture = createV2Fixture();
    $token = $fixture['leadWorker']->createToken('v2-token')->plainTextToken;

    $response = $this->withToken($token)->getJson("/api/v2/dispatch-jobs/{$fixture['job']->id}");

    $response->assertOk()
        ->assertJsonPath('data.reference', $fixture['job']->reference)
        ->assertJsonPath('data.status', 'draft')
        ->assertJsonPath('data.version', 1)
        ->assertJsonPath('data.designated_lead.user_id', $fixture['leadWorker']->id)
        ->assertJsonPath('data.offers.0.user_id', $fixture['leadWorker']->id)
        ->assertJsonPath('data.plan.status', 'approved')
        ->assertJsonPath('data.capabilities.is_designated_lead', true);
});

it('evaluates readiness via dedicated v2 readiness endpoint', function (): void {
    $fixture = createV2Fixture();
    $token = $fixture['dispatcher']->createToken('v2-token')->plainTextToken;

    $response = $this->withToken($token)->getJson("/api/v2/dispatch-jobs/{$fixture['job']->id}/readiness");

    $response->assertOk()
        ->assertJsonPath('data.ready', true)
        ->assertJsonPath('data.blocking_codes', [])
        ->assertJsonPath('data.plan_status', 'approved');
});

it('dispatches a draft attempt via v2 dispatch endpoint when readiness requirements are met', function (): void {
    $fixture = createV2Fixture(approved: true, acceptedOffers: true);
    $token = $fixture['dispatcher']->createToken('v2-token')->plainTextToken;
    $commandId = (string) Str::uuid();

    $response = $this->withToken($token)
        ->withHeader('Idempotency-Key', $commandId)
        ->postJson("/api/v2/dispatch-jobs/{$fixture['job']->id}/dispatch", [
            'version' => 1,
            'command_id' => $commandId,
        ]);

    $response->assertOk()
        ->assertJsonPath('data.status', 'dispatched')
        ->assertJsonPath('data.version', 2);

    expect($fixture['attempt']->fresh()->status)->toBe(DispatchAttemptStatus::Dispatched);
});

it('rejects dispatching when readiness requirements are violated', function (): void {
    $fixture = createV2Fixture(approved: false, acceptedOffers: false);
    $token = $fixture['dispatcher']->createToken('v2-token')->plainTextToken;

    $response = $this->withToken($token)->postJson("/api/v2/dispatch-jobs/{$fixture['job']->id}/dispatch", [
        'version' => 1,
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['readiness']);
});

it('allows the designated lead to progress execution lifecycle through v2 progress endpoint', function (): void {
    $fixture = createV2Fixture();
    $commands = app(DispatchV2Commands::class);
    $commands->dispatch($fixture['dispatcher'], $fixture['attempt'], DispatchV2Mutation::forVersion(1));
    $fixture['attempt']->refresh();

    $token = $fixture['leadWorker']->createToken('v2-token')->plainTextToken;
    $commandId = (string) Str::uuid();

    $response = $this->withToken($token)
        ->withHeader('Idempotency-Key', $commandId)
        ->postJson("/api/v2/dispatch-jobs/{$fixture['job']->id}/progress", [
            'status' => 'en_route',
            'version' => $fixture['attempt']->version,
            'command_id' => $commandId,
        ]);

    $response->assertOk()
        ->assertJsonPath('data.status', 'en_route');

    expect($fixture['attempt']->fresh()->status)->toBe(DispatchAttemptStatus::EnRoute);
});

it('forbids non-lead worker from progressing execution lifecycle in v2', function (): void {
    $fixture = createV2Fixture();
    $commands = app(DispatchV2Commands::class);
    $commands->dispatch($fixture['dispatcher'], $fixture['attempt'], DispatchV2Mutation::forVersion(1));
    $fixture['attempt']->refresh();

    $token = $fixture['secondWorker']->createToken('v2-token')->plainTextToken;

    $response = $this->withToken($token)->postJson("/api/v2/dispatch-jobs/{$fixture['job']->id}/progress", [
        'status' => 'en_route',
        'version' => $fixture['attempt']->version,
    ]);

    $response->assertStatus(403);
});

it('cancels an attempt via v2 cancel endpoint with mandatory reason', function (): void {
    $fixture = createV2Fixture();
    $token = $fixture['dispatcher']->createToken('v2-token')->plainTextToken;

    // Fails without reason
    $this->withToken($token)->postJson("/api/v2/dispatch-jobs/{$fixture['job']->id}/cancel", [
        'version' => 1,
    ])->assertStatus(422)->assertJsonValidationErrors(['reason']);

    // Succeeds with reason
    $response = $this->withToken($token)->postJson("/api/v2/dispatch-jobs/{$fixture['job']->id}/cancel", [
        'version' => 1,
        'reason' => 'Customer requested cancellation',
    ]);

    $response->assertOk()
        ->assertJsonPath('data.status', 'cancelled');

    expect($fixture['attempt']->fresh()->status)->toBe(DispatchAttemptStatus::Cancelled);
});

it('reopens a cancelled attempt into a new monotonic attempt via v2 reopen endpoint', function (): void {
    $fixture = createV2Fixture();
    $commands = app(DispatchV2Commands::class);
    $commands->cancel($fixture['dispatcher'], $fixture['attempt'], DispatchV2Mutation::forVersion(1, reason: 'Test cancel'));
    $fixture['attempt']->refresh();

    $token = $fixture['manager']->createToken('v2-token')->plainTextToken;

    $response = $this->withToken($token)->postJson("/api/v2/dispatch-jobs/{$fixture['job']->id}/reopen", [
        'version' => $fixture['attempt']->version,
        'reason' => 'Reopening for rescheduled trip',
    ]);

    $response->assertOk()
        ->assertJsonPath('data.status', 'draft')
        ->assertJsonPath('data.attempt_number', 2);

    expect(DispatchExecutionAttempt::query()->where('handoff_id', $fixture['handoff']->id)->count())->toBe(2);
});

it('archives a terminal attempt via v2 archive endpoint', function (): void {
    $fixture = createV2Fixture();
    $commands = app(DispatchV2Commands::class);
    $commands->cancel($fixture['dispatcher'], $fixture['attempt'], DispatchV2Mutation::forVersion(1, reason: 'Cancelled for archive test'));
    $fixture['attempt']->refresh();

    $admin = createV2User(RoleName::SystemAdministrator, 'V2 Admin');
    $token = $admin->createToken('v2-token')->plainTextToken;

    $response = $this->withToken($token)->postJson("/api/v2/dispatch-jobs/{$fixture['job']->id}/archive", [
        'version' => $fixture['attempt']->version,
        'reason' => 'Archiving cancelled attempt',
    ]);

    $response->assertOk()
        ->assertJsonPath('data.is_archived', true);

    expect($fixture['attempt']->fresh()->archived_at)->not->toBeNull();
});

it('handles assignment offer acceptance, rejection, and withdrawal via v2 offer endpoints', function (): void {
    $fixture = createV2Fixture(approved: true, acceptedOffers: false);
    $workerToken = $fixture['leadWorker']->createToken('v2-token')->plainTextToken;

    // Lead worker accepts offer
    $response = $this->withToken($workerToken)->postJson(
        "/api/v2/dispatch-jobs/{$fixture['job']->id}/offers/{$fixture['leadOffer']->id}/accept",
        ['version' => $fixture['attempt']->version]
    );

    $response->assertOk()
        ->assertJsonPath('data.offer.status', 'accepted');

    expect($fixture['leadOffer']->fresh()->status)->toBe(DispatchAssignmentOfferStatus::Accepted);

    // Second worker rejects offer
    $this->app->make('auth')->forgetGuards();
    $secondWorkerToken = $fixture['secondWorker']->createToken('v2-token')->plainTextToken;
    $rejectResponse = $this->withToken($secondWorkerToken)->postJson(
        "/api/v2/dispatch-jobs/{$fixture['job']->id}/offers/{$fixture['secondOffer']->id}/reject",
        [
            'version' => $fixture['attempt']->fresh()->version,
            'reason' => 'Unavailable due to maintenance schedule',
        ]
    );

    $rejectResponse->assertOk()
        ->assertJsonPath('data.offer.status', 'rejected');

    expect($fixture['secondOffer']->fresh()->status)->toBe(DispatchAssignmentOfferStatus::Rejected);
});

it('designates and replaces lead driver via v2 lead endpoint', function (): void {
    $fixture = createV2Fixture(approved: true, acceptedOffers: true);
    $token = $fixture['dispatcher']->createToken('v2-token')->plainTextToken;

    // Designate second worker as lead
    $response = $this->withToken($token)->postJson("/api/v2/dispatch-jobs/{$fixture['job']->id}/lead", [
        'offer_id' => $fixture['secondOffer']->id,
        'reason' => 'Shift reassignment',
        'version' => $fixture['attempt']->version,
    ]);

    $response->assertOk()
        ->assertJsonPath('data.designated_lead.user_id', $fixture['secondWorker']->id);

    expect($fixture['attempt']->fresh()->designated_lead_offer_id)->toBe($fixture['secondOffer']->id);
});

it('enforces expected version optimistic locking and returns 409 stale_version on conflict in v2', function (): void {
    $fixture = createV2Fixture();
    $token = $fixture['dispatcher']->createToken('v2-token')->plainTextToken;

    $response = $this->withToken($token)->postJson("/api/v2/dispatch-jobs/{$fixture['job']->id}/cancel", [
        'version' => 999, // Stale version
        'reason' => 'Stale cancellation',
    ]);

    $response->assertStatus(409)
        ->assertJsonPath('error', 'stale_version')
        ->assertJsonPath('current_version', 1);
});

it('replays idempotent requests in v2 without duplicate execution or side effects', function (): void {
    $fixture = createV2Fixture();
    $token = $fixture['dispatcher']->createToken('v2-token')->plainTextToken;
    $commandId = (string) Str::uuid();

    $first = $this->withToken($token)
        ->withHeader('Idempotency-Key', $commandId)
        ->postJson("/api/v2/dispatch-jobs/{$fixture['job']->id}/cancel", [
            'version' => 1,
            'reason' => 'Idempotent cancellation test',
            'command_id' => $commandId,
        ]);

    $first->assertOk()->assertJsonPath('data.status', 'cancelled');

    $replay = $this->withToken($token)
        ->withHeader('Idempotency-Key', $commandId)
        ->postJson("/api/v2/dispatch-jobs/{$fixture['job']->id}/cancel", [
            'version' => 1,
            'reason' => 'Idempotent cancellation test',
            'command_id' => $commandId,
        ]);

    $replay->assertOk()->assertJsonPath('data.status', 'cancelled');
    expect($replay->json('data.version'))->toBe($first->json('data.version'));
});
