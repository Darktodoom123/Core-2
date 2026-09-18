<?php

namespace App\Platform\Identity\Policies;

use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\PersonnelCredential;
use App\Platform\Identity\Models\User;

final class PersonnelCredentialPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can(PermissionName::UsersManage->value) || $user->can(PermissionName::DispatchViewAll->value);
    }

    public function view(User $user, PersonnelCredential $credential): bool
    {
        if ($user->id === $credential->user_id) {
            return true;
        }

        return $user->can(PermissionName::UsersManage->value)
            || $user->can(PermissionName::DispatchViewAll->value);
    }

    public function create(User $user): bool
    {
        return $user->can(PermissionName::UsersManage->value);
    }

    public function update(User $user, PersonnelCredential $credential): bool
    {
        return $user->can(PermissionName::UsersManage->value);
    }

    public function delete(User $user, PersonnelCredential $credential): bool
    {
        return $user->can(PermissionName::UsersManage->value);
    }
}
