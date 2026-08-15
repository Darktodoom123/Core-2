<?php

namespace App\Modules\Dispatch\ViewModels;

use App\Modules\Assignment\Services\DispatchResourceEligibility;
use App\Modules\Dispatch\Enums\ApprovalStatus;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Support\Facades\Gate;

final class DispatchActivationWorkspaceViewModel
{
    /** @return array<string, mixed> */
    public static function make(
        DispatchJob $job,
        DispatchResourceEligibility $eligibility,
    ): array {
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

        foreach ($personnelAssignments as $assignment) {
            $personnel = $assignment->user;

            if (! $personnel instanceof User) {
                $blockers[] = 'One or more assigned field workers no longer exist.';

                continue;
            }

            $assessment = $eligibility->personnel(
                $personnel,
                $assignment->assignment_type,
                $job,
                true,
            );

            if (! $assessment['eligible']) {
                $blockers[] = "{$personnel->name} is no longer eligible: ".implode(' ', $assessment['reasons']);
            }
        }

        if ($assetAssignments->isEmpty()) {
            $blockers[] = 'Assign at least one active asset.';
        }

        foreach ($assetAssignments as $assignment) {
            $asset = $assignment->getRelationValue('asset');

            if (! $asset instanceof OperationalAsset) {
                $blockers[] = "Asset #{$assignment->operational_asset_id} is not safe for dispatch.";

                continue;
            }

            $assessment = $eligibility->asset($asset, $assignment->assignment_type, $job, [], true);
            if (! $assessment['eligible']) {
                $blockers[] = "{$asset->code} is not currently safe for dispatch: ".implode(' ', $assessment['reasons']);
            }
        }

        if ($job->priority->requiresApproval() && $latestApproval?->status !== ApprovalStatus::Approved) {
            $blockers[] = $latestApproval?->status === ApprovalStatus::Rejected
                ? 'The latest exceptional request was rejected. Revise it and request a new review.'
                : 'Independent Operations Manager approval is still required.';
        }

        $user = request()->user();
        $canDecideApproval = $latestApproval !== null
            && $user !== null
            && Gate::forUser($user)->allows('decide', $latestApproval);

        $requestedChanges = $latestApproval?->requested_changes;
        $approvalNotes = is_array($requestedChanges) && isset($requestedChanges['notes']) && is_string($requestedChanges['notes'])
            ? $requestedChanges['notes']
            : null;

        return [
            'ready' => $blockers === [],
            'blockers' => $blockers,
            'approval_required' => $job->priority->requiresApproval(),
            'approval_status' => $latestApproval?->status->value,
            'approval_request_id' => $latestApproval?->id,
            'approval_kind' => $latestApproval?->kind,
            'approval_reason' => $latestApproval?->reason,
            'approval_notes' => $approvalNotes,
            'can_decide_approval' => $canDecideApproval,
        ];
    }
}
