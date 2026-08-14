<?php

namespace App\Modules\Dispatch\Services;

use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Enums\ApprovalStatus;
use App\Modules\Dispatch\Enums\DispatchAssignmentOfferStatus;
use App\Modules\Dispatch\Enums\DispatchAttemptStatus;
use App\Modules\Dispatch\Enums\DispatchPlanVersionStatus;
use App\Modules\Dispatch\Enums\DispatchReconciliationFindingSeverity;
use App\Modules\Dispatch\Enums\DispatchReconciliationRunStatus;
use App\Modules\Dispatch\Enums\DispatchSourceType;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\ApprovalRequest;
use App\Modules\Dispatch\Models\DispatchAssignmentOffer;
use App\Modules\Dispatch\Models\DispatchAuditLineage;
use App\Modules\Dispatch\Models\DispatchExecutionAttempt;
use App\Modules\Dispatch\Models\DispatchHandoff;
use App\Modules\Dispatch\Models\DispatchIdempotencyKey;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Models\DispatchPlanApproval;
use App\Modules\Dispatch\Models\DispatchPlanVersion;
use App\Modules\Dispatch\Models\DispatchReconciliationFinding;
use App\Modules\Dispatch\Models\DispatchReconciliationRun;
use App\Modules\Dispatch\Models\ServiceRequest;
use App\Modules\Rental\Models\RentalReservation;
use App\Modules\Sales\Models\SalesOrder;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Idempotency\Models\CommandLog;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

final class DispatchV2Reconciliation
{
    private const WORKSPACE_KEY = 'operations';

    /**
     * Reconcile a bounded, resumable batch of legacy dispatch data.
     */
    public function run(int $limit = 100, bool $dryRun = false, ?int $runId = null): DispatchReconciliationRun
    {
        if ($limit < 1) {
            throw new RuntimeException('The reconciliation limit must be at least 1.');
        }

        $run = $runId === null
            ? DispatchReconciliationRun::query()->create([
                'name' => 'dispatch_v2_foundation',
                'workspace_key' => self::WORKSPACE_KEY,
                'status' => DispatchReconciliationRunStatus::Running,
                'dry_run' => $dryRun,
                'batch_limit' => $limit,
                'checkpoint' => $this->emptyCheckpoint(),
                'started_at' => now(),
            ])
            : DispatchReconciliationRun::query()->findOrFail($runId);

        if ($run->getRawOriginal('status') === DispatchReconciliationRunStatus::Completed->value) {
            return $run;
        }

        $run->update([
            'status' => DispatchReconciliationRunStatus::Running,
            'batch_limit' => $limit,
            'last_error' => null,
        ]);

        $checkpoint = $this->checkpoint($run);

        try {
            $jobBatchComplete = $this->reconcileJobs($run, $checkpoint, $limit);
            $commandBatchComplete = $this->reconcileCommandLogs($run, $checkpoint, $limit);
            $auditBatchComplete = $this->reconcileAuditEvents($run, $checkpoint, $limit);
            $this->reconcileCanonicalIntegrity($run, $limit);

            $complete = $jobBatchComplete && $commandBatchComplete && $auditBatchComplete;
            $run->update([
                'checkpoint' => $checkpoint,
                'status' => $complete ? DispatchReconciliationRunStatus::Completed : DispatchReconciliationRunStatus::Running,
                'completed_at' => $complete ? now() : null,
            ]);
        } catch (\Throwable $exception) {
            $run->update([
                'checkpoint' => $checkpoint,
                'status' => DispatchReconciliationRunStatus::Failed,
                'last_error' => $exception->getMessage(),
            ]);

            throw $exception;
        }

        return $run->refresh();
    }

    /** @return array{dispatch_jobs: int, command_logs: int, audit_events: int} */
    private function emptyCheckpoint(): array
    {
        return ['dispatch_jobs' => 0, 'command_logs' => 0, 'audit_events' => 0];
    }

    /** @return array{dispatch_jobs: int, command_logs: int, audit_events: int} */
    private function checkpoint(DispatchReconciliationRun $run): array
    {
        $checkpoint = $run->getAttribute('checkpoint');
        if (! is_array($checkpoint)) {
            return $this->emptyCheckpoint();
        }

        return [
            'dispatch_jobs' => (int) ($checkpoint['dispatch_jobs'] ?? 0),
            'command_logs' => (int) ($checkpoint['command_logs'] ?? 0),
            'audit_events' => (int) ($checkpoint['audit_events'] ?? 0),
        ];
    }

