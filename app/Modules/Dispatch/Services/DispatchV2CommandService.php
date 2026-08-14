<?php

namespace App\Modules\Dispatch\Services;

use App\Modules\Dispatch\Data\DispatchReadinessProjection;
use App\Modules\Dispatch\Data\DispatchV2Mutation;
use App\Modules\Dispatch\Enums\DispatchAttemptStatus;
use App\Modules\Dispatch\Enums\DispatchPlanApprovalStatus;
use App\Modules\Dispatch\Enums\DispatchPlanVersionStatus;
use App\Modules\Dispatch\Enums\DispatchV2CommandCode;
use App\Modules\Dispatch\Exceptions\DispatchV2CommandException;
use App\Modules\Dispatch\Models\DispatchEmergencyOverride;
use App\Modules\Dispatch\Models\DispatchExecutionAttempt;
use App\Modules\Dispatch\Models\DispatchHandoff;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Models\DispatchPlanApproval;
use App\Modules\Dispatch\Models\DispatchPlanRequirementSlot;
use App\Modules\Dispatch\Models\DispatchPlanVersion;
use App\Modules\Dispatch\Queries\DispatchReadinessEvaluator;
use App\Platform\Identity\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

final class DispatchV2CommandService
{
    public function __construct(
        private readonly DispatchV2TransactionEnvelope $transactions,
        private readonly DispatchV2Authorization $authorization,
        private readonly DispatchReadinessEvaluator $readiness,
        private readonly DispatchEmergencyOverrideCommandService $overrides,
        private readonly DispatchPlanMateriality $materiality,
    ) {}

    public function create(
        User $actor,
        DispatchJob|int $job,
        DispatchV2Mutation $mutation,
    ): DispatchExecutionAttempt {
        $result = $this->transactions->runForCreate(
            $actor,
            $job,
            $mutation,
            'dispatch.v2.attempt.create',
            function (DispatchJob $legacyJob) use ($actor, $mutation): DispatchExecutionAttempt {
                if ($legacyJob->canonicalHandoff()->exists()) {
                    throw new DispatchV2CommandException(
                        DispatchV2CommandCode::InvalidCommand,
                        'The dispatch already has a canonical execution attempt.',
                    );
                }

                $scheduleStart = $legacyJob->scheduled_start;
                $scheduleEnd = $legacyJob->scheduled_end;
                $snapshot = $this->snapshot($mutation->payload['plan_snapshot'] ?? [], [
                    'scheduled_start' => $scheduleStart?->toIso8601String(),
                    'scheduled_end' => $scheduleEnd?->toIso8601String(),
                ]);
                $sourceType = (string) ($legacyJob->source_type ?: 'legacy_dispatch_job');
                $sourceId = (int) ($legacyJob->source_id ?: $legacyJob->id);
                $sourceReference = (string) ($legacyJob->source_reference ?: $legacyJob->reference);

                $handoff = DispatchHandoff::query()->create([
                    'workspace_key' => $mutation->workspaceKey,
                    'source_type' => $sourceType,
                    'source_id' => $sourceId,
                    'source_reference' => $sourceReference,
                    'legacy_dispatch_job_id' => $legacyJob->id,
                    'created_by' => $actor->id,
                    'compatibility_state' => 'v2_command',
                    'legacy_snapshot' => [
                        'reference' => $legacyJob->reference,
                        'legacy_status' => (string) $legacyJob->getRawOriginal('status'),
                    ],
                ]);

                $attempt = DispatchExecutionAttempt::query()->create([
                    'handoff_id' => $handoff->id,
                    'workspace_key' => $mutation->workspaceKey,
                    'attempt_number' => 1,
                    'legacy_dispatch_job_id' => $legacyJob->id,
                    'status' => DispatchAttemptStatus::Draft,
                    'legacy_status' => (string) $legacyJob->getRawOriginal('status'),
                    'compatibility_state' => 'v2_command',
                    'scheduled_start' => $scheduleStart,
                    'scheduled_end' => $scheduleEnd,
                    'version' => 1,
                    'legacy_snapshot' => ['reference' => $legacyJob->reference],
                    'created_by' => $actor->id,
                ]);
                $claimId = $legacyJob->getAttribute('_dispatch_v2_idempotency_key_id');
                $attempt->v2IdempotencyKeyId = is_numeric($claimId) ? (int) $claimId : null;

                $plan = $this->createPlan($attempt, $actor, $snapshot, DispatchPlanVersionStatus::Draft);
                $attempt->setRelation('handoff', $handoff);
                $this->transactions->recordMutation(
                    $actor,
                    $attempt,
                    'dispatch.v2.attempt.created',
                    [],
                    ['status' => DispatchAttemptStatus::Draft->value, 'version' => 1, 'plan_version' => $plan->version],
                    $mutation->reason,
                    $plan->id,
                );

                return $attempt->refresh()->setRelation('handoff', $handoff);
            },
            fn (array $payload): DispatchExecutionAttempt => $this->replayAttempt($payload, $mutation->workspaceKey),
        );

        return $this->asAttempt($result);
    }

