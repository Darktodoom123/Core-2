<?php

namespace App\Modules\Dispatch\Jobs;

use App\Modules\Dispatch\Services\DispatchOutboxDeliveryService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

final class DeliverDispatchOutboxMessage implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(public readonly int $messageId) {}

    public function handle(DispatchOutboxDeliveryService $delivery): void
    {
        $delivery->deliver($this->messageId);
    }
}
