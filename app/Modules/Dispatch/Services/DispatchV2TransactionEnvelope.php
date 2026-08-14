<?php

namespace App\Modules\Dispatch\Services;

use App\Modules\Dispatch\Contracts\DispatchOutboxRecorder;
use App\Modules\Dispatch\Data\DispatchV2Mutation;
use App\Modules\Dispatch\Enums\DispatchV2CommandCode;
use App\Modules\Dispatch\Events\DispatchExecutionTransitioned;
use App\Modules\Dispatch\Exceptions\DispatchV2CommandException;
use App\Modules\Dispatch\Models\DispatchAuditLineage;
use App\Modules\Dispatch\Models\DispatchExecutionAttempt;
use App\Modules\Dispatch\Models\DispatchHandoff;
use App\Modules\Dispatch\Models\DispatchIdempotencyKey;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Audit\Contracts\AuditEventRecorder;
use App\Platform\Identity\Models\User;
use Closure;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

final class DispatchV2TransactionEnvelope
{
    public function __construct(
        private readonly DispatchV2Authorization $authorization,
        private readonly AuditEventRecorder $audit,
        private readonly DispatchOutboxRecorder $outbox,
    ) {}

    /**
     * @template TResult of Model
     *
     * @param  Closure(DispatchExecutionAttempt): TResult  $operation
     * @param  Closure(array<string, mixed>): TResult  $replay
     * @return TResult
     */
    public function runForAttempt(
        User $actor,
        DispatchExecutionAttempt|int $attempt,
        DispatchV2Mutation $mutation,
        string $action,
        string $ability,
        Closure $operation,
        Closure $replay,
    ): Model {
        $this->assertEnabled();
        $attemptId = $attempt instanceof DispatchExecutionAttempt ? (int) $attempt->getKey() : $attempt;

        return DB::transaction(function () use ($actor, $attemptId, $mutation, $action, $ability, $operation, $replay): Model {
            $lockedAttempt = $this->lockAttemptAggregate($attemptId, $mutation->workspaceKey);
            $this->authorization->authorize($actor, $ability, $lockedAttempt);

            $claim = $this->claimIdempotency($actor, $mutation, $action, $attemptId, $lockedAttempt->id);
            if ($claim['replay']) {
                return $replay($claim['payload']);
            }
            if ($claim['record'] instanceof DispatchIdempotencyKey) {
                $lockedAttempt->v2IdempotencyKeyId = $claim['record']->id;
            }
            $this->assertExpectedVersion($lockedAttempt->version, $mutation->expectedVersion);

            $result = $operation($lockedAttempt);
            $this->completeIdempotency($claim['record'], $result);

            return $result;
        });
    }

    /**
     * @template TResult of Model
     *
     * @param  Closure(DispatchJob): TResult  $operation
     * @param  Closure(array<string, mixed>): TResult  $replay
     * @return TResult
     */
    public function runForCreate(
        User $actor,
        DispatchJob|int $job,
        DispatchV2Mutation $mutation,
        string $action,
        Closure $operation,
        Closure $replay,
    ): Model {
        $this->assertEnabled();
        $jobId = $job instanceof DispatchJob ? (int) $job->getKey() : $job;

        return DB::transaction(fn (): Model => $this->runForCreateWithinTransaction($actor, $jobId, $mutation, $action, $operation, $replay));
    }

    /**
     * Run a canonical source handoff while the caller owns the surrounding transaction.
     * This prevents source aggregate locks and canonical attempt writes from being split
     * across nested transaction envelopes.
     *
     * @template TResult of Model
     *
     * @param  Closure(DispatchJob): TResult  $operation
     * @param  Closure(array<string, mixed>): TResult  $replay
     * @return TResult
     */
    public function runForCreateWithinTransaction(
        User $actor,
        DispatchJob|int $job,
        DispatchV2Mutation $mutation,
        string $action,
        Closure $operation,
        Closure $replay,
    ): Model {
        $this->assertEnabled();
        $jobId = $job instanceof DispatchJob ? (int) $job->getKey() : $job;

        return $this->runForCreateBody($actor, $jobId, $mutation, $action, $operation, $replay);
    }