    /** @param array{dispatch_jobs: int, command_logs: int, audit_events: int} $checkpoint */
    private function reconcileJobs(DispatchReconciliationRun $run, array &$checkpoint, int $limit): bool
    {
        $jobs = DispatchJob::query()
            ->withTrashed()
            ->where('id', '>', $checkpoint['dispatch_jobs'])
            ->orderBy('id')
            ->limit($limit)
            ->get();

        foreach ($jobs as $job) {
            if ($run->dry_run) {
                $this->inspectLegacyJob($run, $job);
            } else {
                DB::transaction(fn (): DispatchExecutionAttempt => $this->reconcileJob($run, $job));
            }

            $checkpoint['dispatch_jobs'] = (int) $job->getKey();
            $run->increment('scanned_count');
        }

        return ! DispatchJob::query()->withTrashed()->where('id', '>', $checkpoint['dispatch_jobs'])->exists();
    }

    private function inspectLegacyJob(DispatchReconciliationRun $run, DispatchJob $job): void
    {
        $source = $this->resolveSource($run, $job);
        $status = $this->mapAttemptStatus($run, $job);
        $this->mapSchedule($run, $job);
        $this->legacyArchiveAt($run, $job, $status['status']);
        $this->jobSnapshot($job, $source);
    }

    /** @param array{dispatch_jobs: int, command_logs: int, audit_events: int} $checkpoint */
    private function reconcileCommandLogs(DispatchReconciliationRun $run, array &$checkpoint, int $limit): bool
    {
        $logs = CommandLog::query()
            ->where('id', '>', $checkpoint['command_logs'])
            ->orderBy('id')
            ->limit($limit)
            ->get();

        foreach ($logs as $log) {
            if (! $run->dry_run) {
                DB::transaction(fn (): DispatchIdempotencyKey => $this->reconcileCommandLog($log));
            }

            $checkpoint['command_logs'] = (int) $log->getKey();
            $run->increment('scanned_count');
        }

        return ! CommandLog::query()->where('id', '>', $checkpoint['command_logs'])->exists();
    }

    /** @param array{dispatch_jobs: int, command_logs: int, audit_events: int} $checkpoint */
    private function reconcileAuditEvents(DispatchReconciliationRun $run, array &$checkpoint, int $limit): bool
    {
        $events = AuditEvent::query()
            ->where('id', '>', $checkpoint['audit_events'])
            ->orderBy('id')
            ->limit($limit)
            ->get();

        foreach ($events as $event) {
            if (! $run->dry_run) {
                $processed = DB::transaction(fn (): bool => $this->reconcileAuditEvent($event));
                if (! $processed) {
                    return false;
                }
            }

            $checkpoint['audit_events'] = (int) $event->getKey();
            $run->increment('scanned_count');
        }

        return ! AuditEvent::query()->where('id', '>', $checkpoint['audit_events'])->exists();
    }

    private function reconcileJob(DispatchReconciliationRun $run, DispatchJob $job): DispatchExecutionAttempt
    {
        $source = $this->resolveSource($run, $job);
        $handoffAttributes = [
            'workspace_key' => self::WORKSPACE_KEY,
            'source_type' => $source['type'],
            'source_id' => $source['id'],
            'source_reference' => $source['reference'],
            'legacy_dispatch_job_id' => $job->id,
            'created_by' => $this->rawInt($job, 'created_by'),
            'compatibility_state' => $source['state'],
            'legacy_snapshot' => $this->jobSnapshot($job, $source),
        ];

        $existingHandoff = DispatchHandoff::query()->where('legacy_dispatch_job_id', $job->id)->first();
        if ($existingHandoff instanceof DispatchHandoff) {
            $handoff = $existingHandoff;
        } else {
            $sourceCollision = DispatchHandoff::query()
                ->where('workspace_key', self::WORKSPACE_KEY)
                ->where('source_system', 'core2')
                ->where('source_type', $handoffAttributes['source_type'])
                ->where('source_id', $handoffAttributes['source_id'])
                ->exists();

            if ($sourceCollision) {
                $this->finding($run, 'dispatch_job', $job->id, 'duplicate_source_link', DispatchReconciliationFindingSeverity::Blocker, [
                    'source_type' => $handoffAttributes['source_type'],
                    'source_id' => $handoffAttributes['source_id'],
                ]);
                $handoffAttributes['source_type'] = 'legacy_dispatch_job';
                $handoffAttributes['source_id'] = $job->id;
                $handoffAttributes['source_reference'] = (string) $this->raw($job, 'reference');
                $handoffAttributes['compatibility_state'] = 'legacy_duplicate_source_link';
            }

            $handoff = DispatchHandoff::query()->create($handoffAttributes);
            $run->increment('created_count');
        }

        $status = $this->mapAttemptStatus($run, $job);
        $schedule = $this->mapSchedule($run, $job);
        $attempt = DispatchExecutionAttempt::query()->where('legacy_dispatch_job_id', $job->id)->first();

        if (! $attempt instanceof DispatchExecutionAttempt) {
            $attempt = DispatchExecutionAttempt::query()->create([
                'handoff_id' => $handoff->id,
                'workspace_key' => self::WORKSPACE_KEY,
                'attempt_number' => 1,
                'legacy_dispatch_job_id' => $job->id,
                'status' => $status['status'],
                'legacy_status' => $status['legacy_status'],
                'compatibility_state' => $status['compatibility_state'],
                'scheduled_start' => $schedule['start'],
                'scheduled_end' => $schedule['end'],
                'version' => max(1, $this->rawInt($job, 'version') ?? 1),
                'legacy_snapshot' => $this->jobSnapshot($job, $source),
                'created_by' => $this->rawInt($job, 'created_by'),
                'activated_by' => $this->rawInt($job, 'activated_by'),
                'cancelled_by' => $this->rawInt($job, 'cancelled_by'),
                'cancellation_reason' => $this->raw($job, 'cancellation_reason'),
                'legacy_deleted_at' => $this->raw($job, 'deleted_at'),
                'archived_at' => $this->legacyArchiveAt($run, $job, $status['status']),
            ]);
            $run->increment('created_count');
        }

        $plan = $this->reconcilePlan($run, $job, $attempt, $schedule);
        $this->reconcileOffers($run, $job, $attempt, $plan);

        return $attempt;
    }

