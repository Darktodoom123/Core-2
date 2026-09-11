<?php

namespace App\Platform\Tracking\Actions;

use App\Platform\Workspace\Events\WorkspaceUpdated;
use Illuminate\Support\Facades\DB;

final class BroadcastTrackingWorkspaceUpdate
{
    public function afterCommit(): void
    {
        DB::afterCommit(static function (): void {
            WorkspaceUpdated::dispatch('tracking', 'updated');
        });
    }
}
