<?php

use App\Platform\Gpt\Enums\GptRecommendationStatus;
use App\Platform\Gpt\Services\GptRecommendationTransition;

it('rejects lifecycle transitions that are not allowed by the backed enum', function (): void {
    $transitions = app(GptRecommendationTransition::class);

    $transitions->compareAndSet(
        999999,
        GptRecommendationStatus::Accepted,
        GptRecommendationStatus::PendingReview,
    );
})->throws(LogicException::class, "GPT recommendation cannot transition from 'accepted' to 'pending_review'.");
