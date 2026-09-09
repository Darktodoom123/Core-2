<?php

use App\Platform\Attachments\Jobs\PruneExpiredAttachmentsJob;
use App\Platform\Gpt\Models\GptRecommendation;
use App\Platform\Gpt\Models\GptRecommendationMetric;
use App\Platform\Reporting\Jobs\PruneExpiredExportsJob;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('gpt:queue-status', function (): void {
    $counts = GptRecommendation::query()
        ->selectRaw('status, count(*) as count')
        ->groupBy('status')
        ->pluck('count', 'status')
        ->map(static fn (mixed $count): int => (int) $count)
        ->all();

    $this->line(json_encode([
        'pending' => (int) ($counts['draft'] ?? 0) + (int) ($counts['processing'] ?? 0),
        'pending_review' => (int) ($counts['pending_review'] ?? 0),
        'failed' => (int) ($counts['failed'] ?? 0),
        'accepted' => (int) ($counts['accepted'] ?? 0),
        'rejected' => (int) ($counts['rejected'] ?? 0),
        'last_metric_at' => GptRecommendationMetric::query()->max('occurred_at'),
    ], JSON_THROW_ON_ERROR));
})->purpose('Report safe aggregate GPT queue status without exposing recommendation context');

Artisan::command('reports:prune-expired', function (): void {
    $this->info('Pruning expired report export files...');
    PruneExpiredExportsJob::dispatchSync();
    $this->info('Expired report exports pruned successfully.');
})->purpose('Purge expired report export files from protected storage');

Artisan::command('attachments:prune-expired', function (): void {
    $this->info('Pruning expired attachments exceeding statutory retention...');
    PruneExpiredAttachmentsJob::dispatchSync();
    $this->info('Expired attachments pruned successfully.');
})->purpose('Purge attachments that have reached end-of-retention (statutory 7 years)');
