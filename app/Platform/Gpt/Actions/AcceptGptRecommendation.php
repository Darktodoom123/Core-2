<?php

namespace App\Platform\Gpt\Actions;

use App\Modules\Assignment\Actions\AssignDispatchResources;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Gpt\Enums\GptRecommendationStatus;
use App\Platform\Gpt\Models\GptRecommendation;
use App\Platform\Gpt\Services\BoundedContextBuilder;
use App\Platform\Gpt\Services\GptRecommendationTransition;
use App\Platform\Identity\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class AcceptGptRecommendation
{
    public function __construct(
        private AssignDispatchResources $assignAction,
        private BoundedContextBuilder $contextBuilder,
        private RecordAuditEvent $audit,
        private GptRecommendationTransition $transitions,
    ) {}

    public function handle(User $actor, GptRecommendation $recommendation): DispatchJob
    {
        Gate::forUser($actor)->authorize('decide', $recommendation);

        /** @var DispatchJob|array{message: string} $result */
        $result = DB::transaction(function () use ($actor, $recommendation): DispatchJob|array {
            /** @var GptRecommendation $lockedRecommendation */
            $lockedRecommendation = GptRecommendation::query()->lockForUpdate()->findOrFail($recommendation->id);

            if (! in_array($lockedRecommendation->subject_type, [DispatchJob::class, (new DispatchJob)->getMorphClass()], true)) {
                return ['message' => 'Recommendation subject is not a dispatch job.'];
            }

            $job = DispatchJob::query()->lockForUpdate()->find($lockedRecommendation->subject_id);
            if ($job === null) {
                return ['message' => 'Recommendation subject is not a dispatch job.'];
            }

            // All mutable preconditions are deliberately evaluated after both locks.
            // Reload the actor after the row locks. A privilege revoked while
            // this request waited must fail closed instead of relying on a
            // stale in-memory permission relationship.
            $lockedActor = User::query()->findOrFail($actor->id);
            Gate::forUser($lockedActor)->authorize('decide', $lockedRecommendation);

            if ($lockedRecommendation->status !== GptRecommendationStatus::PendingReview) {
                return ['message' => "Recommendation cannot be accepted in status '{$lockedRecommendation->status->value}'."];
            }

            if ($lockedRecommendation->isExpired()) {
                $this->transitions->transitionLocked($lockedRecommendation, GptRecommendationStatus::Expired);

                return ['message' => 'This GPT recommendation has expired (valid for 15 minutes). Please generate a fresh recommendation.'];
            }

            // Rebuild from the locked dispatch to verify context and version atomically.
            $currentContext = $this->contextBuilder->buildForDispatchJob($job);
            if ($lockedRecommendation->isStale($currentContext['context_hash'])) {
                $this->transitions->transitionLocked($lockedRecommendation, GptRecommendationStatus::Stale);

                return ['message' => 'The underlying dispatch context has changed since this recommendation was generated. Please generate a fresh recommendation.'];
            }

            $rawPayload = $lockedRecommendation->recommendation;
            if (! is_array($rawPayload)) {
                throw ValidationException::withMessages([
                    'gpt' => 'Recommendation payload contains invalid assignment structure.',
                ]);
            }

            /** @var list<array{user_id: int, assignment_type: string}> $personnel */
            $personnel = is_array($rawPayload['proposed_personnel'] ?? null) ? $rawPayload['proposed_personnel'] : [];

            /** @var list<array{operational_asset_id: int, assignment_type: string}> $assets */
            $assets = is_array($rawPayload['proposed_assets'] ?? null) ? $rawPayload['proposed_assets'] : [];

            // Execute operational mutation via the normal domain action under human authority if resources are proposed
            if ($personnel !== [] || $assets !== []) {
                $this->assignAction->handle($lockedActor, $job, $personnel, $assets);
            }

            $this->transitions->transitionLocked($lockedRecommendation, GptRecommendationStatus::Accepted, [
                'decided_by' => $lockedActor->id,
                'decided_at' => now(),
            ]);

            $this->audit->handle(
                $lockedActor,
                $job,
                'gpt.recommendation_accepted',
                null,
                [
                    'recommendation_id' => $lockedRecommendation->id,
                    'purpose' => $lockedRecommendation->purpose,
                    'model' => $lockedRecommendation->model,
                    'personnel_count' => count($personnel),
                    'assets_count' => count($assets),
                ]
            );

            return $job->fresh() ?? $job;
        });

        if (is_array($result)) {
            throw ValidationException::withMessages(['gpt' => $result['message']]);
        }

        return $result;
    }
}
