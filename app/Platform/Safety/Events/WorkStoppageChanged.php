<?php

namespace App\Platform\Safety\Events;

use App\Platform\Safety\Models\WorkStoppageNotice;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

final class WorkStoppageChanged implements ShouldBroadcastNow, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly WorkStoppageNotice $notice,
        public readonly string $action,
    ) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('operations.safety')];
    }

    public function broadcastAs(): string
    {
        return 'WorkStoppageChanged';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return [
            'notice_id' => $this->notice->id,
            'notice_number' => $this->notice->notice_number,
            'project_site' => $this->notice->project_site,
            'is_active' => $this->notice->is_active,
            'action' => $this->action,
            'timestamp' => now()->toIso8601String(),
        ];
    }
}
