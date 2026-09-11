<?php

namespace App\Platform\Gpt\Services;

use App\Modules\Assignment\Enums\AssignmentResponse;
use App\Modules\Assignment\Services\DispatchResourceEligibility;
use App\Modules\Dispatch\Enums\DispatchReadinessBlockerCode;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Queries\DispatchReadinessEvaluator;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Models\OperationalAsset;

final class DispatchAdvisoryNeed
{
    public function __construct(private DispatchResourceEligibility $eligibility, private DispatchReadinessEvaluator $readiness) {}

    public function exists(DispatchJob $job): bool
    {
        if ($job->trashed() || in_array($job->status, [DispatchStatus::Completed, DispatchStatus::Cancelled], true)
            || trim((string) $job->title) === '' || trim((string) $job->site) === ''
            || $job->scheduled_start === null || $job->scheduled_end === null
            || $job->scheduled_end->lte($job->scheduled_start)) {
            return false;
        }

        $attempt = $job->currentAttempt;
        if ($attempt !== null) {
            foreach ($this->readiness->evaluate($attempt)->blockers as $blocker) {
                if (in_array($blocker->code, [
                    DispatchReadinessBlockerCode::MissingMandatoryAssignment,
                    DispatchReadinessBlockerCode::AssetUnavailable,
                    DispatchReadinessBlockerCode::AssetUnsafe,
                    DispatchReadinessBlockerCode::PersonnelRoleIneligible,
                    DispatchReadinessBlockerCode::PersonnelAccountInactive,
                    DispatchReadinessBlockerCode::PersonnelSuspended,
                    DispatchReadinessBlockerCode::PersonnelUnavailable,
                    DispatchReadinessBlockerCode::PersonnelCredentialMissing,
                    DispatchReadinessBlockerCode::PersonnelCredentialInvalid,
                    DispatchReadinessBlockerCode::PersonnelConflict,
                    DispatchReadinessBlockerCode::AssetConflict,
                ], true)) {
                    return true;
                }
            }
        }

        $personnel = $job->personnelAssignments()->open()->with(['user.roles', 'user.personnelProfile', 'user.personnelCredentials', 'user.dispatchAssignments.job'])->get();
        $assets = $job->assetAssignments()->open()->with(['asset.maintenanceWorkOrders', 'asset.inspections'])->get();
        if (in_array($job->status, [DispatchStatus::Draft, DispatchStatus::PendingApproval, DispatchStatus::Scheduled], true)
            && ($personnel->isEmpty() || $assets->isEmpty())) {
            return true;
        }

        foreach ($personnel as $assignment) {
            if ($assignment->response_status === AssignmentResponse::Rejected
                || ! $assignment->user instanceof User
                || ! $this->eligibility->personnel($assignment->user, $assignment->assignment_type, $job, true)['eligible']) {
                return true;
            }
        }

        foreach ($assets as $assignment) {
            $asset = $assignment->getRelationValue('asset');
            if (! $asset instanceof OperationalAsset
                || ! $this->eligibility->asset($asset, $assignment->assignment_type, $job, excludeCurrentJob: true)['eligible']) {
                return true;
            }
        }

        return false;
    }
}
