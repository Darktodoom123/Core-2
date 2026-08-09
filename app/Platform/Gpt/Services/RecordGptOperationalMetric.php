<?php

namespace App\Platform\Gpt\Services;

use App\Platform\Gpt\Models\GptRecommendation;
use App\Platform\Gpt\Models\GptRecommendationMetric;

final class RecordGptOperationalMetric
{
    /**
     * @param  array<string, mixed>  $values
     */
    public function handle(GptRecommendation $recommendation, string $event, array $values = []): void
    {
        $usage = is_array($values['usage'] ?? null) ? $values['usage'] : [];

        GptRecommendationMetric::query()->create([
            'recommendation_id' => $recommendation->getKey(),
            'event' => $event,
            'status' => is_string($values['status'] ?? null) ? $values['status'] : $recommendation->status->value,
            'latency_ms' => $this->nonNegativeInt($values['latency_ms'] ?? null),
            'prompt_tokens' => $this->nonNegativeInt($usage['prompt_tokens'] ?? null),
            'completion_tokens' => $this->nonNegativeInt($usage['completion_tokens'] ?? null),
            'total_tokens' => $this->nonNegativeInt($usage['total_tokens'] ?? null),
            'cost_usd' => is_numeric($values['cost_usd'] ?? null) ? (float) $values['cost_usd'] : null,
            'occurred_at' => now(),
            'purge_at' => now()->addDays(90),
        ]);
    }

    private function nonNegativeInt(mixed $value): ?int
    {
        return is_numeric($value) && (int) $value >= 0 ? (int) $value : null;
    }
}
