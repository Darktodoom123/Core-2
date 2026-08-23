<?php

namespace App\Modules\Dispatch\Actions;

use App\Modules\Dispatch\Data\DispatchV2Mutation;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Services\DispatchV2CommandService;
use App\Modules\Dispatch\Services\ManualDispatchReferenceGenerator;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use Illuminate\Support\Facades\DB;

final class CreateManualDispatchHandoff
{
    public function __construct(
        private readonly DispatchV2CommandService $commands,
        private readonly RecordAuditEvent $audit,
        private readonly ManualDispatchReferenceGenerator $references,
    ) {}

    /** @param array<string, mixed> $attributes */
    public function handle(User $actor, array $attributes): DispatchJob
    {
        return DB::transaction(function () use ($actor, $attributes): DispatchJob {
            $attributes['reference'] ??= $this->references->generate();

            $job = DispatchJob::query()->create([
                ...$attributes,
                'status' => DispatchStatus::Draft,
                'created_by' => $actor->id,
                'version' => 1,
                'source_type' => null,
                'source_id' => null,
                'source_reference' => null,
            ]);

            $this->commands->createWithinTransaction(
                $actor,
                $job,
                DispatchV2Mutation::forOwner(
                    expectedVersion: 1,
                    idempotencyKey: 'manual-handoff:'.$job->id,
                    ownerType: User::class,
                    ownerId: $actor->id,
                    reason: 'Manual dispatch intake',
                    payload: [
                        'canonical_handoff' => [
                            'source_system' => 'core2',
                            'source_type' => 'manual',
                            'source_id' => $job->id,
                            'external_reference' => $job->reference,
                            'payload' => [
                                'reference' => $job->reference,
                                'client' => $job->client,
                                'title' => $job->title,
                                'site' => $job->site,
                                'scheduled_start' => $job->scheduled_start?->toIso8601String(),
                                'scheduled_end' => $job->scheduled_end?->toIso8601String(),
                                'priority' => $job->priority->value,
                                'requirements' => $job->requirements ?? [],
                            ],
                        ],
                        'plan_snapshot' => [
                            'reference' => $job->reference,
                            'title' => $job->title,
                            'site' => $job->site,
                            'scheduled_start' => $job->scheduled_start?->toIso8601String(),
                            'scheduled_end' => $job->scheduled_end?->toIso8601String(),
                            'requirements' => $job->requirements ?? [],
                        ],
                    ],
                ),
            );
            $this->audit->handle($actor, $job, 'dispatch.created', null, $job->toArray());

            return $job->refresh();
        });
    }
}
