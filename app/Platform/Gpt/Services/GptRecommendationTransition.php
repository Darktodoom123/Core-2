<?php

namespace App\Platform\Gpt\Services;

use App\Platform\Gpt\Enums\GptRecommendationStatus;
use App\Platform\Gpt\Models\GptRecommendation;
use App\Platform\Workspace\Events\WorkspaceUpdated;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use LogicException;
use Throwable;

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
        $this->broadcastUpdate();
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

        $updated = GptRecommendation::query()
            ->whereKey($recommendationId)
            ->where('status', $from->value)
            ->update([
                ...$attributes,
                'status' => $to->value,
            ]) === 1;

        if ($updated) {
            $this->broadcastUpdate();
        }

        return $updated;
    }

    private function broadcastUpdate(): void
    {
        DB::afterCommit(static function (): void {
            try {
                WorkspaceUpdated::dispatch('gpt', 'updated');
            } catch (Throwable $exception) {
                Log::warning('GPT workspace update could not be broadcast.', ['error' => $exception::class]);
            }
        });
    }

    private function assertAllowed(GptRecommendationStatus $from, GptRecommendationStatus $to): void
    {
        if (! $from->canTransitionTo($to)) {
            throw new LogicException("GPT recommendation cannot transition from '{$from->value}' to '{$to->value}'.");
        }
    }
}