    /** @return array{type: string, id: int, reference: string, state: string} */
    private function resolveSource(DispatchReconciliationRun $run, DispatchJob $job): array
    {
        $rawType = $this->raw($job, 'source_type');
        $rawId = $this->rawInt($job, 'source_id');

        if ($rawType === null && ($serviceRequestId = $this->rawInt($job, 'service_request_id')) !== null) {
            $rawType = DispatchSourceType::ServiceRequest->value;
            $rawId = $serviceRequestId;
        }

        if ($rawType === null && $rawId === null) {
            return [
                'type' => DispatchSourceType::Manual->value,
                'id' => $job->id,
                'reference' => (string) ($this->raw($job, 'source_reference') ?: $this->raw($job, 'reference')),
                'state' => 'manual_source',
            ];
        }

        $sourceType = is_string($rawType) ? DispatchSourceType::tryFrom($rawType) : null;

        if ($sourceType === DispatchSourceType::Manual && $rawId === $job->id) {
            return [
                'type' => DispatchSourceType::Manual->value,
                'id' => $job->id,
                'reference' => (string) ($this->raw($job, 'source_reference') ?: $this->raw($job, 'reference')),
                'state' => 'manual_source',
            ];
        }

        $source = $sourceType !== null && $rawId !== null ? $this->sourceQuery($sourceType, $rawId) : null;

        if (! $source instanceof Model) {
            $this->finding($run, 'dispatch_job', $job->id, 'invalid_source_link', DispatchReconciliationFindingSeverity::Blocker, [
                'source_type' => $rawType,
                'source_id' => $rawId,
            ]);

            return [
                'type' => 'legacy_dispatch_job',
                'id' => $job->id,
                'reference' => (string) $this->raw($job, 'reference'),
                'state' => 'legacy_invalid_source_link',
            ];
        }

        $sourceReference = (string) ($source->getAttribute('reference') ?: $this->raw($job, 'source_reference') ?: $this->raw($job, 'reference'));
        $legacyReference = $this->raw($job, 'source_reference');
        if (is_string($legacyReference) && $legacyReference !== '' && $legacyReference !== $sourceReference) {
            $isLegacyLengthMismatch = strlen($legacyReference) === 48 && str_starts_with($sourceReference, $legacyReference);
            $this->finding(
                $run,
                'dispatch_job',
                $job->id,
                $isLegacyLengthMismatch ? 'legacy_source_reference_truncated' : 'source_reference_mismatch',
                $isLegacyLengthMismatch ? DispatchReconciliationFindingSeverity::Warning : DispatchReconciliationFindingSeverity::Blocker,
                ['legacy_reference' => $legacyReference, 'source_reference' => $sourceReference],
            );
        }

        $this->checkSourceSymmetry($run, $job, $sourceType, $source);

        return [
            'type' => $sourceType->value,
            'id' => $rawId,
            'reference' => $sourceReference,
            'state' => 'legacy_source_linked',
        ];
    }

    private function sourceQuery(DispatchSourceType $sourceType, int $sourceId): ?Model
    {
        return match ($sourceType) {
            DispatchSourceType::Manual => null,
            DispatchSourceType::ServiceRequest => ServiceRequest::query()->withTrashed()->find($sourceId),
            DispatchSourceType::RentalReservation => RentalReservation::query()->withTrashed()->find($sourceId),
            DispatchSourceType::SalesOrder => SalesOrder::query()->find($sourceId),
        };
    }

