<?php

namespace App\Platform\Safety\Jobs;

use App\Platform\Safety\Contracts\SosResponderDelivery;
use App\Platform\Safety\Models\SosIncident;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

final class DeliverSosResponderNotificationsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    /** @var array<int, int> */
    public array $backoff = [5, 15, 30];

    public function __construct(public readonly string $incidentId)
    {
        $this->onQueue((string) config('sos.queue', 'emergency'));
    }

    public function handle(SosResponderDelivery $delivery): void
    {
        SosIncident::query()->findOrFail($this->incidentId)->recipients()->with('user')->each($delivery->deliver(...));
    }
}
