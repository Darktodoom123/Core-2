<?php

namespace App\Modules\CraneEquipment\Http\Controllers;

use App\Platform\Identity\Enums\PermissionName;
use App\Shared\Assets\Http\Controllers\AssetCatalogController as BaseAssetCatalogController;

final class AssetCatalogController extends BaseAssetCatalogController
{
    /** @return list<string> */
    protected function assetKinds(): array
    {
        return ['crane', 'mobile_crane', 'equipment'];
    }

    protected function viewAllPermission(): PermissionName
    {
        return PermissionName::EquipmentViewAll;
    }

    protected function viewAssignedPermission(): PermissionName
    {
        return PermissionName::EquipmentViewAssigned;
    }
}
