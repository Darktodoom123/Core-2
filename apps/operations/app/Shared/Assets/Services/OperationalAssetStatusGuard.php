<?php

namespace App\Shared\Assets\Services;

use App\Shared\Assets\Data\AssetUsageRequest;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;

final class OperationalAssetStatusGuard
{
    public function __construct(private readonly OperationalAssetAvailability $availability) {}

    public function transition(OperationalAsset $asset, AssetStatus $target, AssetUsageRequest $request): void
    {
        $this->availability->assertNoConflict($this->forTarget($asset, $target, $request), 'status');

        if ($asset->status !== $target) {
            $asset->update(['status' => $target]);
        }
    }

    public function tryTransition(OperationalAsset $asset, AssetStatus $target, AssetUsageRequest $request): bool
    {
        $assessment = $this->availability->assess($this->forTarget($asset, $target, $request));
        if (! $assessment->allowed()) {
            return false;
        }

        if ($asset->status !== $target) {
            $asset->update(['status' => $target]);
        }

        return true;
    }

    private function forTarget(OperationalAsset $asset, AssetStatus $target, AssetUsageRequest $request): AssetUsageRequest
    {
        return new AssetUsageRequest(
            assetId: (int) $asset->id,
            usageType: $request->usageType,
            windowStart: $request->windowStart,
            windowEnd: $request->windowEnd,
            targetStatus: $target,
            source: $request->source,
            excludedAssignmentIds: $request->excludedAssignmentIds,
        );
    }
}
