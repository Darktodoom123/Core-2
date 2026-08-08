<?php

namespace App\Platform\Gpt\Jobs;

use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Gpt\Models\GptRecommendation;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;

final class PruneGptRecommendationsJob implements ShouldQueue
{
    use Queueable;

    private const CHUNK_SIZE = 100;

    public int $tries = 2;

    /** @var list<int> */
    public array $backoff = [60, 300];

    public function handle(RecordAuditEvent $audit): void
    {
        GptRecommendation::query()
            ->where('purge_at', '<=', now())
            ->orderBy('id')
            ->select('id')
            ->chunkById(self::CHUNK_SIZE, function ($recommendations) use ($audit): void {
                foreach ($recommendations as $recommendation) {
                    DB::transaction(function () use ($recommendation, $audit): void {
                        $locked = GptRecommendation::query()->lockForUpdate()->find($recommendation->id);
                        if ($locked === null || $locked->purge_at === null || $locked->purge_at->isFuture()) {
                            return;
                        }

                        $audit->handle(
                            $locked->requestedBy,
                            $locked,
                            'gpt.recommendation_purged',
                            null,
                            ['recommendation_id' => $locked->id, 'purpose' => $locked->purpose],
                        );

                        $locked->delete();
                    });
                }
            });
    }
}
