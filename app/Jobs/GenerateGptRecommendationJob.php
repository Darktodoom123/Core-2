<?php

namespace App\Jobs;

use App\Actions\RecordAuditEvent;
use App\Models\GptRecommendation;
use App\Services\Gpt\OpenAiClientWrapper;
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

    public int $timeout = 60;

    /** @param array<string, mixed> $boundedContext */
    public function __construct(
        public int $recommendationId,
        public array $boundedContext
    ) {}

    public function handle(
        OpenAiClientWrapper $openAi,
        RecordAuditEvent $audit
    ): void {
        $recommendation = GptRecommendation::query()->find($this->recommendationId);
        if (! $recommendation instanceof GptRecommendation) {
            return;
        }

        if ($recommendation->status !== 'draft') {
            return;
        }

        $recommendation->update(['status' => 'processing']);

        $result = $openAi->generateRecommendation($this->boundedContext);

        if ($result['success']) {
            $recPayload = $result['recommendation'] ?? [];
            $recommendation->update([
                'status' => 'pending_review',
                'recommendation' => $recPayload,
                'conflicts' => $recPayload['conflicts'] ?? [],
                'response_summary' => $result['response_summary'],
                'usage' => $result['usage'],
                'cost_usd' => $result['cost_usd'],
                'expires_at' => now()->addMinutes(15),
                'error_message' => null,
            ]);

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
            $recommendation->update([
                'status' => 'failed',
                'error_message' => $result['error_message'],
                'response_summary' => $result['response_summary'],
            ]);

            Log::warning("GPT Recommendation #{$recommendation->id} failed: {$result['error_message']}");
        }
    }

    public function failed(\Throwable $exception): void
    {
        $recommendation = GptRecommendation::query()->find($this->recommendationId);
        if ($recommendation instanceof GptRecommendation && $recommendation->status !== 'accepted') {
            $recommendation->update([
                'status' => 'failed',
                'error_message' => 'Job execution failed: '.$exception->getMessage(),
            ]);
        }
    }
}