    public function submitPlan(
        User $actor,
        DispatchExecutionAttempt|int $attempt,
        DispatchV2Mutation $mutation,
    ): DispatchPlanVersion {
        $result = $this->transactions->runForAttempt(
            $actor,
            $attempt,
            $mutation,
            'dispatch.v2.plan.submit',
            'submit',
            function (DispatchExecutionAttempt $lockedAttempt) use ($actor, $mutation): DispatchPlanVersion {
                $plan = $lockedAttempt->planVersions()->orderByDesc('version')->orderByDesc('id')->lockForUpdate()->first();
                $snapshot = $this->snapshot(
                    $mutation->payload['snapshot'] ?? ($plan === null ? [] : $plan->snapshot),
                    [
                        'scheduled_start' => $lockedAttempt->scheduled_start?->toIso8601String(),
                        'scheduled_end' => $lockedAttempt->scheduled_end?->toIso8601String(),
                    ],
                );

                $before = ['status' => $lockedAttempt->status->value, 'version' => $lockedAttempt->version];
                [$scheduledStart, $scheduledEnd] = $this->planSchedule($snapshot, $lockedAttempt);
                if ($plan instanceof DispatchPlanVersion && $plan->status !== DispatchPlanVersionStatus::Draft
                    && ! $this->materiality->changed($plan, $snapshot, $scheduledStart, $scheduledEnd)) {
                    return $plan->refresh();
                }

                if ($plan instanceof DispatchPlanVersion && $plan->status === DispatchPlanVersionStatus::Draft) {
                    $plan->update([
                        'snapshot' => $snapshot,
                        'content_hash' => $this->contentHash($snapshot),
                        'scheduled_start' => $scheduledStart,
                        'scheduled_end' => $scheduledEnd,
                    ]);
                } elseif ($plan instanceof DispatchPlanVersion) {
                    $this->supersedePlan($plan);
                    $plan = $this->createPlan($lockedAttempt, $actor, $snapshot, DispatchPlanVersionStatus::Submitted, $scheduledStart, $scheduledEnd);
                } else {
                    $plan = $this->createPlan($lockedAttempt, $actor, $snapshot, DispatchPlanVersionStatus::Submitted, $scheduledStart, $scheduledEnd);
                }

                if ($plan->status === DispatchPlanVersionStatus::Draft) {
                    $plan->update([
                        'status' => DispatchPlanVersionStatus::Submitted,
                        'submitted_by' => $actor->id,
                        'submitted_at' => now(),
                        'sealed_at' => now(),
                    ]);
                }
                $lockedAttempt->update(['scheduled_start' => $scheduledStart, 'scheduled_end' => $scheduledEnd]);
                $this->syncRequirementSlots($lockedAttempt, $plan, $actor);
                $this->ensurePendingApproval($plan, $actor, $mutation->reason);
                $this->incrementAttempt($lockedAttempt);
                $lockedAttempt->refresh();
                $this->transactions->recordMutation(
                    $actor,
                    $lockedAttempt,
                    'dispatch.v2.plan.submitted',
                    $before,
                    ['status' => $lockedAttempt->status->value, 'version' => $lockedAttempt->version, 'plan_version' => $plan->version, 'approval_request_reason' => $mutation->reason],
                    $mutation->reason,
                    $plan->id,
                );

                return $plan->refresh();
            },
            fn (array $payload): DispatchPlanVersion => $this->replayPlan($payload, $mutation->workspaceKey),
        );

        return $this->asPlan($result);
    }

    public function approvePlan(
        User $actor,
        DispatchExecutionAttempt|int $attempt,
        DispatchV2Mutation $mutation,
    ): DispatchPlanApproval {
        return $this->decidePlan($actor, $attempt, $mutation, DispatchPlanApprovalStatus::Approved);
    }

