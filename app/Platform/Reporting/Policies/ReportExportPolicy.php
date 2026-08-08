<?php

namespace App\Platform\Reporting\Policies;

use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Enums\ReportExportStatus;
use App\Platform\Reporting\Models\ReportExport;

class ReportExportPolicy
{
    public function viewAny(User $user): bool
    {
        return $this->canAccessExports($user) && ($user->can(PermissionName::ReportsExport->value)
            || $user->can(PermissionName::ReportsViewAll->value)
            || $user->can(PermissionName::ReportsViewDispatch->value));
    }

    public function view(User $user, ReportExport $export): bool
    {
        if (! $this->canAccessExports($user)) {
            return false;
        }

        if ($user->can(PermissionName::ReportsExport->value) || $user->can(PermissionName::ReportsViewAll->value)) {
            return true;
        }

        return $user->id === $export->user_id;
    }

    public function create(User $user): bool
    {
        return $this->canAccessExports($user) && $this->canCreateExports($user);
    }

    public function download(User $user, ReportExport $export): bool
    {
        return $this->canAccessExports($user)
            && $export->isDownloadable()
            && $user->id === $export->user_id
            && $this->canCreateExports($user);
    }

    public function retry(User $user, ReportExport $export): bool
    {
        return $this->canAccessExports($user)
            && $user->id === $export->user_id
            && $export->status === ReportExportStatus::Failed
            && $this->canCreateExports($user);
    }

    private function canAccessExports(User $user): bool
    {
        return $user->is_active && $user->suspended_at === null;
    }

    private function canCreateExports(User $user): bool
    {
        return $user->can(PermissionName::ReportsExport->value)
            || $user->can(PermissionName::ReportsViewAll->value);
    }
}
