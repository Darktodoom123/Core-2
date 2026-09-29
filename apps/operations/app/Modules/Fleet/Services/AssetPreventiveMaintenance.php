<?php

namespace App\Modules\Fleet\Services;

use App\Shared\Assets\Models\MaintenanceWorkOrder;
use App\Shared\Assets\Models\OperationalAsset;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

/**
 * Reads an asset's next preventive maintenance date from its most recent
 * work order that set one, and checks it against the end of planned work.
 */
final class AssetPreventiveMaintenance
{
    /** The due date when preventive maintenance falls before the work ends. */
    public function dueBefore(OperationalAsset $asset, ?CarbonInterface $workEnds = null): ?CarbonImmutable
    {
        return $this->dueBeforeForAssets([(int) $asset->id], $workEnds)[(int) $asset->id] ?? null;
    }

    /**
     * @param  list<int>  $assetIds
     * @return array<int, CarbonImmutable> due dates keyed by asset ID, only for assets due before the work ends
     */
    public function dueBeforeForAssets(array $assetIds, ?CarbonInterface $workEnds = null): array
    {
        if ($assetIds === []) {
            return [];
        }

        $workEnds = CarbonImmutable::instance($workEnds ?? now());
        $latestIds = MaintenanceWorkOrder::query()
            ->selectRaw('max(id)')
            ->whereIn('operational_asset_id', $assetIds)
            ->whereNotNull('next_due_at')
            ->groupBy('operational_asset_id');

        $due = [];
        foreach (MaintenanceWorkOrder::query()->whereIn('id', $latestIds)->get(['id', 'operational_asset_id', 'next_due_at']) as $order) {
            $dueAt = $order->next_due_at?->toImmutable();
            if ($dueAt !== null && $dueAt->lt($workEnds)) {
                $due[(int) $order->operational_asset_id] = $dueAt;
            }
        }

        return $due;
    }

    public function describe(CarbonInterface $dueAt): string
    {
        return CarbonImmutable::instance($dueAt)->timezone('Asia/Manila')->format('M j, Y g:i A');
    }
}
