<?php

namespace App\Platform\Gpt\Actions;

use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Gpt\Enums\GptRecommendationStatus;
use App\Platform\Gpt\Models\GptRecommendation;
use App\Platform\Identity\Models\User;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class RetryGptRecommendation
{
    public function __construct(
        private GenerateGptRecommendation $generate,
        private RecordAuditEvent $audit,
    ) {}

    public function handle(User $actor, GptRecommendation $recommendation): GptRecommendation
    {
        $currentActor = User::query()->findOrFail($actor->id);

        Gate::forUser($currentActor)->authorize('retry', $recommendation);

        $recommendation->loadMissing('subject');
        $subject = $recommendation->subject;
        if ($subject === null) {
            throw ValidationException::withMessages([
                'gpt' => 'The recommendation subject is no longer available.',
            ]);
        }

        $fresh = $recommendation->fresh();
        $retryable = $fresh instanceof GptRecommendation && (
            in_array($fresh->status, [
                GptRecommendationStatus::Failed,
                GptRecommendationStatus::Expired,
                GptRecommendationStatus::Stale,
                GptRecommendationStatus::Rejected,
            ], true)
            || ($fresh->status === GptRecommendationStatus::PendingReview && $fresh->isExpired())
        );

        if (! $retryable) {
            $status = $fresh instanceof GptRecommendation ? $fresh->status->value : 'unknown';

            throw ValidationException::withMessages([
                'gpt' => "Recommendation cannot be retried in status '{$status}'.",
            ]);
        }

        $newRecommendation = $this->generate->handle($currentActor, $subject, $fresh->purpose);

        $this->audit->handle(
            $currentActor,
            $subject,
            'gpt.recommendation_retried',
            null,
            [
                'recommendation_id' => $fresh->id,
                'new_recommendation_id' => $newRecommendation->id,
                'purpose' => $fresh->purpose,
                'model' => $newRecommendation->model,
            ],
        );

        return $newRecommendation;
    }
}
