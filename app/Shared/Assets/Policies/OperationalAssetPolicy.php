<?php

namespace App\Shared\Assets\Policies;

use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Models\OperationalAsset;

final class OperationalAssetPolicy
{
    public function viewAny(User $user): bool
    {
        return collect([PermissionName::FleetViewAll, PermissionName::FleetViewAssigned, PermissionName::EquipmentViewAll, PermissionName::EquipmentViewAssigned])->contains(fn (PermissionName $permission): bool => $user->can($permission->value));
    }

    public function view(User $user, OperationalAsset $asset): bool
    {
        return $user->can(PermissionName::FleetViewAll->value) || $user->can(PermissionName::EquipmentViewAll->value)
            || $asset->assignments()->whereNull('active_until')->whereHas('job.personnelAssignments', fn ($query) => $query->where('user_id', $user->id)->whereNull('active_until'))->exists();
    }
}
