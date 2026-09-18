<?php

namespace App\Platform\Notifications\Jobs;

use App\Platform\Notifications\Services\PushNotificationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ProcessPushReceiptsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    public function __construct()
    {
        $this->queue = (string) config('push.queue', 'default');
        $this->onQueue($this->queue);
    }

    public function handle(PushNotificationService $pushService): void
    {
        $result = $pushService->processPendingReceipts(100);

        Log::info('Processed push receipts batch', [
            'checked' => $result['checked'],
            'delivered' => $result['delivered'],
            'failed' => $result['failed'],
            'deactivated' => $result['deactivated'],
        ]);

        $pruned = $pushService->pruneOldDeliveries(30);
        if ($pruned > 0) {
            Log::info('Pruned expired push delivery records', ['count' => $pruned]);
        }
    }
}