    private function reconcileCanonicalIntegrity(DispatchReconciliationRun $run, int $limit): void
    {
        DispatchExecutionAttempt::query()->orderBy('id')->limit($limit)->get()->each(function (DispatchExecutionAttempt $attempt) use ($run): void {
            $handoff = DispatchHandoff::query()->find($attempt->handoff_id);
            if (! $handoff instanceof DispatchHandoff) {
                $this->finding($run, 'dispatch_attempt', $attempt->id, 'orphan_attempt', DispatchReconciliationFindingSeverity::Blocker, [
                    'handoff_id' => $attempt->handoff_id,
                ]);

                return;
            }

            if ($handoff->workspace_key !== $attempt->workspace_key) {
                $this->finding($run, 'dispatch_attempt', $attempt->id, 'workspace_mismatch', DispatchReconciliationFindingSeverity::Blocker, [
                    'attempt_workspace' => $attempt->workspace_key,
                    'handoff_workspace' => $handoff->workspace_key,
                ]);
            }

            if ($attempt->legacy_dispatch_job_id !== null && (int) $attempt->legacy_dispatch_job_id !== (int) $handoff->legacy_dispatch_job_id) {
                $this->finding($run, 'dispatch_attempt', $attempt->id, 'attempt_handoff_mismatch', DispatchReconciliationFindingSeverity::Blocker, [
                    'attempt_legacy_dispatch_job_id' => $attempt->legacy_dispatch_job_id,
                    'handoff_legacy_dispatch_job_id' => $handoff->legacy_dispatch_job_id,
                ]);
            }
        });

        DispatchHandoff::query()->orderBy('id')->limit($limit)->get()->each(function (DispatchHandoff $handoff) use ($run): void {
            $sourceType = DispatchSourceType::tryFrom((string) $handoff->source_type);
            $source = $sourceType !== null ? $this->sourceQuery($sourceType, (int) $handoff->source_id) : null;

            if ($sourceType === DispatchSourceType::Manual) {
                return;
            }

            if (! $source instanceof Model) {
                $this->finding($run, 'dispatch_handoff', $handoff->id, 'orphaned_source', DispatchReconciliationFindingSeverity::Blocker, [
                    'source_type' => $handoff->source_type,
                    'source_id' => $handoff->source_id,
                ]);

                return;
            }

            $sourceReference = (string) ($source->getAttribute('reference') ?? '');
            $externalReference = (string) ($handoff->external_reference ?: $handoff->source_reference);
            if ($sourceReference !== '' && $externalReference !== '' && $sourceReference !== $externalReference) {
                $longReference = $sourceType === DispatchSourceType::SalesOrder
                    && strlen($externalReference) < strlen($sourceReference)
                    && str_starts_with($sourceReference, $externalReference);
                $this->finding(
                    $run,
                    'dispatch_handoff',
                    $handoff->id,
                    $longReference ? 'long_sales_reference_truncated' : 'source_hash_mismatch',
                    $longReference ? DispatchReconciliationFindingSeverity::Warning : DispatchReconciliationFindingSeverity::Blocker,
                    ['canonical_reference' => $externalReference, 'source_reference' => $sourceReference],
                );
            }

            $storedSourcePayload = data_get($handoff->legacy_snapshot, 'canonical_source_payload.source');
            if (is_array($storedSourcePayload)) {
                $currentSourcePayload = $source->getAttributes();
                unset($currentSourcePayload['dispatch_job_id'], $currentSourcePayload['created_at'], $currentSourcePayload['updated_at']);
                if ($this->hashPayload($storedSourcePayload) !== $this->hashPayload($currentSourcePayload)) {
                    $this->finding($run, 'dispatch_handoff', $handoff->id, 'source_hash_mismatch', DispatchReconciliationFindingSeverity::Blocker, [
                        'stored_source_hash' => $this->hashPayload($storedSourcePayload),
                        'current_source_hash' => $this->hashPayload($currentSourcePayload),
                    ]);
                }
            }

            if (in_array($sourceType, [DispatchSourceType::RentalReservation, DispatchSourceType::SalesOrder], true)
                && (int) $source->getAttribute('dispatch_job_id') !== (int) $handoff->legacy_dispatch_job_id) {
                $this->finding($run, 'dispatch_handoff', $handoff->id, 'asymmetric_reverse_pointer', DispatchReconciliationFindingSeverity::Blocker, [
                    'source_dispatch_job_id' => $source->getAttribute('dispatch_job_id'),
                    'handoff_legacy_dispatch_job_id' => $handoff->legacy_dispatch_job_id,
                ]);
            }

            if (method_exists($source, 'requiresDispatch') && $source->requiresDispatch() && $source->getAttribute('dispatch_job_id') !== null) {
                $completed = $handoff->attempts()
                    ->where('workspace_key', $handoff->workspace_key)
                    ->where('status', DispatchAttemptStatus::Completed)
                    ->whereNull('archived_at')
                    ->exists();
                if (! $completed) {
                    $this->finding($run, 'dispatch_handoff', $handoff->id, 'terminal_delivery_violation', DispatchReconciliationFindingSeverity::Blocker, [
                        'source_type' => $handoff->source_type,
                        'source_id' => $handoff->source_id,
                    ]);
                }
            }

            $duplicateHandoffs = DispatchHandoff::query()
                ->where('id', '!=', $handoff->id)
                ->where('workspace_key', $handoff->workspace_key)
                ->where('source_system', $handoff->source_system)
                ->where('source_type', $handoff->source_type)
                ->where('source_id', $handoff->source_id)
                ->exists();
            if ($duplicateHandoffs) {
                $this->finding($run, 'dispatch_handoff', $handoff->id, 'duplicate_source_handoff', DispatchReconciliationFindingSeverity::Blocker, [
                    'source_type' => $handoff->source_type,
                    'source_id' => $handoff->source_id,
                ]);
            }
        });

        DB::table('dispatch_execution_attempts')
            ->select('handoff_id', 'attempt_number')
            ->groupBy('handoff_id', 'attempt_number')
            ->havingRaw('count(*) > 1')
            ->limit($limit)
            ->get()
            ->each(function (object $duplicate) use ($run): void {
                $this->finding($run, 'dispatch_handoff', (int) $duplicate->handoff_id, 'duplicate_attempt_number', DispatchReconciliationFindingSeverity::Blocker, [
                    'attempt_number' => (int) $duplicate->attempt_number,
                ]);
            });
    }

