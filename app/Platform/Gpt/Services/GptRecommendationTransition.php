<?php

namespace App\Platform\Gpt\Services;

use App\Platform\Gpt\Enums\GptRecommendationStatus;
use App\Platform\Gpt\Models\GptRecommendation;
use LogicException;

final class GptRecommendationTransition
{
    /** @param array<string, mixed> $attributes */
    public function transitionLocked(
        GptRecommendation $recommendation,
        GptRecommendationStatus $to,
        array $attributes = [],
    ): void {
        $from = $recommendation->status;
        $this->assertAllowed($from, $to);

        $recommendation->update([
            ...$attributes,
            'status' => $to,
        ]);
    }

    /**
     * Apply a transition only when the row is still in the expected source
     * state. This deliberately retains the worker compare-and-set guarantee.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function compareAndSet(
        int $recommendationId,
        GptRecommendationStatus $from,
        GptRecommendationStatus $to,
        array $attributes = [],
    ): bool {
        $this->assertAllowed($from, $to);

        return GptRecommendation::query()
            ->whereKey($recommendationId)
            ->where('status', $from->value)
            ->update([
                ...$attributes,
                'status' => $to->value,
            ]) === 1;
    }

    private function assertAllowed(GptRecommendationStatus $from, GptRecommendationStatus $to): void
    {
        if (! $from->canTransitionTo($to)) {
            throw new LogicException("GPT recommendation cannot transition from '{$from->value}' to '{$to->value}'.");
        }
    }
}
