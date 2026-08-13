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
use App\Shared\Assets\Models\OperationalAsset;
use App\Shared\Assets\Services\OperationalAssetAvailability;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class TransferSalesOwnership
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
            if ($locked->status !== SalesOrderStatus::Fulfilled) {
                throw ValidationException::withMessages(['status' => 'Only fulfilled orders can transfer ownership.']);
            }
            $catalogIds = $items->pluck('sales_catalog_item_id')->map(static fn (mixed $id): int => (int) $id)->unique()->sort()->values()->all();
            $catalogs = SalesCatalogItem::query()->whereIn('id', $catalogIds)->orderBy('id')->lockForUpdate()->get()->keyBy('id');
            $assetIds = $catalogs->pluck('operational_asset_id')->filter()->map(static fn (mixed $id): int => (int) $id)->all();
            $assets = $this->availability->lockAssetsForUpdate($assetIds);
            $before = $locked->toArray();
            foreach ($items as $item) {
                $alreadyTransferred = DB::table('ownership_transfers')->where('sales_order_item_id', $item->id)->exists();
                if ($alreadyTransferred) {
                    throw ValidationException::withMessages(['status' => 'Ownership has already been transferred for this order.']);
                }
                $catalog = $catalogs->get($item->sales_catalog_item_id);
                if (! $catalog instanceof SalesCatalogItem) {
                    throw ValidationException::withMessages(['status' => 'One or more order items no longer exist.']);
                }
                $asset = $catalog->operational_asset_id === null ? null : $assets->get($catalog->operational_asset_id);
                if ($asset !== null && DB::table('ownership_transfers')->where('operational_asset_id', $asset->id)->exists()) {
                    throw ValidationException::withMessages(['status' => "Equipment {$asset->code} already has an ownership transfer."]);
                }
                if ($asset !== null) {
                    $this->availability->assertNoConflict(new AssetUsageRequest(
                        assetId: (int) $asset->id,
                        usageType: AssetUsageType::SalesTransfer,
                        source: new AssetUsageSource('sales_order', (int) $locked->id),
                    ), 'status');
                }
                DB::table('ownership_transfers')->insert([
                    'sales_order_id' => $locked->id,
                    'sales_order_item_id' => $item->id,
                    'sales_catalog_item_id' => $catalog->id,
                    'operational_asset_id' => $asset?->id,
                    'transferred_by' => $actor->id,
                    'transferred_at' => now(),
                    'created_at' => now(), 'updated_at' => now(),
                ]);
                if ($asset instanceof OperationalAsset) {
                    $asset->update(['status' => AssetStatus::Unavailable]);
                }
            }
            $locked->update(['status' => SalesOrderStatus::Transferred]);
            $this->audit->handle($actor, $locked, 'sales_order.ownership_transferred', $before, $locked->fresh()->toArray());

            return $locked->fresh(['items.catalogItem', 'client']);
        });
    }
}
