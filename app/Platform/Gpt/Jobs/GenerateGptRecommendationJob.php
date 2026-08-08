<?php

namespace App\Platform\Gpt\Jobs;

use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Gpt\Enums\GptRecommendationStatus;
use App\Platform\Gpt\Models\GptRecommendation;
use App\Platform\Gpt\Services\GptRecommendationTransition;
use App\Platform\Gpt\Services\OpenAiClientWrapper;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;

final class GenerateGptRecommendationJob implements ShouldQueue
{
    use InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    /** @var list<int> */
    public array $backoff = [10, 30];

    public int $timeout = 60;

    /** @param array<string, mixed> $boundedContext */
    public function __construct(
        public int $recommendationId,
        public array $boundedContext
    ) {}

    public function handle(
        OpenAiClientWrapper $openAi,
        RecordAuditEvent $audit,
        ?GptRecommendationTransition $transitions = null,
    ): void {
        $transitions ??= app(GptRecommendationTransition::class);

        $claimed = $transitions->compareAndSet(
            $this->recommendationId,
            GptRecommendationStatus::Draft,
            GptRecommendationStatus::Processing,
        );

        if (! $claimed) {
            return;
        }

        $recommendation = GptRecommendation::query()->find($this->recommendationId);
        if (! $recommendation instanceof GptRecommendation) {
            return;
        }

        $startedAt = microtime(true);
        $result = $openAi->generateRecommendation($this->boundedContext);
        $latencyMs = (int) round((microtime(true) - $startedAt) * 1000);

        if ($result['success']) {
            $recPayload = $result['recommendation'] ?? [];
            $updated = $transitions->compareAndSet(
                $recommendation->id,
                GptRecommendationStatus::Processing,
                GptRecommendationStatus::PendingReview,
                [
                    'recommendation' => $recPayload,
                    'conflicts' => $recPayload['conflicts'] ?? [],
                    'response_summary' => $result['response_summary'],
                    'usage' => $result['usage'],
                    'cost_usd' => $result['cost_usd'],
                    'expires_at' => now()->addMinutes(15),
                    'generated_at' => now(),
                    'latency_ms' => $latencyMs,
                    'error_message' => null,
                ],
            );

            if (! $updated) {
                return;
            }

            $recommendation->refresh();

            $requestedBy = $recommendation->requestedBy;
            if ($requestedBy !== null && $recommendation->subject !== null) {
                $audit->handle(
                    $requestedBy,
                    $recommendation->subject,
                    'gpt.recommendation_generated',
                    null,
                    [
                        'recommendation_id' => $recommendation->id,
                        'purpose' => $recommendation->purpose,
                        'model' => $recommendation->model,
                        'cost_usd' => $result['cost_usd'],
                        'expires_at' => $recommendation->expires_at instanceof Carbon ? $recommendation->expires_at->toIso8601String() : null,
                    ]
                );
            }
        } else {
            $updated = $transitions->compareAndSet(
                $recommendation->id,
                GptRecommendationStatus::Processing,
                GptRecommendationStatus::Failed,
                [
                    'error_message' => $result['is_timeout'] ? 'GPT generation timed out. Please retry.' : 'GPT generation failed. Please retry.',
                    'response_summary' => null,
                    'latency_ms' => $latencyMs,
                ],
            );

            if (! $updated) {
                return;
            }

            Log::warning('GPT recommendation generation failed.', [
                'recommendation_id' => $recommendation->id,
                'reason' => $result['is_timeout'] ? 'timeout' : 'provider_or_schema_failure',
            ]);
        }
    }

    public function failed(\Throwable $exception): void
    {
        $recommendation = GptRecommendation::query()->find($this->recommendationId);
        if ($recommendation instanceof GptRecommendation) {
            $transitions = app(GptRecommendationTransition::class);
            $attributes = ['error_message' => 'GPT generation failed. Retry to create a fresh recommendation.'];

            if ($recommendation->status === GptRecommendationStatus::Draft) {
                $transitions->compareAndSet($recommendation->id, GptRecommendationStatus::Draft, GptRecommendationStatus::Failed, $attributes);
            } elseif ($recommendation->status === GptRecommendationStatus::Processing) {
                $transitions->compareAndSet($recommendation->id, GptRecommendationStatus::Processing, GptRecommendationStatus::Failed, $attributes);
            }
        }
    }
}
