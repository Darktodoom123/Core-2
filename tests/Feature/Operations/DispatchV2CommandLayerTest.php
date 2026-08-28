<?php

use App\Modules\Dispatch\Data\DispatchV2Mutation;
use App\Modules\Dispatch\Enums\DispatchAssignmentOfferStatus;
use App\Modules\Dispatch\Enums\DispatchAttemptStatus;
use App\Modules\Dispatch\Enums\DispatchPlanApprovalStatus;
use App\Modules\Dispatch\Enums\DispatchPlanVersionStatus;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Enums\DispatchV2CommandCode;
use App\Modules\Dispatch\Events\DispatchExecutionTransitioned;
use App\Modules\Dispatch\Exceptions\DispatchV2CommandException;
use App\Modules\Dispatch\Models\DispatchAssignmentOffer;
use App\Modules\Dispatch\Models\DispatchAuditLineage;
use App\Modules\Dispatch\Models\DispatchExecutionAttempt;
use App\Modules\Dispatch\Models\DispatchHandoff;
use App\Modules\Dispatch\Models\DispatchIdempotencyKey;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Models\DispatchPlanApproval;
use App\Modules\Dispatch\Models\DispatchPlanVersion;
use App\Modules\Dispatch\Queries\DispatchV2ReadinessQuery;
use App\Modules\Dispatch\Services\DispatchV2CommandService;
use App\Platform\Audit\Contracts\AuditEventRecorder;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Schema;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    config(['dispatch.v2_commands_enabled' => true]);
    $this->seed(RolePermissionSeeder::class);
});

function v2CommandUser(RoleName $role, string $name): User
{
    /** @var User $user */
    $user = User::factory()->create(['name' => $name, 'is_active' => true]);
    $user->syncRoles([$role->value]);

    return $user;
}

/** @return array{job: DispatchJob, handoff: DispatchHandoff, attempt: DispatchExecutionAttempt, plan: DispatchPlanVersion, leadOffer: DispatchAssignmentOffer} */
function v2ReadyAggregate(User $creator, User $lead, string $workspace = 'operations'): array
{
    $job = DispatchJob::query()->create([
        'reference' => 'V2-CMD-'.uniqid(),
        'client' => 'Command Customer',
        'title' => 'Command dispatch',
        'site' => 'Command site',
        'scheduled_start' => now()->addHour(),
        'scheduled_end' => now()->addHours(2),
        'priority' => 'routine',
        'status' => DispatchStatus::Draft,
        'version' => 1,
        'created_by' => $creator->id,
    ]);
    $handoff = DispatchHandoff::query()->create([
        'workspace_key' => $workspace,
        'source_type' => 'legacy_dispatch_job',
        'source_id' => $job->id,
        'source_reference' => $job->reference,
        'legacy_dispatch_job_id' => $job->id,
        'created_by' => $creator->id,
        'compatibility_state' => 'v2_command',
    ]);
    $attempt = DispatchExecutionAttempt::query()->create([
        'handoff_id' => $handoff->id,
        'workspace_key' => $workspace,
        'attempt_number' => 1,
        'status' => DispatchAttemptStatus::Draft,
        'scheduled_start' => $job->scheduled_start,
        'scheduled_end' => $job->scheduled_end,
        'version' => 1,
        'created_by' => $creator->id,
    ]);
    $plan = DispatchPlanVersion::query()->create([
        'attempt_id' => $attempt->id,
        'workspace_key' => $workspace,
        'version' => 1,
        'status' => DispatchPlanVersionStatus::Approved,
        'snapshot' => ['mandatory_assignments' => ['lead']],
        'content_hash' => hash('sha256', 'ready-plan-'.$attempt->id),
        'scheduled_start' => $job->scheduled_start,
        'scheduled_end' => $job->scheduled_end,
        'created_by' => $creator->id,
    ]);
    DispatchPlanApproval::query()->create([
        'plan_version_id' => $plan->id,
        'kind' => 'plan_approval',
        'status' => DispatchPlanApprovalStatus::Approved,
        'requested_by' => $creator->id,
        'decided_by' => $creator->id,
        'reason' => 'Fixture approval',
        'decided_at' => now(),
    ]);
    $leadOffer = DispatchAssignmentOffer::query()->create([
        'attempt_id' => $attempt->id,
        'plan_version_id' => $plan->id,
        'workspace_key' => $workspace,
        'user_id' => $lead->id,
        'assignment_type' => 'lead',
        'is_mandatory' => true,
        'status' => DispatchAssignmentOfferStatus::Accepted,
        'accepted_at' => now(),
        'created_by' => $creator->id,
    ]);
    $attempt->update([
        'designated_lead_offer_id' => $leadOffer->id,
        'lead_designated_by' => $creator->id,
        'lead_designated_at' => now(),
    ]);

    return compact('job', 'handoff', 'attempt', 'plan', 'leadOffer');
}

