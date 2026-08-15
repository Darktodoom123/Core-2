<?php

namespace App\Platform\Reporting\Policies;

use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Models\JobReport;

class JobReportPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can(PermissionName::ReportsViewAll->value)
            || $user->can(PermissionName::ReportsViewDispatch->value)
            || $user->can(PermissionName::ReportsViewOwn->value);
    }

    public function view(User $user, JobReport $report): bool
    {
        if ($user->can(PermissionName::ReportsViewAll->value) || $user->can(PermissionName::ReportsViewDispatch->value)) {
            return true;
        }

        if ($user->id === $report->author_id) {
            return true;
        }

        return $user->can(PermissionName::ReportsViewOwn->value) && $user->id === $report->author_id;
    }

    public function create(User $user, DispatchJob $job): bool
    {
        if ($user->can(PermissionName::ReportsViewAll->value) || $user->can(PermissionName::DispatchViewAll->value)) {
            return true;
        }

        if ($user->can(PermissionName::ReportsViewOwn->value) || $user->can(PermissionName::DispatchUpdateOwnStatus->value)) {
            return $job->personnelAssignments()
                ->where('user_id', $user->id)
                ->exists();
        }

        return false;
    }

    public function review(User $user, JobReport $report): bool
    {
        // Must not be self-review
        if ($user->id === $report->author_id) {
            return false;
        }

        return $user->can(PermissionName::ReportsViewAll->value);
    }
}