    private function checkSourceSymmetry(DispatchReconciliationRun $run, DispatchJob $job, ?DispatchSourceType $sourceType, Model $source): void
    {
        if ($sourceType === DispatchSourceType::ServiceRequest) {
            $legacyServiceRequestId = $this->rawInt($job, 'service_request_id');
            if ($legacyServiceRequestId !== null && $legacyServiceRequestId !== (int) $source->getKey()) {
                $this->finding($run, 'dispatch_job', $job->id, 'asymmetric_source_link', DispatchReconciliationFindingSeverity::Blocker, [
                    'service_request_id' => $legacyServiceRequestId,
                    'source_id' => $source->getKey(),
                ]);
            }
        }

        if (in_array($sourceType, [DispatchSourceType::RentalReservation, DispatchSourceType::SalesOrder], true)) {
            $backReference = $source->getAttribute('dispatch_job_id');
            if ((int) $backReference !== (int) $job->id) {
                $this->finding($run, 'dispatch_job', $job->id, 'asymmetric_source_link', DispatchReconciliationFindingSeverity::Blocker, [
                    'source_type' => $sourceType->value,
                    'source_id' => $source->getKey(),
                    'source_dispatch_job_id' => $backReference,
                ]);
            }
        }
    }

    /** @return array{status: string, legacy_status: string|null, compatibility_state: string} */
    private function mapAttemptStatus(DispatchReconciliationRun $run, DispatchJob $job): array
    {
        $legacyStatus = $this->raw($job, 'status');
        $status = is_string($legacyStatus) ? DispatchAttemptStatus::tryFrom($legacyStatus) : null;

        if ($status instanceof DispatchAttemptStatus) {
            return ['status' => $status->value, 'legacy_status' => $legacyStatus, 'compatibility_state' => 'legacy_direct'];
        }

        if ($legacyStatus === DispatchStatus::PendingApproval->value || $legacyStatus === DispatchStatus::Scheduled->value) {
            return ['status' => DispatchAttemptStatus::Draft->value, 'legacy_status' => $legacyStatus, 'compatibility_state' => 'legacy_'.$legacyStatus.'_derived'];
        }

        if ($legacyStatus === DispatchStatus::Accepted->value) {
            return ['status' => DispatchAttemptStatus::Dispatched->value, 'legacy_status' => $legacyStatus, 'compatibility_state' => 'legacy_job_accepted_derived'];
        }

        $this->finding($run, 'dispatch_job', $job->id, 'invalid_legacy_status', DispatchReconciliationFindingSeverity::Blocker, ['legacy_status' => $legacyStatus]);

        return ['status' => DispatchAttemptStatus::Draft->value, 'legacy_status' => is_string($legacyStatus) ? $legacyStatus : null, 'compatibility_state' => 'legacy_invalid_status'];
    }