    public function rejectPlan(
        User $actor,
        DispatchExecutionAttempt|int $attempt,
        DispatchV2Mutation $mutation,
    ): DispatchPlanApproval {
        return $this->decidePlan($actor, $attempt, $mutation, DispatchPlanApprovalStatus::Rejected);
    }

    private function decidePlan(
        User $actor,
        DispatchExecutionAttempt|int $attempt,
        DispatchV2Mutation $mutation,
        DispatchPlanApprovalStatus $decision,
    ): DispatchPlanApproval {
        $this->requireReason($mutation);
        $result = $this->transactions->runForAttempt(
            $actor,
            $attempt,
            $mutation,
            'dispatch.v2.plan.'.$decision->value,
            'approve',
            function (DispatchExecutionAttempt $lockedAttempt) use ($actor, $mutation, $decision): DispatchPlanApproval {
                $plan = $lockedAttempt->planVersions()->orderByDesc('version')->orderByDesc('id')->lockForUpdate()->first();
                if (! $plan instanceof DispatchPlanVersion || $plan->status !== DispatchPlanVersionStatus::Submitted) {
                    throw $this->invalidTransition('Only a submitted plan version can receive a decision.');
                }

                $approval = $plan->approvals()->where('kind', 'plan_approval')->where('status', DispatchPlanApprovalStatus::Pending)->lockForUpdate()->first();
                if (! $approval instanceof DispatchPlanApproval) {
                    $approval = $this->ensurePendingApproval($plan, $plan->submitted_by === null ? $plan->created_by : (int) $plan->submitted_by, null);
                }
                if ($approval->requested_by === $actor->id) {
                    throw new DispatchV2CommandException(DispatchV2CommandCode::Forbidden, 'The plan requester cannot decide their own approval.', status: 403);
                }

                $before = ['status' => $lockedAttempt->status->value, 'version' => $lockedAttempt->version];
                $approval->update([
                    'status' => $decision,
                    'decided_by' => $actor->id,
                    'reason' => trim((string) $mutation->reason),
                    'decided_at' => now(),
                ]);
                $plan->update(['status' => $decision === DispatchPlanApprovalStatus::Approved ? DispatchPlanVersionStatus::Approved : DispatchPlanVersionStatus::Rejected, 'sealed_at' => now()]);
                $this->incrementAttempt($lockedAttempt);
                $lockedAttempt->refresh();
                $this->transactions->recordMutation(
                    $actor,
                    $lockedAttempt,
                    'dispatch.v2.plan.'.$decision->value,
                    $before,
                    ['status' => $lockedAttempt->status->value, 'version' => $lockedAttempt->version, 'plan_version' => $plan->version, 'requested_by' => $approval->requested_by, 'decided_by' => $actor->id],
                    trim((string) $mutation->reason),
                    $plan->id,
                    null,
                    null,
                    $approval,
                );

                return $approval->refresh();
            },
            fn (array $payload): DispatchPlanApproval => $this->replayApproval($payload, $mutation->workspaceKey),
        );

        return $this->asApproval($result);
    }

