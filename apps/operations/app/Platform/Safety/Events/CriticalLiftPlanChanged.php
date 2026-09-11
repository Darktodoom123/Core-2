<?php

namespace App\Platform\Safety\Events;

use App\Platform\Safety\Models\CriticalLiftPlan;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

final class CriticalLiftPlanChanged implements ShouldBroadcastNow, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly CriticalLiftPlan $liftPlan,
        public readonly string $action,
    ) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('operations.safety')];
    }

    public function broadcastAs(): string
    {
        return 'CriticalLiftPlanChanged';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return [
            'lift_plan_id' => $this->liftPlan->id,
            'lift_reference' => $this->liftPlan->lift_reference,
            'project_site' => $this->liftPlan->project_site,
            'status' => $this->liftPlan->status,
            'action' => $this->action,
            'timestamp' => now()->toIso8601String(),
        ];
    }
}
