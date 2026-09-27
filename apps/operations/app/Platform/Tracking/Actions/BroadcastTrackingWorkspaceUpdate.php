<?php

namespace App\Platform\Tracking\Actions;

use App\Platform\Workspace\Events\WorkspaceUpdated;
use Illuminate\Support\Facades\DB;
use Throwable;

final class BroadcastTrackingWorkspaceUpdate
{
    /**
     * Nudges open dispatch screens to refresh. The ping is already stored, so
     * a broadcast outage is logged instead of failing it; otherwise the phone
     * would keep resending a ping the server already has.
     */
    public function afterCommit(): void
    {
        DB::afterCommit(static function (): void {
            try {
                WorkspaceUpdated::dispatch('tracking', 'updated');
            } catch (Throwable $exception) {
                report($exception);
            }
        });
    }
}