    public function dispatch(
        User $actor,
        DispatchExecutionAttempt|int $attempt,
        DispatchV2Mutation $mutation,
    ): DispatchExecutionAttempt {
        $result = $this->transactions->runForAttempt(
            $actor,
            $attempt,
            $mutation,
            'dispatch.v2.execution.dispatch',
            'dispatch',
            function (DispatchExecutionAttempt $lockedAttempt) use ($actor, $mutation): DispatchExecutionAttempt {
                if ($lockedAttempt->archived_at !== null) {
                    throw $this->archived();
                }
                if ($lockedAttempt->status !== DispatchAttemptStatus::Draft) {
                    throw $this->invalidTransition('Only a draft dispatch can be dispatched.');
                }

                $projection = $this->readiness->evaluate($lockedAttempt, lock: true);
                $override = null;
                if (! $projection->ready) {
                    $currentPlan = $lockedAttempt->planVersions()->orderByDesc('version')->orderByDesc('id')->first();
                    $override = $currentPlan instanceof DispatchPlanVersion
                        ? $this->overrides->usableFor($lockedAttempt, $currentPlan->id, $projection->blockers)
                        : null;
                    $remainingBlockers = array_values(array_filter(
                        $projection->blockers,
                        static fn ($blocker): bool => $override === null || ! in_array($blocker->code->value, $override->scope['blocker_codes'] ?? [], true),
                    ));
                    $hasBlockingRemaining = array_filter($remainingBlockers, static fn ($blocker): bool => $blocker->severity->value === 'blocking') !== [];
                    if (! $hasBlockingRemaining && $override instanceof DispatchEmergencyOverride) {
                        // The explicit override is consumed only after the execution state mutation succeeds.
                    } else {
                        $override = null;
                    }
                }
                if (! $projection->ready && ! $override instanceof DispatchEmergencyOverride) {
                    throw new DispatchV2CommandException(
                        DispatchV2CommandCode::NotReady,
                        'The dispatch is not ready for execution.',
                        ['blockers' => $projection->blockerArrays()],
                    );
                }

                $before = ['status' => $lockedAttempt->status->value, 'version' => $lockedAttempt->version];
                $lockedAttempt->update([
                    'status' => DispatchAttemptStatus::Dispatched,
                    'activated_by' => $actor->id,
                    'version' => $lockedAttempt->version + 1,
                ]);
                if ($override instanceof DispatchEmergencyOverride) {
                    $this->overrides->consume($override);
                }
                $lockedAttempt->refresh();
                $this->transactions->recordMutation(
                    $actor,
                    $lockedAttempt,
                    'dispatch.v2.execution.dispatched',
                    $before,
                    ['status' => $lockedAttempt->status->value, 'version' => $lockedAttempt->version],
                    $mutation->reason,
                    null,
                    null,
                    null,
                    null,
                    $override?->id,
                );

                return $lockedAttempt;
            },
            fn (array $payload): DispatchExecutionAttempt => $this->replayAttempt($payload, $mutation->workspaceKey),
        );

        return $this->asAttempt($result);
    }

    public function progress(
        User $actor,
        DispatchExecutionAttempt|int $attempt,
        DispatchAttemptStatus $next,
        DispatchV2Mutation $mutation,
    ): DispatchExecutionAttempt {
        $result = $this->transactions->runForAttempt(
            $actor,
            $attempt,
            $mutation,
            'dispatch.v2.execution.progress:'.$next->value,
            'progress',
            function (DispatchExecutionAttempt $lockedAttempt) use ($actor, $next, $mutation): DispatchExecutionAttempt {
                if ($lockedAttempt->archived_at !== null) {
                    throw $this->archived();
                }
                if (in_array($next, [DispatchAttemptStatus::Draft, DispatchAttemptStatus::Dispatched, DispatchAttemptStatus::Cancelled], true)) {
                    throw $this->invalidTransition('That execution step is not a progress transition.');
                }

                $expectedNext = match ($lockedAttempt->status) {
                    DispatchAttemptStatus::Dispatched => DispatchAttemptStatus::EnRoute,
                    DispatchAttemptStatus::EnRoute => DispatchAttemptStatus::Arrived,
                    DispatchAttemptStatus::Arrived => DispatchAttemptStatus::Working,
                    DispatchAttemptStatus::Working => DispatchAttemptStatus::Completed,
                    DispatchAttemptStatus::Draft => null,
                    DispatchAttemptStatus::Completed, DispatchAttemptStatus::Cancelled => throw new DispatchV2CommandException(
                        DispatchV2CommandCode::TerminalRecord,
                        'Terminal dispatch records cannot be progressed.',
                    ),
                };

                if ($expectedNext !== $next) {
                    throw $this->invalidTransition('That execution step is not available from the current state.');
                }

                $isLead = $this->authorization->isDesignatedLead($actor, $lockedAttempt);
                $operationalOverride = ! $isLead;
                if ($operationalOverride) {
                    if (($mutation->payload['operational_override'] ?? false) !== true) {
                        throw new DispatchV2CommandException(
                            DispatchV2CommandCode::Forbidden,
                            'Global execution may only be progressed by the accepted lead or an explicit operational override.',
                            status: 403,
                        );
                    }
                    $this->requireReason($mutation);
                }

                $before = ['status' => $lockedAttempt->status->value, 'version' => $lockedAttempt->version];
                $lockedAttempt->update(['status' => $next, 'version' => $lockedAttempt->version + 1]);
                $lockedAttempt->refresh();
                $this->transactions->recordMutation(
                    $actor,
                    $lockedAttempt,
                    'dispatch.v2.execution.progressed',
                    $before,
                    ['status' => $lockedAttempt->status->value, 'version' => $lockedAttempt->version, 'operational_override' => $operationalOverride, 'override_actor_id' => $operationalOverride ? $actor->id : null],
                    $mutation->reason,
                );

                return $lockedAttempt;
            },
            fn (array $payload): DispatchExecutionAttempt => $this->replayAttempt($payload, $mutation->workspaceKey),
        );

        return $this->asAttempt($result);
    }

