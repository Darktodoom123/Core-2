<?php

use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Gpt\Jobs\PruneGptRecommendationsJob;
use App\Platform\Gpt\Models\GptRecommendation;
use App\Platform\Gpt\Models\GptRecommendationMetric;
use App\Platform\Identity\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('prunes due recommendation metadata idempotently and records a safe audit event', function (): void {
    $requester = User::factory()->create();
    $recommendation = GptRecommendation::query()->create([
        'requested_by' => $requester->id,
        'purpose' => 'dispatch_assignment',
        'context_hash' => str_repeat('a', 64),
        'input_references' => ['user_ids' => [], 'asset_ids' => []],
        'recommendation' => ['summary' => 'Sensitive provider content'],
        'conflicts' => [],
        'model' => 'gpt-5-mini',
        'status' => 'accepted',
        'prompt_summary' => 'Sensitive job title and site',
        'response_summary' => 'Sensitive provider response',
        'error_message' => 'Sensitive provider error',
        'purge_at' => now()->subMinute(),
    ]);
    $metric = GptRecommendationMetric::query()->create([
        'recommendation_id' => $recommendation->id,
        'event' => 'generated',
        'status' => 'accepted',
        'occurred_at' => now()->subDays(91),
        'purge_at' => now()->subMinute(),
    ]);

    $job = app(PruneGptRecommendationsJob::class);
    $audit = app(RecordAuditEvent::class);
    $job->handle($audit);
    $job->handle($audit);

    expect(GptRecommendation::query()->find($recommendation->id))->toBeNull()
        ->and(GptRecommendationMetric::query()->find($metric->id))->toBeNull()
        ->and(AuditEvent::query()->where('action', 'gpt.recommendation_purged')->count())->toBe(1);
});