    /** @return array{start: CarbonImmutable|null, end: CarbonImmutable|null} */
    private function mapSchedule(DispatchReconciliationRun $run, DispatchJob $job): array
    {
        $rawStart = $this->raw($job, 'scheduled_start');
        $rawEnd = $this->raw($job, 'scheduled_end');
        $start = $this->carbon($rawStart);
        $end = $this->carbon($rawEnd);

        if (($rawStart !== null && $rawStart !== '' && $start === null) || ($rawEnd !== null && $rawEnd !== '' && $end === null)) {
            $this->finding($run, 'dispatch_job', $job->id, 'invalid_schedule_value', DispatchReconciliationFindingSeverity::Blocker, [
                'scheduled_start' => $rawStart,
                'scheduled_end' => $rawEnd,
            ]);

            return ['start' => null, 'end' => null];
        }

        if ($start !== null && $end !== null && $end->lessThanOrEqualTo($start)) {
            $this->finding($run, 'dispatch_job', $job->id, 'invalid_schedule_interval', DispatchReconciliationFindingSeverity::Blocker, [
                'scheduled_start' => $start->toIso8601String(),
                'scheduled_end' => $end->toIso8601String(),
            ]);

            return ['start' => null, 'end' => null];
        }

        return ['start' => $start, 'end' => $end];
    }

    private function legacyArchiveAt(DispatchReconciliationRun $run, DispatchJob $job, string $status): ?CarbonImmutable
    {
        $deletedAt = $this->carbon($this->raw($job, 'deleted_at'));
        if ($deletedAt === null) {
            return null;
        }

        if (in_array($status, [DispatchAttemptStatus::Completed->value, DispatchAttemptStatus::Cancelled->value], true)) {
            return $deletedAt;
        }

        $this->finding($run, 'dispatch_job', $job->id, 'non_terminal_legacy_archive', DispatchReconciliationFindingSeverity::Blocker, [
            'status' => $status,
            'deleted_at' => $deletedAt->toIso8601String(),
        ]);

        return null;
    }

    /** @param array{start: CarbonImmutable|null, end: CarbonImmutable|null} $schedule */
    private function reconcilePlan(DispatchReconciliationRun $run, DispatchJob $job, DispatchExecutionAttempt $attempt, array $schedule): DispatchPlanVersion
    {
        $existing = DispatchPlanVersion::query()->where('attempt_id', $attempt->id)->where('version', 1)->first();
        if ($existing instanceof DispatchPlanVersion) {
            return $existing;
        }

        $approvals = ApprovalRequest::query()
            ->where('subject_type', $job->getMorphClass())
            ->where('subject_id', $job->id)
            ->orderBy('id')
            ->get();
        $latestApproval = $approvals->last();
        $planStatus = match ($latestApproval?->status?->value) {
            ApprovalStatus::Approved->value => DispatchPlanVersionStatus::Approved,
            ApprovalStatus::Rejected->value => DispatchPlanVersionStatus::Rejected,
            ApprovalStatus::Pending->value => DispatchPlanVersionStatus::Submitted,
            default => DispatchPlanVersionStatus::Draft,
        };
        $snapshot = [
            'legacy_dispatch_job_id' => $job->id,
            'reference' => $this->raw($job, 'reference'),
            'client' => $this->raw($job, 'client'),
            'title' => $this->raw($job, 'title'),
            'site' => $this->raw($job, 'site'),
            'site_notes' => $this->raw($job, 'site_notes'),
            'priority' => $this->raw($job, 'priority'),
            'requirements' => $this->jsonValue($this->raw($job, 'requirements')),
            'scheduled_start' => $schedule['start']?->toIso8601String(),
            'scheduled_end' => $schedule['end']?->toIso8601String(),
        ];

        $createdAt = $this->carbon($this->raw($job, 'created_at')) ?? now()->toImmutable();
        $plan = DispatchPlanVersion::query()->create([
            'attempt_id' => $attempt->id,
            'workspace_key' => self::WORKSPACE_KEY,
            'version' => 1,
            'status' => $planStatus,
            'snapshot' => $snapshot,
            'content_hash' => $this->hashPayload($snapshot),
            'scheduled_start' => $schedule['start'],
            'scheduled_end' => $schedule['end'],
            'created_by' => $this->rawInt($job, 'created_by'),
            'submitted_by' => $latestApproval?->requested_by,
            'submitted_at' => $latestApproval?->created_at,
            'sealed_at' => $createdAt,
            'created_at' => $createdAt,
        ]);
        $run->increment('created_count');

        foreach ($approvals as $approval) {
            DispatchPlanApproval::query()->firstOrCreate(
                ['approval_request_id' => $approval->id],
                [
                    'plan_version_id' => $plan->id,
                    'kind' => $approval->kind,
                    'status' => $approval->status->value,
                    'requested_by' => $approval->requested_by,
                    'decided_by' => $approval->decided_by,
                    'reason' => $approval->reason,
                    'decided_at' => $approval->decided_at,
                ],
            );
        }

        return $plan;
    }

