<?php

use App\Platform\Gpt\Enums\GptRecommendationStatus;

it('allows only the recommendation lifecycle transitions', function (): void {
    expect(GptRecommendationStatus::Draft->canTransitionTo(GptRecommendationStatus::Processing))->toBeTrue()
        ->and(GptRecommendationStatus::Processing->canTransitionTo(GptRecommendationStatus::PendingReview))->toBeTrue()
        ->and(GptRecommendationStatus::PendingReview->canTransitionTo(GptRecommendationStatus::Accepted))->toBeTrue()
        ->and(GptRecommendationStatus::PendingReview->canTransitionTo(GptRecommendationStatus::Rejected))->toBeTrue()
        ->and(GptRecommendationStatus::Accepted->canTransitionTo(GptRecommendationStatus::PendingReview))->toBeFalse()
        ->and(GptRecommendationStatus::Failed->canTransitionTo(GptRecommendationStatus::Processing))->toBeFalse();
});

it('identifies immutable terminal recommendation states', function (): void {
    expect(GptRecommendationStatus::Accepted->isTerminal())->toBeTrue()
        ->and(GptRecommendationStatus::Rejected->isTerminal())->toBeTrue()
        ->and(GptRecommendationStatus::Failed->isTerminal())->toBeTrue()
        ->and(GptRecommendationStatus::PendingReview->isTerminal())->toBeFalse();
});