    public function cancel(
        User $actor,
        DispatchExecutionAttempt|int $attempt,
        DispatchV2Mutation $mutation,
    ): DispatchExecutionAttempt {
        $this->requireReason($mutation);
        $result = $this->transactions->runForAttempt(
            $actor,
            $attempt,
            $mutation,
            'dispatch.v2.execution.cancel',
            'cancel',
            function (DispatchExecutionAttempt $lockedAttempt) use ($actor, $mutation): DispatchExecutionAttempt {
                if ($lockedAttempt->archived_at !== null) {
                    throw $this->archived();
                }
                if (in_array($lockedAttempt->status, [DispatchAttemptStatus::Completed, DispatchAttemptStatus::Cancelled], true)) {
                    throw new DispatchV2CommandException(
                        DispatchV2CommandCode::TerminalRecord,
                        'Terminal dispatch records cannot be cancelled.',
                    );
                }

                $before = ['status' => $lockedAttempt->status->value, 'version' => $lockedAttempt->version];
                $lockedAttempt->update([
                    'status' => DispatchAttemptStatus::Cancelled,
                    'cancelled_by' => $actor->id,
                    'cancellation_reason' => trim((string) $mutation->reason),
                    'version' => $lockedAttempt->version + 1,
                ]);
                $lockedAttempt->refresh();
                $this->transactions->recordMutation(
                    $actor,
                    $lockedAttempt,
                    'dispatch.v2.execution.cancelled',
                    $before,
                    ['status' => $lockedAttempt->status->value, 'version' => $lockedAttempt->version],
                    trim((string) $mutation->reason),
                );

                return $lockedAttempt;
            },
            fn (array $payload): DispatchExecutionAttempt => $this->replayAttempt($payload, $mutation->workspaceKey),
        );

        return $this->asAttempt($result);
    }

    public function reopen(
        User $actor,
        DispatchExecutionAttempt|int $attempt,
        DispatchV2Mutation $mutation,
    ): DispatchExecutionAttempt {
        $this->requireReason($mutation);
        $result = $this->transactions->runForAttempt(
            $actor,
            $attempt,
            $mutation,
            'dispatch.v2.execution.reopen',
            'reopen',
            function (DispatchExecutionAttempt $lockedAttempt) use ($actor, $mutation): DispatchExecutionAttempt {
                if ($lockedAttempt->archived_at !== null) {
                    throw $this->archived();
                }
                if ($lockedAttempt->status !== DispatchAttemptStatus::Cancelled) {
                    throw $this->invalidTransition('Only a cancelled execution can be reopened as a replacement attempt.');
                }

                $handoff = $lockedAttempt->handoff;
                $nextNumber = ((int) DispatchExecutionAttempt::query()->where('handoff_id', $handoff->id)->max('attempt_number')) + 1;
                $replacement = DispatchExecutionAttempt::query()->create([
                    'handoff_id' => $handoff->id,
                    'workspace_key' => $lockedAttempt->workspace_key,
                    'attempt_number' => $nextNumber,
                    'replaces_attempt_id' => $lockedAttempt->id,
                    'legacy_dispatch_job_id' => null,
                    'status' => DispatchAttemptStatus::Draft,
                    'compatibility_state' => 'v2_command',
                    'scheduled_start' => $lockedAttempt->scheduled_start,
                    'scheduled_end' => $lockedAttempt->scheduled_end,
                    'version' => 1,
                    'created_by' => $actor->id,
                ]);
                $replacement->v2IdempotencyKeyId = $lockedAttempt->v2IdempotencyKeyId;
                $snapshot = [
                    'reopened_from_attempt_id' => $lockedAttempt->id,
                    'scheduled_start' => $replacement->scheduled_start?->toIso8601String(),
                    'scheduled_end' => $replacement->scheduled_end?->toIso8601String(),
                ];
                $plan = $this->createPlan($replacement, $actor, $snapshot, DispatchPlanVersionStatus::Draft);
                $replacement->setRelation('handoff', $handoff);
                $this->transactions->recordMutation(
                    $actor,
                    $replacement,
                    'dispatch.v2.execution.reopened',
                    ['replaced_attempt_id' => $lockedAttempt->id, 'status' => $lockedAttempt->status->value, 'version' => $lockedAttempt->version],
                    ['attempt_id' => $replacement->id, 'status' => $replacement->status->value, 'version' => $replacement->version, 'plan_version' => $plan->version],
                    trim((string) $mutation->reason),
                    $plan->id,
                );

                return $replacement->refresh()->setRelation('handoff', $handoff);
            },
            fn (array $payload): DispatchExecutionAttempt => $this->replayAttempt($payload, $mutation->workspaceKey),
        );

        return $this->asAttempt($result);
    }

