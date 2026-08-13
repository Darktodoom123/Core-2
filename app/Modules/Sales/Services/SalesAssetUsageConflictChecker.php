<?php

namespace App\Modules\Sales\Services;

use App\Modules\Sales\Enums\SalesOrderStatus;
use App\Modules\Sales\Models\SalesOrderItem;
use App\Shared\Assets\Contracts\AssetUsageConflictChecker;
use App\Shared\Assets\Data\AssetUsageConflict;
use App\Shared\Assets\Data\AssetUsageRequest;
use App\Shared\Assets\Data\AssetUsageSource;
use App\Shared\Assets\Enums\AssetUsageType;

final class SalesAssetUsageConflictChecker implements AssetUsageConflictChecker
{
    public function conflicts(AssetUsageRequest $request): iterable
    {
        if (($request->usageType === AssetUsageType::RentalReturn && ! $request->targetStatus?->dispatchable())
            || ($request->usageType === AssetUsageType::AssetStatusChange && ! $request->targetStatus?->dispatchable())) {
            return [];
        }

        $query = SalesOrderItem::query()
            ->whereHas('catalogItem', fn ($catalog): mixed => $catalog->where('operational_asset_id', $request->assetId))
            ->whereHas('order', function ($order) use ($request): void {
                $order->whereIn('status', [
                    SalesOrderStatus::Confirmed->value,
                    SalesOrderStatus::Fulfilled->value,
                    SalesOrderStatus::Transferred->value,
                ]);

                if ($request->source?->aggregateType === 'sales_order'
                    && in_array($request->usageType, [AssetUsageType::SalesFulfill, AssetUsageType::SalesTransfer], true)) {
                    $order->where('id', '<>', $request->source->aggregateId);
                }
            });

        $item = $query->with('order')->orderBy('id')->first();
        if ($item === null) {
            return [];
        }

        return [new AssetUsageConflict(
            'sales.order_committed',
            'The asset is committed to another sales order.',
            new AssetUsageSource('sales_order', (int) $item->order->id),
            ['reference' => (string) $item->order->reference, 'status' => $item->order->status->value],
        )];
    }
}
