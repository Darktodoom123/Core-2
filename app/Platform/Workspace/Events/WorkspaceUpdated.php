<?php

namespace App\Platform\Workspace\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class WorkspaceUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public string $resourceType = 'workspace',
        public string $action = 'updated',
        public ?string $timestamp = null
    ) {
        $this->timestamp ??= now()->toIso8601String();
    }

    /**
     * @return array<int, Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('operations.workspace'),
        ];
    }

    public function broadcastAs(): string
    {
        return 'WorkspaceUpdated';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'resource_type' => $this->resourceType,
            'action' => $this->action,
            'timestamp' => $this->timestamp,
        ];
    }
}