    public function archive(
        User $actor,
        DispatchExecutionAttempt|int $attempt,
        DispatchV2Mutation $mutation,
    ): DispatchExecutionAttempt {
        $result = $this->transactions->runForAttempt(
            $actor,
            $attempt,
            $mutation,
            'dispatch.v2.execution.archive',
            'archive',
            function (DispatchExecutionAttempt $lockedAttempt) use ($actor, $mutation): DispatchExecutionAttempt {
                if ($lockedAttempt->archived_at !== null) {
                    throw $this->archived();
                }
                if (! in_array($lockedAttempt->status, [DispatchAttemptStatus::Completed, DispatchAttemptStatus::Cancelled], true)) {
                    throw new DispatchV2CommandException(
                        DispatchV2CommandCode::InvalidTransition,
                        'Only terminal dispatch records can be archived.',
                    );
                }

                $before = ['status' => $lockedAttempt->status->value, 'version' => $lockedAttempt->version, 'archived' => false];
                $lockedAttempt->update([
                    'archived_at' => now(),
                    'archived_by' => $actor->id,
                    'archive_reason' => $mutation->reason !== null ? trim($mutation->reason) : null,
                    'version' => $lockedAttempt->version + 1,
                ]);
                $lockedAttempt->refresh();
                $this->transactions->recordMutation(
                    $actor,
                    $lockedAttempt,
                    'dispatch.v2.execution.archived',
                    $before,
                    ['status' => $lockedAttempt->status->value, 'version' => $lockedAttempt->version, 'archived' => true],
                    $mutation->reason,
                );

                return $lockedAttempt;
            },
            fn (array $payload): DispatchExecutionAttempt => $this->replayAttempt($payload, $mutation->workspaceKey),
        );

        return $this->asAttempt($result);
    }

    public function readiness(
        User $actor,
        DispatchExecutionAttempt|int $attempt,
        string $workspaceKey = 'operations',
        ?int $expectedVersion = null,
    ): DispatchReadinessProjection {
        $attemptId = $attempt instanceof DispatchExecutionAttempt ? (int) $attempt->getKey() : $attempt;
        $scopedAttempt = DispatchExecutionAttempt::query()
            ->whereKey($attemptId)
            ->where('workspace_key', $workspaceKey)
            ->first();

        if (! $scopedAttempt instanceof DispatchExecutionAttempt) {
            throw new DispatchV2CommandException(
                DispatchV2CommandCode::ObjectNotFound,
                'The requested dispatch is not available.',
                status: 404,
            );
        }

        $this->authorization->authorizeRead($actor, $scopedAttempt);

        return $this->readiness->evaluate($scopedAttempt, $expectedVersion);
    }

    /** @param array<string, mixed> $snapshot */
    private function createPlan(
        DispatchExecutionAttempt $attempt,
        User $actor,
        array $snapshot,
        DispatchPlanVersionStatus $status,
        ?Carbon $scheduledStart = null,
        ?Carbon $scheduledEnd = null,
    ): DispatchPlanVersion {
        $scheduledStart ??= $attempt->scheduled_start;
        $scheduledEnd ??= $attempt->scheduled_end;

        return DispatchPlanVersion::query()->create([
            'attempt_id' => $attempt->id,
            'workspace_key' => $attempt->workspace_key,
            'version' => ((int) $attempt->planVersions()->max('version')) + 1,
            'status' => $status,
            'snapshot' => $snapshot,
            'content_hash' => $this->contentHash($snapshot),
            'scheduled_start' => $scheduledStart,
            'scheduled_end' => $scheduledEnd,
            'created_by' => $actor->id,
        ]);
    }

