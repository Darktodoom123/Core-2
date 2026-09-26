<?php

namespace App\Modules\Fuel\Notifications;

use App\Modules\Fuel\Models\FuelRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/** Web notification-center entry for fuel reviewers when a request arrives. */
final class FuelRequestSubmittedNotification extends Notification
{
    use Queueable;

    public function __construct(public readonly FuelRequest $fuel) {}

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        $asset = $this->fuel->asset->code ?? 'general use';

        return [
            'event' => 'fuel.submitted',
            'fuel_request_id' => $this->fuel->id,
            'reference' => $this->fuel->reference,
            'urgency' => $this->fuel->urgency,
            'quantity_litres' => (string) $this->fuel->quantity_litres,
            'asset_code' => $this->fuel->asset?->code,
            'requester_name' => $this->fuel->requester->name,
            'message' => "{$this->fuel->requester->name} requested {$this->fuel->quantity_litres} L for {$asset} ({$this->fuel->reference}).",
        ];
    }
}
