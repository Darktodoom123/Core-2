<?php

namespace App\Platform\Safety\Notifications;

use App\Platform\Safety\Models\SosIncident;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

final class SosIncidentNotification extends Notification
{
    use Queueable;

    public function __construct(public readonly SosIncident $incident) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return [
            'event' => 'safety.sos_received',
            'incident_id' => $this->incident->id,
            'status' => $this->incident->status->value,
            'category' => $this->incident->category->value,
            'received_at' => $this->incident->received_at->toIso8601String(),
        ];
    }
}