    /**
     * @template TResult of Model
     *
     * @param  Closure(DispatchJob): TResult  $operation
     * @param  Closure(array<string, mixed>): TResult  $replay
     * @return TResult
     */
    private function runForCreateBody(
        User $actor,
        int $jobId,
        DispatchV2Mutation $mutation,
        string $action,
        Closure $operation,
        Closure $replay,
    ): Model {
        $legacyJob = DispatchJob::query()->withTrashed()->lockForUpdate()->find($jobId);
        if (! $legacyJob instanceof DispatchJob) {
            throw $this->notFound();
        }

        $this->authorization->authorizeCreate($actor);

        $claim = $this->claimIdempotency($actor, $mutation, $action, $jobId, null);
        if ($claim['replay']) {
            return $replay($claim['payload']);
        }
        if ($claim['record'] instanceof DispatchIdempotencyKey) {
            $legacyJob->setAttribute('_dispatch_v2_idempotency_key_id', $claim['record']->id);
        }
        $this->assertExpectedVersion((int) $legacyJob->version, $mutation->expectedVersion);

        $result = $operation($legacyJob);
        $this->completeIdempotency($claim['record'], $result);

        return $result;
    }

    /**
     * Record exactly one audit row, its canonical lineage, and one after-commit domain event.
     *
     * @param  array<string, mixed>  $before
     * @param  array<string, mixed>  $after
     */
    public function recordMutation(
        User $actor,
        DispatchExecutionAttempt $attempt,
        string $action,
        array $before,
        array $after,
        ?string $reason = null,
        ?int $planVersionId = null,
        ?int $offerId = null,
        ?int $idempotencyKeyId = null,
        ?Model $auditSubject = null,
        ?int $emergencyOverrideId = null,
    ): void {
        $audit = $this->audit->handle($actor, $auditSubject ?? $attempt, $action, $before, $after, $reason);

        DispatchAuditLineage::query()->create([
            'audit_event_id' => $audit->id,
            'workspace_key' => $attempt->workspace_key,
            'handoff_id' => $attempt->handoff_id,
            'attempt_id' => $attempt->id,
            'plan_version_id' => $planVersionId,
            'offer_id' => $offerId,
            'idempotency_key_id' => $idempotencyKeyId ?? $attempt->v2IdempotencyKeyId,
            'emergency_override_id' => $emergencyOverrideId,
            'lineage_type' => 'dispatch_v2_command',
            'legacy_subject_type' => DispatchJob::class,
            'legacy_subject_id' => $attempt->legacy_dispatch_job_id,
            'created_at' => now(),
        ]);

        $this->outbox->record($actor, $attempt, $action, $before, $after, $audit, $idempotencyKeyId ?? $attempt->v2IdempotencyKeyId);

        event(new DispatchExecutionTransitioned(
            (int) $attempt->id,
            $action,
            $before,
            $after,
            $actor->id,
        ));
    }

    public function assertPhase3Enabled(): void
    {
        $this->assertEnabled();

        if (! (bool) config('dispatch.phase3_commands_enabled', true)) {
            throw new DispatchV2CommandException(
                DispatchV2CommandCode::FeatureDisabled,
                'The Phase 3 dispatch command path is not enabled.',
                status: 409,
            );
        }
    }

    private function lockAttemptAggregate(int $attemptId, string $workspaceKey): DispatchExecutionAttempt
    {
        $candidate = DispatchExecutionAttempt::query()
            ->whereKey($attemptId)
            ->where('workspace_key', $workspaceKey)
            ->first();

        if (! $candidate instanceof DispatchExecutionAttempt) {
            throw $this->notFound();
        }

        $handoff = DispatchHandoff::query()
            ->whereKey($candidate->handoff_id)
            ->where('workspace_key', $workspaceKey)
            ->lockForUpdate()
            ->first();

        if (! $handoff instanceof DispatchHandoff) {
            throw $this->notFound();
        }

        $lockedAttempt = DispatchExecutionAttempt::query()
            ->whereKey($candidate->id)
            ->where('workspace_key', $workspaceKey)
            ->lockForUpdate()
            ->first();

        if (! $lockedAttempt instanceof DispatchExecutionAttempt) {
            throw $this->notFound();
        }

        return $lockedAttempt->setRelation('handoff', $handoff);
    }

