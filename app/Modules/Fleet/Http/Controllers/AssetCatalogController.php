<?php

namespace App\Modules\Fleet\Http\Controllers;

use App\Platform\Identity\Enums\PermissionName;
use App\Shared\Assets\Http\Controllers\AssetCatalogController as BaseAssetCatalogController;

final class AssetCatalogController extends BaseAssetCatalogController
{
    /** @return list<string> */
    protected function assetKinds(): array
    {
        return ['truck', 'vehicle'];
    }

    protected function viewAllPermission(): PermissionName
    {
        return PermissionName::FleetViewAll;
    }

    protected function viewAssignedPermission(): PermissionName
    {
        return PermissionName::FleetViewAssigned;
    }
}
