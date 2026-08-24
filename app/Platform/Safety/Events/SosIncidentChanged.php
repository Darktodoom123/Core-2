<?php

namespace App\Platform\Safety\Events;

use App\Platform\Safety\Models\SosIncident;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

final class SosIncidentChanged implements ShouldBroadcastNow, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public readonly SosIncident $incident, public readonly string $action) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('operations.sos')];
    }

    public function broadcastAs(): string
    {
        return 'SosIncidentChanged';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return [
            'incident_id' => $this->incident->id,
            'status' => $this->incident->status->value,
            'action' => $this->action,
            'timestamp' => now()->toIso8601String(),
        ];
    }
}