    private function reconcileOffers(DispatchReconciliationRun $run, DispatchJob $job, DispatchExecutionAttempt $attempt, DispatchPlanVersion $plan): void
    {
        $assignments = DispatchPersonnelAssignment::query()->where('dispatch_job_id', $job->id)->orderBy('id')->get();

        foreach ($assignments as $assignment) {
            if (DispatchAssignmentOffer::query()->where('legacy_assignment_id', $assignment->id)->exists()) {
                continue;
            }

            $legacyStatus = (string) $assignment->getRawOriginal('response_status');
            $status = match ($legacyStatus) {
                'accepted' => DispatchAssignmentOfferStatus::Accepted,
                'rejected' => DispatchAssignmentOfferStatus::Rejected,
                default => $assignment->getRawOriginal('active_until') !== null
                    ? DispatchAssignmentOfferStatus::Withdrawn
                    : DispatchAssignmentOfferStatus::Offered,
            };
            $respondedAt = $this->carbon($assignment->getRawOriginal('responded_at'));
            $createdAt = $this->carbon($assignment->getRawOriginal('created_at')) ?? now()->toImmutable();

            DispatchAssignmentOffer::query()->create([
                'attempt_id' => $attempt->id,
                'plan_version_id' => $plan->id,
                'workspace_key' => self::WORKSPACE_KEY,
                'user_id' => $assignment->user_id,
                'legacy_assignment_id' => $assignment->id,
                'assignment_type' => $assignment->assignment_type,
                'is_mandatory' => false,
                'status' => $status,
                'offered_at' => $createdAt,
                'responded_at' => $respondedAt,
                'response_reason' => $assignment->response_reason,
                'accepted_at' => $status === DispatchAssignmentOfferStatus::Accepted ? $respondedAt : null,
                'rejected_at' => $status === DispatchAssignmentOfferStatus::Rejected ? $respondedAt : null,
                'withdrawn_at' => $status === DispatchAssignmentOfferStatus::Withdrawn ? ($this->carbon($assignment->getRawOriginal('active_until')) ?? $respondedAt) : null,
                'created_by' => $assignment->assigned_by,
                'approved_by' => $assignment->approved_by,
                'legacy_response_status' => $legacyStatus,
                'compatibility_state' => 'legacy_mandatory_and_lead_unknown',
            ]);
            $run->increment('created_count');
        }
    }

    private function reconcileCommandLog(CommandLog $log): DispatchIdempotencyKey
    {
        $existing = DispatchIdempotencyKey::query()->where('legacy_command_log_id', $log->id)->first();
        if ($existing instanceof DispatchIdempotencyKey) {
            return $existing;
        }

        return DispatchIdempotencyKey::query()->create([
            'workspace_key' => self::WORKSPACE_KEY,
            'owner_type' => 'user',
            'owner_id' => $log->user_id,
            'idempotency_key' => $log->command_id,
            'action_name' => $log->action_name,
            'payload_hash' => $log->payload_hash,
            'expected_version' => $log->expected_version,
            'status' => $log->status,
            'response_code' => $log->response_code,
            'response_payload' => $log->response_payload,
            'legacy_command_log_id' => $log->id,
            'claimed_at' => $log->created_at,
            'completed_at' => in_array($log->status, ['completed', 'failed', 'conflict'], true) ? $log->updated_at : null,
        ]);
    }