function v2Mutation(int $version, ?string $key = null, ?string $reason = null, array $payload = []): DispatchV2Mutation
{
    return new DispatchV2Mutation($version, $key, 'operations', $reason, $payload);
}

it('executes the target lifecycle and never exposes job-level accepted', function (): void {
    $dispatcher = v2CommandUser(RoleName::OperationsManager, 'V2 Dispatcher');
    $lead = v2CommandUser(RoleName::Driver, 'V2 Lead');
    $aggregate = v2ReadyAggregate($dispatcher, $lead);
    $commands = app(DispatchV2CommandService::class);

    $attempt = $commands->dispatch($dispatcher, $aggregate['attempt'], v2Mutation(1));
    expect($attempt->status)->toBe(DispatchAttemptStatus::Dispatched)->and($attempt->version)->toBe(2);

    foreach ([DispatchAttemptStatus::EnRoute, DispatchAttemptStatus::Arrived, DispatchAttemptStatus::Working, DispatchAttemptStatus::Completed] as $version => $next) {
        $attempt = $commands->progress($lead, $attempt, $next, v2Mutation($version + 2));
    }

    expect($attempt->status)->toBe(DispatchAttemptStatus::Completed)
        ->and($attempt->version)->toBe(6)
        ->and(DispatchAttemptStatus::tryFrom('accepted'))->toBeNull()
        ->and(AuditEvent::query()->where('subject_id', $attempt->id)->count())->toBe(5)
        ->and(DispatchAuditLineage::query()->where('attempt_id', $attempt->id)->count())->toBe(5);

    expect(fn (): DispatchExecutionAttempt => $commands->progress($lead, $attempt, DispatchAttemptStatus::EnRoute, v2Mutation(6)))
        ->toThrow(fn (DispatchV2CommandException $exception): bool => $exception->getErrorCode() === DispatchV2CommandCode::TerminalRecord);
    expect(fn (): DispatchExecutionAttempt => $commands->cancel($dispatcher, $attempt, v2Mutation(6, null, 'Too late')))
        ->toThrow(fn (DispatchV2CommandException $exception): bool => $exception->getErrorCode() === DispatchV2CommandCode::TerminalRecord);

    $cancelledAggregate = v2ReadyAggregate($dispatcher, $lead);
    $cancelled = $commands->cancel($dispatcher, $cancelledAggregate['attempt'], v2Mutation(1, null, 'Cancellation matrix'));
    expect(fn (): DispatchExecutionAttempt => $commands->progress($lead, $cancelled, DispatchAttemptStatus::EnRoute, v2Mutation(2)))
        ->toThrow(fn (DispatchV2CommandException $exception): bool => $exception->getErrorCode() === DispatchV2CommandCode::TerminalRecord);
    expect(fn (): DispatchExecutionAttempt => $commands->cancel($dispatcher, $cancelled, v2Mutation(2, null, 'Repeated cancellation')))
        ->toThrow(fn (DispatchV2CommandException $exception): bool => $exception->getErrorCode() === DispatchV2CommandCode::TerminalRecord);
});

