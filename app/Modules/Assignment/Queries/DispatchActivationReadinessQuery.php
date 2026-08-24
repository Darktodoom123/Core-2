<?php

namespace App\Modules\Assignment\Queries;

use App\Modules\Assignment\Services\DispatchResourceEligibility;
use App\Modules\Dispatch\Enums\ApprovalStatus;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Support\Facades\Gate;

final class DispatchActivationReadinessQuery
{
    public function __construct(
        private readonly DispatchResourceEligibility $eligibility,
        private readonly AssetCandidateQuery $assets,
    ) {}

    /** @return array<string, mixed> */
    public function make(DispatchJob $job): array
    {
        $blockers = [];
        $personnelAssignments = $job->personnelAssignments->whereNull('active_until');
        $assetAssignments = $job->assetAssignments->whereNull('active_until');
        $latestApproval = $job->approvals
            ->whereIn('kind', ['dispatch_activation', 'assignment_override', 'reassignment_override'])
            ->sortByDesc('id')
            ->first();

        if (! in_array($job->status, [DispatchStatus::Draft, DispatchStatus::PendingApproval, DispatchStatus::Scheduled], true)) {
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

            $assessment = $this->eligibility->personnel($personnel, $assignment->assignment_type, $job, true);
            if (! $assessment['eligible']) {
                $blockers[] = "{$personnel->name} is no longer eligible: ".implode(' ', $assessment['reasons']);
            }
        }

        if ($assetAssignments->isEmpty()) {
            $blockers[] = 'Assign at least one active asset.';
        } else {
            $assetIds = array_values($assetAssignments->pluck('operational_asset_id')->map(static fn (mixed $id): int => (int) $id)->all());
            $facts = $this->assets->evidence($assetIds, $job, true);
            $assetModels = $assetAssignments->mapWithKeys(fn ($assignment): array => [(int) $assignment->operational_asset_id => $assignment->asset])->filter();
            foreach ($assetAssignments as $assignment) {
                $asset = $assetModels->get((int) $assignment->operational_asset_id);
                if (! $asset instanceof OperationalAsset || $asset->trashed()) {
                    $blockers[] = "Asset #{$assignment->operational_asset_id} is not safe for dispatch.";

                    continue;
                }

                $candidate = $this->assets->assess($asset, $job, $facts);
                if (! $candidate['eligible']) {
                    $blockers[] = "{$asset->code} is not currently safe for dispatch: ".implode(' ', $candidate['reasons']);
                }
            }
        }

        if ($job->priority->requiresApproval() && $latestApproval?->status !== ApprovalStatus::Approved) {
            $blockers[] = $latestApproval?->status === ApprovalStatus::Rejected
                ? 'The latest approval request was rejected. Revise it and request a new review.'
                : 'Independent Operations Manager approval is still required.';
        }

        $user = request()->user();
        $canDecideApproval = $latestApproval !== null && $user !== null && Gate::forUser($user)->allows('decide', $latestApproval);
        $nonApprovalBlockers = array_filter($blockers, static fn (string $blocker): bool => ! str_contains($blocker, 'Operations Manager approval') && ! str_contains($blocker, 'rejected'));

        $requestedChanges = $latestApproval?->requested_changes;

        return [
            'ready' => $blockers === [],
            'blockers' => $blockers,
            'approval_required' => $job->priority->requiresApproval(),
            'approval_status' => $latestApproval?->status->value,
            'approval_request_id' => $latestApproval?->id,
            'approval_kind' => $latestApproval?->kind,
            'approval_reason' => $latestApproval?->reason,
            'approval_notes' => is_array($requestedChanges) && is_string($requestedChanges['notes'] ?? null) ? $requestedChanges['notes'] : null,
            'can_decide_approval' => $canDecideApproval,
            'can_approve_and_activate' => $canDecideApproval && $nonApprovalBlockers === [] && Gate::forUser($user)->allows('activate', $job),
        ];
    }
}