    /**
     * @return array{replay: bool, payload: array<string, mixed>, record: DispatchIdempotencyKey|null}
     */
    private function claimIdempotency(
        User $actor,
        DispatchV2Mutation $mutation,
        string $action,
        int $aggregateId,
        ?int $attemptId,
    ): array {
        if ($mutation->idempotencyKey === null) {
            return ['replay' => false, 'payload' => [], 'record' => null];
        }

        $ownerType = $mutation->idempotencyOwnerType;
        $ownerId = $mutation->idempotencyOwnerId ?? $actor->id;
        $payloadHash = $mutation->payloadHash($action, $aggregateId);
        $query = DispatchIdempotencyKey::query()
            ->where('workspace_key', $mutation->workspaceKey)
            ->where('idempotency_key', $mutation->idempotencyKey)
            ->lockForUpdate();
        $record = $query->first();

        if ($record instanceof DispatchIdempotencyKey) {
            if ($record->owner_type !== $ownerType
                || (int) $record->owner_id !== $ownerId
                || $record->action_name !== $action) {
                throw new DispatchV2CommandException(
                    DispatchV2CommandCode::IdempotencyConflict,
                    'The idempotency key was already used by a different owner or operation.',
                );
            }

            if ($record->payload_hash !== $payloadHash) {
                throw new DispatchV2CommandException(
                    DispatchV2CommandCode::IdempotencyPayloadMismatch,
                    'The idempotency key was already used for a different payload.',
                );
            }

            if ($record->status === 'completed') {
                return ['replay' => true, 'payload' => $record->response_payload ?? [], 'record' => $record];
            }

            throw new DispatchV2CommandException(
                DispatchV2CommandCode::IdempotencyInProgress,
                'The requested operation is already being processed.',
            );
        }

        $record = DispatchIdempotencyKey::query()->create([
            'workspace_key' => $mutation->workspaceKey,
            'owner_type' => $ownerType,
            'owner_id' => $ownerId,
            'idempotency_key' => $mutation->idempotencyKey,
            'action_name' => $action,
            'payload_hash' => $payloadHash,
            'expected_version' => $mutation->expectedVersion,
            'status' => 'claimed',
            'attempt_id' => $attemptId,
            'claimed_at' => now(),
        ]);

        return ['replay' => false, 'payload' => [], 'record' => $record];
    }

    private function completeIdempotency(?DispatchIdempotencyKey $record, Model $result): void
    {
        if (! $record instanceof DispatchIdempotencyKey) {
            return;
        }

        $record->update([
            'status' => 'completed',
            'response_code' => 200,
            'response_payload' => [
                'resource_type' => $result->getMorphClass(),
                'resource_id' => (int) $result->getKey(),
                'attempt_id' => $result instanceof DispatchExecutionAttempt ? (int) $result->id : null,
            ],
            'attempt_id' => $result instanceof DispatchExecutionAttempt ? $result->id : $record->attempt_id,
            'completed_at' => now(),
        ]);
    }

    private function assertExpectedVersion(int $currentVersion, int $expectedVersion): void
    {
        if ($currentVersion !== $expectedVersion) {
            throw new DispatchV2CommandException(
                DispatchV2CommandCode::StaleVersion,
                'The dispatch changed. Refresh and review the current state before trying again.',
                ['current_version' => $currentVersion],
            );
        }
    }

    private function assertEnabled(): void
    {
        if (! (bool) config('dispatch.v2_commands_enabled', true)) {
            throw new DispatchV2CommandException(
                DispatchV2CommandCode::FeatureDisabled,
                'The V2 dispatch command path is not enabled.',
                status: 409,
            );
        }
    }

    private function notFound(): DispatchV2CommandException
    {
        return new DispatchV2CommandException(
            DispatchV2CommandCode::ObjectNotFound,
            'The requested dispatch is not available.',
            status: 404,
        );
    }
}
