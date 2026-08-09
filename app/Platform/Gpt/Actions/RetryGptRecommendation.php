<?php

namespace App\Platform\Gpt\Actions;

use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Gpt\Enums\GptRecommendationStatus;
use App\Platform\Gpt\Models\GptRecommendation;
use App\Platform\Gpt\Services\RecordGptOperationalMetric;
use App\Platform\Identity\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class RetryGptRecommendation
{
    public function __construct(
        private GenerateGptRecommendation $generate,
        private RecordAuditEvent $audit,
        private RecordGptOperationalMetric $metrics,
    ) {}

    public function handle(User $actor, GptRecommendation $recommendation): GptRecommendation
    {
        $currentActor = User::query()->findOrFail($actor->id);

        Gate::forUser($currentActor)->authorize('retry', $recommendation);

        return DB::transaction(function () use ($currentActor, $recommendation): GptRecommendation {
            $locked = GptRecommendation::query()->lockForUpdate()->findOrFail($recommendation->id);
            $existingRetry = GptRecommendation::query()->where('retry_of_id', $locked->id)->first();
            if ($existingRetry instanceof GptRecommendation) {
                return $existingRetry;
            }

            Gate::forUser($currentActor)->authorize('retry', $locked);
            $locked->loadMissing('subject');
            $subject = $locked->subject;
            if ($subject === null) {
                throw ValidationException::withMessages([
                    'gpt' => 'The recommendation subject is no longer available.',
                ]);
            }

            $retryable = in_array($locked->status, [
                GptRecommendationStatus::Failed,
                GptRecommendationStatus::Expired,
                GptRecommendationStatus::Stale,
                GptRecommendationStatus::Rejected,
            ], true) || ($locked->status === GptRecommendationStatus::PendingReview && $locked->isExpired());

            if (! $retryable) {
                throw ValidationException::withMessages([
                    'gpt' => "Recommendation cannot be retried in status '{$locked->status->value}'.",
                ]);
            }

            $newRecommendation = $this->generate->handle($currentActor, $subject, $locked->purpose, $locked->id);

            $this->audit->handle(
                $currentActor,
                $subject,
                'gpt.recommendation_retried',
                null,
                [
                    'recommendation_id' => $locked->id,
                    'new_recommendation_id' => $newRecommendation->id,
                    'purpose' => $locked->purpose,
                    'model' => $newRecommendation->model,
                ],
            );
            $this->metrics->handle($newRecommendation, 'retried', [
                'status' => GptRecommendationStatus::Draft->value,
            ]);

            return $newRecommendation;
        });
    }
}
