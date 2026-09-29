<?php

namespace App\Platform\Reporting\Policies;

use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Enums\RoleName;
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
        if (self::isAdministrator($user)) {
            return false;
        }

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

        return self::canReviewReports($user);
    }

    /** Operations reviews field work; administrators only see it for oversight. */
    public static function canReviewReports(User $user): bool
    {
        return $user->can(PermissionName::ReportsViewAll->value)
            && ! self::isAdministrator($user);
    }

    /** Administrators hold every permission but do not file, edit, or review field reports. */
    public static function isAdministrator(User $user): bool
    {
        return $user->hasRole(RoleName::SystemAdministrator->value);
    }

    public function resubmit(User $user, JobReport $report): bool
    {
        if (self::isAdministrator($user)) {
            return false;
        }

        if ($user->id === $report->author_id) {
            return $user->can(PermissionName::ReportsViewOwn->value)
                || $user->can(PermissionName::DispatchUpdateOwnStatus->value)
                || $user->can(PermissionName::ReportsViewAll->value);
        }

        return $user->can(PermissionName::ReportsViewAll->value);
    }

    public function update(User $user, JobReport $report): bool
    {
        return $this->resubmit($user, $report);
    }
}
