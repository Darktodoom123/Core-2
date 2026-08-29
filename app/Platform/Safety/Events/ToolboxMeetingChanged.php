<?php

namespace App\Platform\Safety\Events;

use App\Platform\Safety\Models\ToolboxMeeting;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

final class ToolboxMeetingChanged implements ShouldBroadcastNow, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly ToolboxMeeting $meeting,
        public readonly string $action,
    ) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('operations.safety')];
    }

    public function broadcastAs(): string
    {
        return 'ToolboxMeetingChanged';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return [
            'meeting_id' => $this->meeting->id,
            'project_site' => $this->meeting->project_site,
            'topic_title' => $this->meeting->topic_title,
            'attendee_count' => $this->meeting->attendee_count,
            'is_so_cosigned' => $this->meeting->safety_officer_signed_at !== null,
            'action' => $this->action,
            'timestamp' => now()->toIso8601String(),
        ];
    }
}
