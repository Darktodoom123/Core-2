<?php

namespace App\Policies;

use App\Enums\DispatchStatus;
use App\Enums\PermissionName;
use App\Models\DispatchJob;
use App\Models\User;

final class DispatchJobPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can(PermissionName::DispatchViewAll->value) || $user->can(PermissionName::DispatchViewAssigned->value);
    }

    public function view(User $user, DispatchJob $job): bool
    {
        return $user->can(PermissionName::DispatchViewAll->value)
            || ($user->can(PermissionName::DispatchViewAssigned->value) && $job->personnelAssignments()->where('user_id', $user->id)->whereNull('active_until')->exists());
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

    public function activate(User $user, DispatchJob $job): bool
    {
        return $user->can(PermissionName::DispatchActivate->value) && ! in_array($job->status, [DispatchStatus::Completed, DispatchStatus::Cancelled], true);
    }

    public function cancel(User $user, DispatchJob $job): bool
    {
        return $user->can(PermissionName::DispatchCancel->value) && ! in_array($job->status, [DispatchStatus::Completed, DispatchStatus::Cancelled], true);
    }

    public function updateOwnStatus(User $user, DispatchJob $job): bool
    {
        return $user->can(PermissionName::DispatchUpdateOwnStatus->value)
            && $job->personnelAssignments()->where('user_id', $user->id)->whereNull('active_until')->exists();
    }
}