    private function reconcileAuditEvent(AuditEvent $event): bool
    {
        if (DispatchAuditLineage::query()->where('audit_event_id', $event->id)->exists()) {
            return true;
        }

        $type = (string) $event->getRawOriginal('subject_type');
        $subjectId = $event->getRawOriginal('subject_id');
        $handoff = null;
        $attempt = null;
        $plan = null;
        $offer = null;

        if ($this->isModelType($type, 'DispatchJob') && $subjectId !== null) {
            $handoff = DispatchHandoff::query()->where('legacy_dispatch_job_id', $subjectId)->first();
            if (! $handoff instanceof DispatchHandoff) {
                return false;
            }
            $attempt = $handoff->attempts()->first();
        } elseif ($this->isModelType($type, 'DispatchPersonnelAssignment') && $subjectId !== null) {
            $offer = DispatchAssignmentOffer::query()->where('legacy_assignment_id', $subjectId)->first();
            if (! $offer instanceof DispatchAssignmentOffer) {
                return false;
            }
            $attempt = $offer->attempt;
            $handoff = $attempt?->handoff;
            $plan = $offer->planVersion;
        } elseif ($this->isModelType($type, 'ApprovalRequest') && $subjectId !== null) {
            $binding = DispatchPlanApproval::query()->where('approval_request_id', $subjectId)->first();
            if (! $binding instanceof DispatchPlanApproval) {
                return false;
            }
            $plan = $binding->planVersion;
            $attempt = $plan->attempt;
            $handoff = $attempt->handoff;
        } else {
            $sourceType = $this->legacySourceType($type);
            if ($sourceType !== null && $subjectId !== null) {
                $handoff = DispatchHandoff::query()->where('source_type', $sourceType->value)->where('source_id', $subjectId)->first();
                if (! $handoff instanceof DispatchHandoff) {
                    return false;
                }
                $attempt = $handoff->attempts()->first();
            }
        }

        DispatchAuditLineage::query()->create([
            'audit_event_id' => $event->id,
            'workspace_key' => self::WORKSPACE_KEY,
            'handoff_id' => $handoff?->id,
            'attempt_id' => $attempt?->id,
            'plan_version_id' => $plan?->id,
            'offer_id' => $offer?->id,
            'lineage_type' => $handoff instanceof DispatchHandoff ? 'canonical' : 'legacy_out_of_scope',
            'legacy_subject_type' => $type !== '' ? $type : null,
            'legacy_subject_id' => $subjectId,
        ]);

        return true;
    }

    private function isModelType(string $type, string $shortName): bool
    {
        return $type === $shortName || Str::endsWith($type, '\\'.$shortName);
    }

    private function legacySourceType(string $type): ?DispatchSourceType
    {
        return match (true) {
            $this->isModelType($type, 'RentalReservation') => DispatchSourceType::RentalReservation,
            $this->isModelType($type, 'SalesOrder') => DispatchSourceType::SalesOrder,
            $this->isModelType($type, 'ServiceRequest') => DispatchSourceType::ServiceRequest,
            default => null,
        };
    }

    /** @param array<string, mixed> $source
     * @return array<string, mixed>
     */
    private function jobSnapshot(DispatchJob $job, array $source): array
    {
        return [
            'legacy_dispatch_job_id' => $job->id,
            'reference' => $this->raw($job, 'reference'),
            'status' => $this->raw($job, 'status'),
            'source_type' => $this->raw($job, 'source_type'),
            'source_id' => $this->raw($job, 'source_id'),
            'source_reference' => $this->raw($job, 'source_reference'),
            'canonical_source' => $source,
            'scheduled_start' => $this->raw($job, 'scheduled_start'),
            'scheduled_end' => $this->raw($job, 'scheduled_end'),
            'deleted_at' => $this->raw($job, 'deleted_at'),
        ];
    }

    /** @param array<string, mixed> $details */
    private function finding(DispatchReconciliationRun $run, string $entityType, int $entityId, string $code, DispatchReconciliationFindingSeverity $severity, array $details): void
    {
        $fingerprint = hash('sha256', implode('|', [$entityType, (string) $entityId, $code]));
        $finding = DispatchReconciliationFinding::query()->firstOrCreate(
            ['fingerprint' => $fingerprint],
            [
                'run_id' => $run->id,
                'workspace_key' => self::WORKSPACE_KEY,
                'entity_type' => $entityType,
                'entity_id' => $entityId,
                'code' => $code,
                'severity' => $severity,
                'details' => $details,
            ],
        );

        if ($finding->wasRecentlyCreated) {
            $run->increment('finding_count');
        }
    }

    private function raw(Model $model, string $key): mixed
    {
        return $model->getRawOriginal($key);
    }

    private function rawInt(Model $model, string $key): ?int
    {
        $value = $this->raw($model, $key);

        return $value === null ? null : (int) $value;
    }

    private function carbon(mixed $value): ?CarbonImmutable
    {
        if ($value === null || $value === '') {
            return null;
        }

        try {
            return CarbonImmutable::parse((string) $value);
        } catch (\Throwable) {
            return null;
        }
    }

    private function jsonValue(mixed $value): mixed
    {
        if (is_string($value)) {
            return json_decode($value, true) ?? $value;
        }

        return $value;
    }

    /** @param array<string, mixed> $payload */
    private function hashPayload(array $payload): string
    {
        return hash('sha256', json_encode($this->sortKeys($payload), JSON_THROW_ON_ERROR));
    }

    /** @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    private function sortKeys(array $payload): array
    {
        foreach ($payload as $key => $value) {
            if (is_array($value)) {
                $payload[$key] = $this->sortKeys($value);
            }
        }

        ksort($payload);

        return $payload;
    }
}