it('returns deterministic readiness blockers and derived labels without mutating lifecycle state', function (): void {
    $dispatcher = v2CommandUser(RoleName::OperationsManager, 'Readiness Dispatcher');
    $lead = v2CommandUser(RoleName::Driver, 'Readiness Lead');
    $aggregate = v2ReadyAggregate($dispatcher, $lead);
    $aggregate['attempt']->update([
        'scheduled_start' => null,
        'scheduled_end' => null,
        'designated_lead_offer_id' => null,
    ]);
    $aggregate['plan']->update([
        'status' => DispatchPlanVersionStatus::Submitted,
        'scheduled_start' => null,
        'scheduled_end' => null,
        'snapshot' => [
            'mandatory_assignments' => ['driver', 'operator'],
            'assets' => [['available' => false, 'safe' => false]],
        ],
    ]);
    $aggregate['leadOffer']->delete();
    $aggregate['attempt']->refresh();
    $auditCount = AuditEvent::query()->count();
    $version = $aggregate['attempt']->version;

    $projection = app(DispatchV2ReadinessQuery::class)->handle($dispatcher, $aggregate['attempt']);
    $codes = array_map(static fn ($blocker): string => $blocker->code->value, $projection->blockers);

    expect($codes)->toBe([
        'missing_schedule',
        'missing_mandatory_assignment',
        'no_designated_lead',
        'approval_required',
        'asset_unavailable',
        'asset_unsafe',
    ])->and($projection->ready)->toBeFalse()
        ->and($projection->scheduled)->toBeFalse()
        ->and($projection->awaitingApproval)->toBeTrue()
        ->and($projection->labels)->toBe(['awaiting_approval'])
        ->and($aggregate['attempt']->fresh()->version)->toBe($version)
        ->and(AuditEvent::query()->count())->toBe($auditCount);
});

it('derives scheduled and awaiting approval labels from facts, never from lifecycle writes', function (): void {
    $dispatcher = v2CommandUser(RoleName::OperationsManager, 'Derived Dispatcher');
    $lead = v2CommandUser(RoleName::Driver, 'Derived Lead');
    $aggregate = v2ReadyAggregate($dispatcher, $lead);
    $aggregate['plan']->update(['status' => DispatchPlanVersionStatus::Submitted]);
    $aggregate['attempt']->refresh();

    $projection = app(DispatchV2ReadinessQuery::class)->handle($dispatcher, $aggregate['attempt']);

    expect($projection->scheduled)->toBeTrue()
        ->and($projection->awaitingApproval)->toBeTrue()
        ->and($projection->labels)->toBe(['scheduled', 'awaiting_approval'])
        ->and($aggregate['attempt']->fresh()->status)->toBe(DispatchAttemptStatus::Draft);
});

it('submits and approves plan versions through the same aggregate version envelope', function (): void {
    $dispatcher = v2CommandUser(RoleName::OperationsManager, 'Plan Dispatcher');
    $manager = v2CommandUser(RoleName::OperationsManager, 'Plan Manager');
    $lead = v2CommandUser(RoleName::Driver, 'Plan Lead');
    $aggregate = v2ReadyAggregate($dispatcher, $lead);
    $aggregate['plan']->update(['status' => DispatchPlanVersionStatus::Draft]);
    $commands = app(DispatchV2CommandService::class);

    $submitted = $commands->submitPlan($dispatcher, $aggregate['attempt'], v2Mutation(1, null, 'Submit plan', [
        'snapshot' => ['mandatory_assignments' => ['lead']],
    ]));
    expect($submitted->status)->toBe(DispatchPlanVersionStatus::Submitted)
        ->and($aggregate['attempt']->fresh()->version)->toBe(2);

    $approval = $commands->approvePlan($manager, $aggregate['attempt'], v2Mutation(2, null, 'Manager approval'));
    expect($approval->status)->toBe(DispatchPlanApprovalStatus::Approved)
        ->and($approval->planVersion->status)->toBe(DispatchPlanVersionStatus::Approved)
        ->and($aggregate['attempt']->fresh()->version)->toBe(3);

    $dispatched = $commands->dispatch($dispatcher, $aggregate['attempt'], v2Mutation(3));
    expect($dispatched->status)->toBe(DispatchAttemptStatus::Dispatched);
});

