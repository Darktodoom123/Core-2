<?php

namespace App\Modules\Dispatch\ViewModels;

use App\Modules\Dispatch\Enums\ApprovalStatus;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;

final class DispatchActivationWorkspaceViewModel
{
    /** @return array<string, mixed> */
    public static function make(DispatchJob $job): array
    {
        $blockers = [];
        $personnelAssignments = $job->personnelAssignments
            ->whereNull('active_until');
        $assetAssignments = $job->assetAssignments
            ->whereNull('active_until');
        $latestApproval = $job->approvals
            ->whereIn('kind', ['dispatch_activation', 'assignment_override', 'reassignment_override'])
            ->sortByDesc('id')
            ->first();

        if (! in_array($job->status, [
            DispatchStatus::Draft,
            DispatchStatus::PendingApproval,
            DispatchStatus::Scheduled,
        ], true)) {
            $blockers[] = 'This dispatch is no longer in an activatable state.';
        }

        if ($personnelAssignments->isEmpty()) {
            $blockers[] = 'Assign at least one active field worker.';
        }

        if ($assetAssignments->isEmpty()) {
            $blockers[] = 'Assign at least one active asset.';
        }

        foreach ($assetAssignments as $assignment) {
            $asset = $assignment->asset;

            if (! $asset->status->dispatchable()
                || $asset->maintenanceWorkOrders->contains(
                    static fn ($work): bool => $work->dispatch_blocking && $work->released_at === null,
                )) {
                $blockers[] = "{$asset->code} is not currently safe for dispatch.";
            }
        }

        if ($job->priority->requiresApproval() && $latestApproval?->status !== ApprovalStatus::Approved) {
            $blockers[] = $latestApproval?->status === ApprovalStatus::Rejected
                ? 'The latest exceptional request was rejected. Revise it and request a new review.'
                : 'Independent Operations Manager approval is still required.';
        }

        return [
            'ready' => $blockers === [],
            'blockers' => $blockers,
            'approval_required' => $job->priority->requiresApproval(),
            'approval_status' => $latestApproval?->status->value,
        ];
    }
}
