<?php

namespace App\Modules\Sales\Actions;

use App\Modules\Sales\Enums\SalesOrderStatus;
use App\Modules\Sales\Models\SalesCatalogItem;
use App\Modules\Sales\Models\SalesOrder;
use App\Modules\Sales\Models\SalesOrderItem;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Data\AssetUsageRequest;
use App\Shared\Assets\Data\AssetUsageSource;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Enums\AssetUsageType;
use App\Shared\Assets\Services\OperationalAssetAvailability;
use App\Shared\Assets\Services\OperationalAssetStatusGuard;
use App\Shared\Support\PersistedInteger;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class FulfillSalesOrder
{
    public function __construct(
        private readonly RecordAuditEvent $audit,
        private readonly OperationalAssetAvailability $availability,
        private readonly OperationalAssetStatusGuard $statusGuard,
    ) {}

    public function handle(SalesOrder $order, User $actor): SalesOrder
    {
        return DB::transaction(function () use ($order, $actor): SalesOrder {
            $locked = SalesOrder::query()->lockForUpdate()->findOrFail($order->id);
            $items = SalesOrderItem::query()
                ->where('sales_order_id', $locked->id)
                ->orderBy('id')
                ->lockForUpdate()
                ->get();
            $locked->setRelation('items', $items);

            if ($locked->status !== SalesOrderStatus::Confirmed) {
                throw ValidationException::withMessages(['status' => 'Only confirmed orders can be fulfilled.']);
            }
            if ($items->isEmpty() || $items->count() > 100) {
                throw ValidationException::withMessages(['items' => 'An order must contain between one and 100 items.']);
            }

            $catalogIds = [];
            foreach ($items as $item) {
                $catalogIds[(int) $item->sales_catalog_item_id] = true;
            }
            if (count($catalogIds) !== $items->count()) {
                throw ValidationException::withMessages(['items' => 'Each catalog item may appear only once on an order.']);
            }

            $catalogs = SalesCatalogItem::query()
                ->whereIn('id', array_keys($catalogIds))
                ->orderBy('id')
                ->lockForUpdate()
                ->get()
                ->keyBy('id');
            $assetIds = $catalogs->pluck('operational_asset_id')
                ->filter()
                ->map(static fn (mixed $id): int => (int) $id)
                ->unique()
                ->sort()
                ->values()
                ->all();
            $assets = $this->availability->lockAssetsForUpdate($assetIds);

            $total = 0;
            $lines = [];
            foreach ($items as $item) {
                $catalog = $catalogs->get((int) $item->sales_catalog_item_id);
                if (! $catalog instanceof SalesCatalogItem) {
                    throw ValidationException::withMessages(['items' => 'One or more order items no longer exist.']);
                }

                $quantity = PersistedInteger::checkedAdd((int) $item->quantity, 0, 'items');
                $unitPrice = PersistedInteger::checkedAdd((int) $item->unit_price_cents, 0, 'items');
                if ($quantity < 1) {
                    throw ValidationException::withMessages(['items' => 'An order quantity or price is outside the supported range.']);
                }
                $lineTotal = PersistedInteger::checkedMultiply($quantity, $unitPrice, 'items');
                $total = PersistedInteger::checkedAdd($total, $lineTotal, 'items');

                $onHand = PersistedInteger::checkedAdd((int) $catalog->quantity_on_hand, 0, 'items');
                $reserved = PersistedInteger::checkedAdd((int) $catalog->quantity_reserved, 0, 'items');
                if ($reserved < $quantity || $onHand < $quantity) {
                    throw ValidationException::withMessages(['items' => "Reserved inventory is no longer available for {$catalog->sku}."]);
                }

                $assetId = $catalog->operational_asset_id;
                if ($assetId !== null) {
                    $assetId = (int) $assetId;
                    if (! $assets->has($assetId)) {
                        throw ValidationException::withMessages(['items' => "Linked asset for {$catalog->sku} is no longer available."]);
                    }
                    $this->availability->assertNoConflict(new AssetUsageRequest(
                        assetId: $assetId,
                        usageType: AssetUsageType::SalesFulfill,
                        source: new AssetUsageSource('sales_order', (int) $locked->id),
                    ), 'items');
                }

                $lines[] = [
                    'item' => $item,
                    'catalog' => $catalog,
                    'quantity' => $quantity,
                    'line_total' => $lineTotal,
                    'next_on_hand' => $onHand - $quantity,
                    'next_reserved' => $reserved - $quantity,
                ];
            }

            if ((int) $locked->total_cents !== $total) {
                throw ValidationException::withMessages(['total_cents' => 'The order total is inconsistent with its server-calculated lines.']);
            }

            Gate::forUser($actor)->authorize(PermissionName::SalesFulfill->value);

            $before = $locked->toArray();
            foreach ($lines as $line) {
                /** @var SalesOrderItem $item */
                $item = $line['item'];
                /** @var SalesCatalogItem $catalog */
                $catalog = $line['catalog'];
                $catalog->update([
                    'quantity_on_hand' => $line['next_on_hand'],
                    'quantity_reserved' => $line['next_reserved'],
                ]);
                DB::table('sales_inventory_ledger')->insert([
                    'sales_catalog_item_id' => $catalog->id,
                    'sales_order_id' => $locked->id,
                    'created_by' => $actor->id,
                    'entry_type' => 'sale',
                    'quantity_delta' => -$line['quantity'],
                    'metadata' => json_encode(['sales_order_item_id' => $item->id], JSON_THROW_ON_ERROR),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            foreach ($assets as $asset) {
                $this->statusGuard->transition($asset, AssetStatus::Unavailable, new AssetUsageRequest(
                    assetId: (int) $asset->id,
                    usageType: AssetUsageType::SalesFulfill,
                    targetStatus: AssetStatus::Unavailable,
                    source: new AssetUsageSource('sales_order', (int) $locked->id),
                ));
            }

            $locked->update(['status' => SalesOrderStatus::Fulfilled, 'fulfilled_at' => now()]);
            $this->audit->handle($actor, $locked, 'sales_order.fulfilled', $before, $locked->fresh()->toArray());

            return $locked->fresh(['items.catalogItem', 'client']);
        });
    }
}