it('enforces stale versions, replay ownership, payload mismatch, authorization, and object scope', function (): void {
    $dispatcher = v2CommandUser(RoleName::OperationsManager, 'Conflict Dispatcher');
    $lead = v2CommandUser(RoleName::Driver, 'Conflict Lead');
    $intruder = User::factory()->create(['name' => 'Untrusted User', 'is_active' => true]);
    $aggregate = v2ReadyAggregate($dispatcher, $lead);
    $commands = app(DispatchV2CommandService::class);

    expect(fn (): DispatchExecutionAttempt => $commands->cancel($dispatcher, $aggregate['attempt'], v2Mutation(99, null, 'Weather')))
        ->toThrow(fn (DispatchV2CommandException $exception): bool => $exception->getErrorCode() === DispatchV2CommandCode::StaleVersion);
    expect(fn (): DispatchExecutionAttempt => $commands->cancel($intruder, $aggregate['attempt'], v2Mutation(1, null, 'Weather')))
        ->toThrow(fn (DispatchV2CommandException $exception): bool => $exception->getErrorCode() === DispatchV2CommandCode::Forbidden
            && ! str_contains($exception->getMessage(), (string) $aggregate['attempt']->id));

    $first = $commands->cancel($dispatcher, $aggregate['attempt'], v2Mutation(1, 'cancel-key', 'Weather'));
    $replay = $commands->cancel($dispatcher, $aggregate['attempt'], v2Mutation(1, 'cancel-key', 'Weather'));
    expect($replay->id)->toBe($first->id)->and($replay->version)->toBe(2)
        ->and(AuditEvent::query()->where('subject_id', $first->id)->count())->toBe(1)
        ->and(DispatchIdempotencyKey::query()->where('idempotency_key', 'cancel-key')->count())->toBe(1);

    expect(fn (): DispatchExecutionAttempt => $commands->cancel($dispatcher, $aggregate['attempt'], v2Mutation(2, 'cancel-key', 'Different reason')))
        ->toThrow(fn (DispatchV2CommandException $exception): bool => $exception->getErrorCode() === DispatchV2CommandCode::IdempotencyPayloadMismatch);

    $other = v2ReadyAggregate($dispatcher, $lead, 'private');
    expect(fn (): DispatchExecutionAttempt => $commands->cancel($dispatcher, $other['attempt'], new DispatchV2Mutation(1, null, 'operations', 'No access')))
        ->toThrow(fn (DispatchV2CommandException $exception): bool => $exception->getErrorCode() === DispatchV2CommandCode::ObjectNotFound);
});

it('rolls back state, audit, lineage, and idempotency together when audit recording fails', function (): void {
    $dispatcher = v2CommandUser(RoleName::OperationsManager, 'Rollback Dispatcher');
    $lead = v2CommandUser(RoleName::Driver, 'Rollback Lead');
    $aggregate = v2ReadyAggregate($dispatcher, $lead);
    $audit = Mockery::mock(AuditEventRecorder::class);
    $audit->shouldReceive('handle')->once()->andThrow(new RuntimeException('audit failure'));
    $this->app->instance(AuditEventRecorder::class, $audit);

    expect(fn (): DispatchExecutionAttempt => app(DispatchV2CommandService::class)->cancel($dispatcher, $aggregate['attempt'], v2Mutation(1, 'rollback-key', 'Rollback test')))
        ->toThrow(RuntimeException::class);

    expect($aggregate['attempt']->fresh()->status)->toBe(DispatchAttemptStatus::Draft)
        ->and($aggregate['attempt']->fresh()->version)->toBe(1)
        ->and(AuditEvent::query()->where('subject_id', $aggregate['attempt']->id)->count())->toBe(0)
        ->and(DispatchAuditLineage::query()->where('attempt_id', $aggregate['attempt']->id)->count())->toBe(0)
        ->and(DispatchIdempotencyKey::query()->where('idempotency_key', 'rollback-key')->count())->toBe(0);
});

it('keeps domain events after commit and does not publish one for an idempotent replay', function (): void {
    $dispatcher = v2CommandUser(RoleName::OperationsManager, 'Event Dispatcher');
    $lead = v2CommandUser(RoleName::Driver, 'Event Lead');
    $aggregate = v2ReadyAggregate($dispatcher, $lead);
    Event::fake([DispatchExecutionTransitioned::class]);
    $commands = app(DispatchV2CommandService::class);

    DB::beginTransaction();
    $commands->cancel($dispatcher, $aggregate['attempt'], v2Mutation(1, 'event-key', 'Event test'));
    Event::assertNotDispatched(DispatchExecutionTransitioned::class);
    DB::rollBack();

    expect($aggregate['attempt']->fresh()->status)->toBe(DispatchAttemptStatus::Draft);
    $commands->cancel($dispatcher, $aggregate['attempt'], v2Mutation(1, 'event-key', 'Event test'));
    $commands->cancel($dispatcher, $aggregate['attempt'], v2Mutation(1, 'event-key', 'Event test'));
    Event::assertDispatchedTimes(DispatchExecutionTransitioned::class, 1);
});

