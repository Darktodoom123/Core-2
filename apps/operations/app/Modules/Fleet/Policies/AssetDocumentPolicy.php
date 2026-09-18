<?php

namespace App\Modules\Fleet\Policies;

use App\Modules\Fleet\Models\AssetDocument;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;

final class AssetDocumentPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can(PermissionName::FleetViewAll->value)
            || $user->can(PermissionName::FleetViewAssigned->value)
            || $user->can(PermissionName::EquipmentViewAll->value)
            || $user->can(PermissionName::EquipmentViewAssigned->value);
    }

    public function view(User $user, AssetDocument $document): bool
    {
        return $user->can('view', $document->operationalAsset);
    }

    public function create(User $user, AssetDocument $document): bool
    {
        $isFleet = in_array($document->operationalAsset->kind, ['truck', 'vehicle'], true);

        return $user->can($isFleet ? PermissionName::FleetUpdateStatus->value : PermissionName::EquipmentUpdateStatus->value);
    }

    public function update(User $user, AssetDocument $document): bool
    {
        return $this->create($user, $document);
    }

    public function delete(User $user, AssetDocument $document): bool
    {
        return $this->create($user, $document);
    }
}
