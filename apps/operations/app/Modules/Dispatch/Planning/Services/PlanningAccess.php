<?php

namespace App\Modules\Dispatch\Planning\Services;

use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;

final class PlanningAccess
{
    public static function view(User $user): bool
    {
        return $user->can(PermissionName::DispatchViewAll->value) && $user->can(PermissionName::AssignmentsViewAll->value);
    }

    public static function edit(User $user): bool
    {
        return self::view($user) && $user->can(PermissionName::DispatchCreate->value) && $user->can(PermissionName::AssignmentsCreate->value);
    }

    public static function approve(User $user): bool
    {
        return self::view($user) && $user->can(PermissionName::AssignmentsApprove->value);
    }
}
