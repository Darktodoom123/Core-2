<?php

namespace App\Modules\Sales\Actions;

use App\Modules\Sales\Enums\SalesOrderStatus;
use App\Modules\Sales\Models\SalesCatalogItem;
use App\Modules\Sales\Models\SalesOrder;
use App\Modules\Sales\Models\SalesOrderItem;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Data\AssetUsageRequest;
use App\Shared\Assets\Data\AssetUsageSource;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Enums\AssetUsageType;
use App\Shared\Assets\Services\OperationalAssetAvailability;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class FulfillSalesOrder
{
    public function __construct(
        private readonly RecordAuditEvent $audit,
        private readonly OperationalAssetAvailability $availability,
    ) {}

    public function handle(SalesOrder $order, User $actor): SalesOrder
    {
        return DB::transaction(function () use ($order, $actor): SalesOrder {
            $locked = SalesOrder::query()->lockForUpdate()->findOrFail($order->id);
            $items = SalesOrderItem::query()->where('sales_order_id', $locked->id)->orderBy('id')->lockForUpdate()->get();
            $locked->setRelation('items', $items);
            if ($locked->status !== SalesOrderStatus::Confirmed) {
                throw ValidationException::withMessages(['status' => 'Only confirmed orders can be fulfilled.']);
            }
            $catalogIds = $items->pluck('sales_catalog_item_id')->map(static fn (mixed $id): int => (int) $id)->unique()->sort()->values()->all();
            $catalogs = SalesCatalogItem::query()->whereIn('id', $catalogIds)->orderBy('id')->lockForUpdate()->get()->keyBy('id');
            $assetIds = $catalogs->pluck('operational_asset_id')->filter()->map(static fn (mixed $id): int => (int) $id)->all();
            $assets = $this->availability->lockAssetsForUpdate($assetIds);

            foreach ($items as $item) {
                $catalog = $catalogs->get($item->sales_catalog_item_id);
                if (! $catalog instanceof SalesCatalogItem) {
                    throw ValidationException::withMessages(['items' => 'One or more order items no longer exist.']);
                }
                if ($catalog->operational_asset_id !== null) {
                    $assetId = (int) $catalog->operational_asset_id;
                    if (! $assets->has($assetId)) {
                        throw ValidationException::withMessages(['items' => "Linked asset for {$catalog->sku} is no longer available."]);
                    }
                    $this->availability->assertNoConflict(new AssetUsageRequest(
                        assetId: $assetId,
                        usageType: AssetUsageType::SalesFulfill,
                        source: new AssetUsageSource('sales_order', (int) $locked->id),
                    ), 'items');
                }
                if ($catalog->quantity_reserved < $item->quantity || $catalog->quantity_on_hand < $item->quantity) {
                    throw ValidationException::withMessages(['items' => "Reserved inventory is no longer available for {$catalog->sku}."]);
                }
                $catalog->decrement('quantity_on_hand', $item->quantity);
                $catalog->decrement('quantity_reserved', $item->quantity);
                DB::table('sales_inventory_ledger')->insert([
                    'sales_catalog_item_id' => $catalog->id,
                    'sales_order_id' => $locked->id,
                    'created_by' => $actor->id,
                    'entry_type' => 'sale',
                    'quantity_delta' => -$item->quantity,
                    'metadata' => json_encode(['sales_order_item_id' => $item->id], JSON_THROW_ON_ERROR),
                    'created_at' => now(), 'updated_at' => now(),
                ]);
            }
            $before = $locked->toArray();
            foreach ($assets as $asset) {
                $asset->update(['status' => AssetStatus::Unavailable]);
            }
            $locked->update(['status' => SalesOrderStatus::Fulfilled, 'fulfilled_at' => now()]);
            $this->audit->handle($actor, $locked, 'sales_order.fulfilled', $before, $locked->fresh()->toArray());

            return $locked->fresh(['items.catalogItem', 'client']);
        });
    }
}