    private function supersedePlan(DispatchPlanVersion $plan): void
    {
        $plan->approvals()
            ->whereIn('status', [DispatchPlanApprovalStatus::Pending->value, DispatchPlanApprovalStatus::Approved->value])
            ->lockForUpdate()
            ->get()
            ->each->update(['status' => DispatchPlanApprovalStatus::Superseded]);
        $plan->assignmentOffers()
            ->whereIn('status', ['proposed', 'offered', 'accepted'])
            ->lockForUpdate()
            ->get()
            ->each->update(['status' => 'withdrawn', 'withdrawn_at' => now(), 'response_reason' => 'Plan version superseded.']);
        $plan->update(['status' => DispatchPlanVersionStatus::Superseded, 'superseded_at' => now()]);
    }

    private function ensurePendingApproval(DispatchPlanVersion $plan, User|int $actor, ?string $requestReason): DispatchPlanApproval
    {
        $approval = $plan->approvals()->where('kind', 'plan_approval')->where('status', DispatchPlanApprovalStatus::Pending)->lockForUpdate()->first();
        if ($approval instanceof DispatchPlanApproval) {
            return $approval;
        }

        return $plan->approvals()->create([
            'kind' => 'plan_approval',
            'status' => DispatchPlanApprovalStatus::Pending,
            'requested_by' => $actor instanceof User ? $actor->id : $actor,
            'request_reason' => $requestReason === null ? null : trim($requestReason),
        ]);
    }

    private function syncRequirementSlots(DispatchExecutionAttempt $attempt, DispatchPlanVersion $plan, User $actor): void
    {
        if ($plan->requirementSlots()->exists()) {
            return;
        }

        $requirements = $plan->snapshot['mandatory_assignments'] ?? [];
        if (is_array($requirements)) {
            foreach ($requirements as $key => $value) {
                if (is_string($value)) {
                    $assignmentType = $value;
                    $slotKey = $value;
                    $userId = null;
                    $mandatory = true;
                } elseif (is_array($value) && is_string($value['assignment_type'] ?? $value['type'] ?? $value['slot'] ?? null)) {
                    $assignmentType = (string) ($value['assignment_type'] ?? $value['type'] ?? $value['slot']);
                    $slotKey = is_string($value['slot'] ?? null) ? $value['slot'] : (string) $key;
                    $userId = is_numeric($value['user_id'] ?? null) ? (int) $value['user_id'] : null;
                    $mandatory = (bool) ($value['is_mandatory'] ?? true);
                } else {
                    continue;
                }
                DispatchPlanRequirementSlot::query()->create([
                    'attempt_id' => $attempt->id,
                    'plan_version_id' => $plan->id,
                    'workspace_key' => $attempt->workspace_key,
                    'kind' => 'personnel',
                    'slot_key' => $slotKey,
                    'assignment_type' => $assignmentType,
                    'is_mandatory' => $mandatory,
                    'user_id' => $userId,
                    'created_by' => $actor->id,
                ]);
            }
        }

        $assets = $plan->snapshot['assets'] ?? [];
        if (is_array($assets)) {
            foreach ($assets as $key => $value) {
                if (! is_array($value)) {
                    continue;
                }
                $assetId = $value['asset_id'] ?? $value['operational_asset_id'] ?? $value['id'] ?? null;
                if (! is_numeric($assetId)) {
                    continue;
                }
                DispatchPlanRequirementSlot::query()->create([
                    'attempt_id' => $attempt->id,
                    'plan_version_id' => $plan->id,
                    'workspace_key' => $attempt->workspace_key,
                    'kind' => 'asset',
                    'slot_key' => is_string($value['slot'] ?? null) ? $value['slot'] : 'asset_'.$key,
                    'assignment_type' => is_string($value['assignment_type'] ?? null) ? $value['assignment_type'] : 'asset',
                    'is_mandatory' => (bool) ($value['is_mandatory'] ?? true),
                    'operational_asset_id' => (int) $assetId,
                    'created_by' => $actor->id,
                ]);
            }
        }
    }

    /**
     * @param  array<string, mixed>  $snapshot
     * @return array{0: Carbon|null, 1: Carbon|null}
     */
    private function planSchedule(array $snapshot, DispatchExecutionAttempt $attempt): array
    {
        $start = $this->dateValue($snapshot['scheduled_start'] ?? null) ?? $attempt->scheduled_start;
        $end = $this->dateValue($snapshot['scheduled_end'] ?? null) ?? $attempt->scheduled_end;

        return [$start, $end];
    }