it('reopens as a new draft attempt and archives only terminal records', function (): void {
    $dispatcher = v2CommandUser(RoleName::OperationsManager, 'Archive Dispatcher');
    $manager = v2CommandUser(RoleName::OperationsManager, 'Archive Manager');
    $admin = v2CommandUser(RoleName::SystemAdministrator, 'Archive Admin');
    $lead = v2CommandUser(RoleName::Driver, 'Archive Lead');
    $aggregate = v2ReadyAggregate($dispatcher, $lead);
    $commands = app(DispatchV2CommandService::class);

    $cancelled = $commands->cancel($dispatcher, $aggregate['attempt'], v2Mutation(1, null, 'Weather'));
    $replacement = $commands->reopen($manager, $cancelled, v2Mutation(2, null, 'Weather cleared'));
    expect($cancelled->fresh()->status)->toBe(DispatchAttemptStatus::Cancelled)
        ->and($replacement->status)->toBe(DispatchAttemptStatus::Draft)
        ->and($replacement->attempt_number)->toBe(2)
        ->and($replacement->replaces_attempt_id)->toBe($cancelled->id);

    $archived = $commands->archive($admin, $cancelled, v2Mutation(2, null, 'Retention policy'));
    expect($archived->status)->toBe(DispatchAttemptStatus::Cancelled)
        ->and($archived->archived_at)->not->toBeNull()
        ->and(DispatchExecutionAttempt::query()->whereKey($cancelled->id)->exists())->toBeTrue();
    expect(fn (): DispatchExecutionAttempt => $commands->cancel($dispatcher, $archived, v2Mutation(3, null, 'No mutation')))
        ->toThrow(fn (DispatchV2CommandException $exception): bool => $exception->getErrorCode() === DispatchV2CommandCode::ArchivedRecord);
});

it('creates a canonical attempt and plan without changing the legacy adapter record', function (): void {
    $dispatcher = v2CommandUser(RoleName::OperationsManager, 'Create Dispatcher');
    $job = DispatchJob::query()->create([
        'reference' => 'V2-CREATE-'.uniqid(),
        'client' => 'Create Customer',
        'title' => 'Create dispatch',
        'site' => 'Create site',
        'scheduled_start' => now()->addHour(),
        'scheduled_end' => now()->addHours(2),
        'priority' => 'routine',
        'status' => DispatchStatus::Draft,
        'version' => 1,
        'created_by' => $dispatcher->id,
    ]);
    $commands = app(DispatchV2CommandService::class);

    $attempt = $commands->create($dispatcher, $job, v2Mutation(1, 'create-key', 'Create command', ['plan_snapshot' => ['mandatory_assignments' => ['lead']]]));

    expect($attempt->status)->toBe(DispatchAttemptStatus::Draft)
        ->and($attempt->version)->toBe(1)
        ->and($attempt->handoff_id)->not->toBeNull()
        ->and($attempt->planVersions()->count())->toBe(1)
        ->and($job->fresh()->status)->toBe(DispatchStatus::Draft)
        ->and($job->fresh()->version)->toBe(1)
        ->and(DispatchIdempotencyKey::query()->where('idempotency_key', 'create-key')->value('status'))->toBe('completed');
});

it('honors the command feature flag while leaving the legacy path available', function (): void {
    $dispatcher = v2CommandUser(RoleName::OperationsManager, 'Flag Dispatcher');
    $lead = v2CommandUser(RoleName::Driver, 'Flag Lead');
    $aggregate = v2ReadyAggregate($dispatcher, $lead);
    config(['dispatch.v2_commands_enabled' => false]);

    expect(fn (): DispatchExecutionAttempt => app(DispatchV2CommandService::class)->cancel($dispatcher, $aggregate['attempt'], v2Mutation(1, null, 'Flag off')))
        ->toThrow(fn (DispatchV2CommandException $exception): bool => $exception->getErrorCode() === DispatchV2CommandCode::FeatureDisabled);
    expect($aggregate['attempt']->fresh()->status)->toBe(DispatchAttemptStatus::Draft)
        ->and(Schema::hasTable('dispatch_jobs'))->toBeTrue();
});
