<?php

namespace App\Platform\Reporting\Policies;

use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Models\ReportExport;

class ReportExportPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can(PermissionName::ReportsExport->value)
            || $user->can(PermissionName::ReportsViewAll->value)
            || $user->can(PermissionName::ReportsViewDispatch->value);
    }

    public function view(User $user, ReportExport $export): bool
    {
        if ($user->can(PermissionName::ReportsExport->value) || $user->can(PermissionName::ReportsViewAll->value)) {
            return true;
        }

        return $user->id === $export->user_id;
    }

    public function create(User $user): bool
    {
        return $user->can(PermissionName::ReportsExport->value)
            || $user->can(PermissionName::ReportsViewAll->value);
    }

    public function download(User $user, ReportExport $export): bool
    {
        if (! $export->isDownloadable()) {
            return false;
        }

        if ($user->can(PermissionName::ReportsExport->value) || $user->can(PermissionName::ReportsViewAll->value)) {
            return true;
        }

        return $user->id === $export->user_id;
    }

    public function retry(User $user, ReportExport $export): bool
    {
        if ($user->can(PermissionName::ReportsExport->value) || $user->can(PermissionName::ReportsViewAll->value)) {
            return true;
        }

        return $user->id === $export->user_id;
    }
}