    private function dateValue(mixed $value): ?Carbon
    {
        if ($value === null || $value instanceof Carbon) {
            return $value;
        }
        if (! is_string($value) || trim($value) === '') {
            return null;
        }
        try {
            return Carbon::parse($value);
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * @param  array<string, mixed>  $defaults
     * @return array<string, mixed>
     */
    private function snapshot(mixed $snapshot, array $defaults): array
    {
        $snapshot = is_array($snapshot) ? $snapshot : [];
        foreach ($defaults as $key => $value) {
            $snapshot[$key] ??= $value;
        }

        return $snapshot;
    }

    /** @param array<string, mixed> $snapshot */
    private function contentHash(array $snapshot): string
    {
        return hash('sha256', (string) json_encode($snapshot, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    }

    private function incrementAttempt(DispatchExecutionAttempt $attempt): void
    {
        $attempt->update(['version' => $attempt->version + 1]);
    }

    private function requireReason(DispatchV2Mutation $mutation): void
    {
        if ($mutation->reason === null || trim($mutation->reason) === '') {
            throw new DispatchV2CommandException(
                DispatchV2CommandCode::InvalidReason,
                'A reason is required for this operation.',
                status: 422,
            );
        }
    }

    private function invalidTransition(string $message): DispatchV2CommandException
    {
        return new DispatchV2CommandException(DispatchV2CommandCode::InvalidTransition, $message);
    }

    private function archived(): DispatchV2CommandException
    {
        return new DispatchV2CommandException(
            DispatchV2CommandCode::ArchivedRecord,
            'Archived dispatch records cannot be changed.',
        );
    }

    /** @param array<string, mixed> $payload */
    private function replayAttempt(array $payload, string $workspaceKey): DispatchExecutionAttempt
    {
        $id = $payload['resource_id'] ?? null;
        $result = is_numeric($id)
            ? DispatchExecutionAttempt::query()->whereKey((int) $id)->where('workspace_key', $workspaceKey)->first()
            : null;

        if (! $result instanceof DispatchExecutionAttempt) {
            throw new DispatchV2CommandException(DispatchV2CommandCode::ObjectNotFound, 'The requested dispatch is not available.', status: 404);
        }

        return $result;
    }

    /** @param array<string, mixed> $payload */
    private function replayPlan(array $payload, string $workspaceKey): DispatchPlanVersion
    {
        $id = $payload['resource_id'] ?? null;
        $result = is_numeric($id) ? DispatchPlanVersion::query()->whereKey((int) $id)->where('workspace_key', $workspaceKey)->first() : null;
        if (! $result instanceof DispatchPlanVersion) {
            throw new DispatchV2CommandException(DispatchV2CommandCode::ObjectNotFound, 'The requested plan is not available.', status: 404);
        }

        return $result;
    }

    /** @param array<string, mixed> $payload */
    private function replayApproval(array $payload, string $workspaceKey): DispatchPlanApproval
    {
        $id = $payload['resource_id'] ?? null;
        $result = is_numeric($id)
            ? DispatchPlanApproval::query()->whereKey((int) $id)->whereHas('planVersion', static fn ($query) => $query->where('workspace_key', $workspaceKey))->first()
            : null;
        if (! $result instanceof DispatchPlanApproval) {
            throw new DispatchV2CommandException(DispatchV2CommandCode::ObjectNotFound, 'The requested approval is not available.', status: 404);
        }

        return $result;
    }

    private function asAttempt(Model $result): DispatchExecutionAttempt
    {
        return $result instanceof DispatchExecutionAttempt ? $result : throw new DispatchV2CommandException(DispatchV2CommandCode::InvalidCommand, 'The command returned an invalid dispatch result.');
    }

    private function asPlan(Model $result): DispatchPlanVersion
    {
        return $result instanceof DispatchPlanVersion ? $result : throw new DispatchV2CommandException(DispatchV2CommandCode::InvalidCommand, 'The command returned an invalid plan result.');
    }

    private function asApproval(Model $result): DispatchPlanApproval
    {
        return $result instanceof DispatchPlanApproval ? $result : throw new DispatchV2CommandException(DispatchV2CommandCode::InvalidCommand, 'The command returned an invalid approval result.');
    }
}
