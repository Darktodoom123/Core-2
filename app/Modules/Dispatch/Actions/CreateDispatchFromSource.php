<?php

namespace App\Modules\Dispatch\Actions;

use App\Modules\Dispatch\Data\DispatchV2Mutation;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchSourceType;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchHandoff;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Services\DispatchV2CommandService;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class CreateDispatchFromSource
{
    public function __construct(
        private readonly RecordAuditEvent $audit,
        private readonly DispatchV2CommandService $v2Commands,
    ) {}

    /**
     * @param  array{
     *     reference: string,
     *     client: string,
     *     title: string,
     *     site: string,
     *     site_notes?: string|null,
     *     scheduled_start: Carbon|string,
     *     scheduled_end: Carbon|string,
     *     priority?: DispatchPriority|string,
     *     requirements?: array<int, string>
     * }  $attributes
     */
    public function handle(
        User $actor,
        Model $source,
        DispatchSourceType $sourceType,
        array $attributes,
    ): DispatchJob {
        return DB::transaction(fn (): DispatchJob => $this->handleWithinTransaction($actor, $source, $sourceType, $attributes));
    }

    /**
     * Create the legacy compatibility row and canonical handoff in the caller's transaction.
     * Source adapters use this when they already hold their source/resource locks.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function handleWithinTransaction(
        User $actor,
        Model $source,
        DispatchSourceType $sourceType,
        array $attributes,
    ): DispatchJob {
        Gate::forUser($actor)->authorize('create', DispatchJob::class);

        if ($source->getMorphClass() !== $sourceType->value) {
            throw ValidationException::withMessages([
                'source' => 'The operational source type does not match the selected source record.',
            ]);
        }

        $sourceId = (int) $source->getKey();
        if ($sourceId < 1 || (string) $source->getAttribute('reference') === '') {
            throw ValidationException::withMessages([
                'source' => 'The operational source is missing a stable identifier or reference.',
            ]);
        }

        return (function () use ($actor, $source, $sourceType, $sourceId, $attributes): DispatchJob {
            $lockedSource = $source->newQuery()->lockForUpdate()->find($sourceId);

            if (! $lockedSource instanceof Model || (method_exists($lockedSource, 'trashed') && $lockedSource->trashed())) {
                throw ValidationException::withMessages([
                    'source' => 'The operational source is no longer available.',
                ]);
            }

            $sourceReference = (string) $lockedSource->getAttribute('reference');

            $hasExplicitIdempotencyKey = is_string($attributes['idempotency_key'] ?? null)
                && trim((string) $attributes['idempotency_key']) !== '';
            if ($sourceType !== DispatchSourceType::ServiceRequest || $hasExplicitIdempotencyKey) {
                $existingHandoff = DispatchHandoff::query()
                    ->where('workspace_key', 'operations')
                    ->where('source_system', 'core2')
                    ->where('source_type', $sourceType->value)
                    ->where('source_id', $sourceId)
                    ->lockForUpdate()
                    ->first();
                if ($existingHandoff instanceof DispatchHandoff && $existingHandoff->legacyDispatchJob instanceof DispatchJob) {
                    $this->ensureCanonicalWithinTransaction($actor, $existingHandoff->legacyDispatchJob, $lockedSource, $sourceType, $attributes);

                    return $existingHandoff->legacyDispatchJob->refresh();
                }
            }

            if (DispatchJob::query()->withTrashed()->where('reference', $attributes['reference'])->exists()) {
                throw ValidationException::withMessages([
                    'reference' => 'The dispatch reference has already been taken.',
                ]);
            }

            $priority = $attributes['priority'] ?? DispatchPriority::Routine;
            $priority = $priority instanceof DispatchPriority
                ? $priority
                : DispatchPriority::from((string) $priority);

            $job = DispatchJob::query()->create([
                'service_request_id' => $sourceType === DispatchSourceType::ServiceRequest ? $lockedSource->getKey() : null,
                'source_type' => $sourceType->value,
                'source_id' => $lockedSource->getKey(),
                'source_reference' => $sourceReference,
                'reference' => $attributes['reference'],
                'client' => $attributes['client'],
                'title' => $attributes['title'],
                'site' => $attributes['site'],
                'site_notes' => $attributes['site_notes'] ?? null,
                'scheduled_start' => $attributes['scheduled_start'],
                'scheduled_end' => $attributes['scheduled_end'],
                'priority' => $priority,
                'status' => DispatchStatus::Draft,
                'requirements' => $attributes['requirements'] ?? [],
                'created_by' => $actor->id,
                'version' => 1,
            ]);

            $this->ensureCanonicalWithinTransaction($actor, $job, $lockedSource, $sourceType, $attributes);

            $this->audit->handle($actor, $job, 'dispatch.created', null, $job->toArray());

            return $job;
        })();
    }

    /** @param array<string, mixed> $attributes */
    public function ensureCanonicalWithinTransaction(
        User $actor,
        DispatchJob $job,
        Model $source,
        DispatchSourceType $sourceType,
        array $attributes,
    ): DispatchJob {
        $sourceId = (int) $source->getKey();
        $sourceReference = (string) $source->getAttribute('reference');
        $idempotencyKey = is_string($attributes['idempotency_key'] ?? null) && trim($attributes['idempotency_key']) !== ''
            ? trim((string) $attributes['idempotency_key'])
            : 'source-handoff:'.$sourceType->value.':'.$sourceId.':'.(string) ($attributes['reference'] ?? $sourceReference);
        $sourcePayload = $source->getAttributes();
        unset($sourcePayload['dispatch_job_id'], $sourcePayload['created_at'], $sourcePayload['updated_at']);

        $this->v2Commands->createWithinTransaction(
            $actor,
            $job,
            DispatchV2Mutation::forOwner(
                expectedVersion: 1,
                idempotencyKey: $idempotencyKey,
                ownerType: $sourceType->value,
                ownerId: $sourceId,
                workspaceKey: 'operations',
                reason: 'Canonical source handoff intake',
                payload: [
                    'canonical_handoff' => [
                        'source_system' => 'core2',
                        'source_type' => $sourceType->value,
                        'source_id' => $sourceId,
                        'external_reference' => $sourceReference,
                        'allow_new_attempt' => $sourceType === DispatchSourceType::ServiceRequest,
                        'replacement_policy' => $sourceType === DispatchSourceType::ServiceRequest ? 'service_replan' : null,
                        'payload' => [
                            'source' => $sourcePayload,
                            'dispatch' => $attributes,
                        ],
                    ],
                    'plan_snapshot' => [
                        'source_type' => $sourceType->value,
                        'source_id' => $sourceId,
                        'source_reference' => $sourceReference,
                        'scheduled_start' => Carbon::parse((string) $attributes['scheduled_start'])->toIso8601String(),
                        'scheduled_end' => Carbon::parse((string) $attributes['scheduled_end'])->toIso8601String(),
                        'requirements' => $attributes['requirements'] ?? [],
                    ],
                ],
            ),
        );

        return $job->refresh();
    }
}
