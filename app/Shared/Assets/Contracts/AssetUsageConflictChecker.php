<?php

namespace App\Shared\Assets\Contracts;

use App\Shared\Assets\Data\AssetUsageConflict;
use App\Shared\Assets\Data\AssetUsageRequest;

interface AssetUsageConflictChecker
{
    public const TAG = 'asset-usage-conflict-checkers';

    /** @return iterable<AssetUsageConflict> */
    public function conflicts(AssetUsageRequest $request): iterable;
}
