<?php

namespace App\Modules\Dispatch\Policies;

use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;

final class DispatchJobPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can(PermissionName::DispatchViewAll->value) || $user->can(PermissionName::DispatchViewAssigned->value);
    }

    public function view(User $user, DispatchJob $job): bool
    {
        return $user->can(PermissionName::DispatchViewAll->value)
            || $this->viewAssigned($user, $job);
    }

    public function viewAssigned(User $user, DispatchJob $job): bool
    {
        return $user->can(PermissionName::DispatchViewAssigned->value)
            && $job->personnelAssignments()->open()->where('user_id', $user->id)->exists();
    }

    public function create(User $user): bool
    {
        return $user->can(PermissionName::DispatchCreate->value);
    }

    public function update(User $user, DispatchJob $job): bool
    {
        return $user->can(PermissionName::DispatchUpdate->value) && in_array($job->status, [DispatchStatus::Draft, DispatchStatus::Scheduled], true);
    }

    public function assignResources(User $user, DispatchJob $job): bool
    {
        return $user->can(PermissionName::AssignmentsCreate->value)
            && $this->view($user, $job);
    }

    public function reassignResources(User $user, DispatchJob $job): bool
    {
        return $user->can(PermissionName::AssignmentsReassign->value)
            && $this->view($user, $job)
            && ! in_array($job->status, [DispatchStatus::Completed, DispatchStatus::Cancelled], true);
    }

    public function activate(User $user, DispatchJob $job): bool
    {
        return $user->can(PermissionName::DispatchActivate->value)
            && $this->view($user, $job)
            && in_array($job->status, [
                DispatchStatus::Draft,
                DispatchStatus::PendingApproval,
                DispatchStatus::Scheduled,
            ], true);
    }

    public function cancel(User $user, DispatchJob $job): bool
    {
        return $user->can(PermissionName::DispatchCancel->value) || $user->can(PermissionName::DispatchApproveCancel->value);
    }

    public function reopen(User $user, DispatchJob $job): bool
    {
        return $user->can(PermissionName::DispatchApproveCancel->value) || $user->can(PermissionName::ArchiveManage->value);
    }

    public function archive(User $user, DispatchJob $job): bool
    {
        return $user->can(PermissionName::ArchiveManage->value);
    }

    public function restore(User $user, DispatchJob $job): bool
    {
        return $user->can(PermissionName::ArchiveManage->value) && $job->trashed();
    }

    public function updateOwnStatus(User $user, DispatchJob $job): bool
    {
        return $user->can(PermissionName::DispatchUpdateOwnStatus->value)
            && $job->personnelAssignments()->open()->where('user_id', $user->id)->exists();
    }
}
