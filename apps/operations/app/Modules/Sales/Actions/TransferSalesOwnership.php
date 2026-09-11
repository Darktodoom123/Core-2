<?php

namespace App\Modules\Sales\Actions;

use App\Modules\Sales\Enums\SalesOrderStatus;
use App\Modules\Sales\Models\SalesCatalogItem;
use App\Modules\Sales\Models\SalesOrder;
use App\Modules\Sales\Models\SalesOrderItem;
use App\Modules\Sales\Support\SalesAuditSnapshot;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Data\AssetUsageRequest;
use App\Shared\Assets\Data\AssetUsageSource;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Enums\AssetUsageType;
use App\Shared\Assets\Models\OperationalAsset;
use App\Shared\Assets\Services\OperationalAssetAvailability;
use App\Shared\Assets\Services\OperationalAssetStatusGuard;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class TransferSalesOwnership
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

            if ($locked->status !== SalesOrderStatus::Fulfilled) {
                throw ValidationException::withMessages(['status' => 'Only fulfilled orders can transfer ownership.']);
            }
            if ($items->isEmpty() || $items->count() > 100) {
                throw ValidationException::withMessages(['items' => 'An order must contain between one and 100 items.']);
            }

            $catalogIds = [];
            foreach ($items as $item) {
                $catalogIds[(int) $item->sales_catalog_item_id] = true;
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

            $lines = [];
            $seenAssetIds = [];
            foreach ($items as $item) {
                $catalog = $catalogs->get((int) $item->sales_catalog_item_id);
                if (! $catalog instanceof SalesCatalogItem) {
                    throw ValidationException::withMessages(['status' => 'One or more order items no longer exist.']);
                }

                if (DB::table('ownership_transfers')->where('sales_order_item_id', $item->id)->exists()) {
                    throw ValidationException::withMessages(['status' => 'Ownership has already been transferred for this order.']);
                }

                $asset = null;
                if ($catalog->operational_asset_id !== null) {
                    $assetId = (int) $catalog->operational_asset_id;
                    if (isset($seenAssetIds[$assetId])) {
                        throw ValidationException::withMessages(['status' => 'A physical asset may only be transferred once per order.']);
                    }
                    $seenAssetIds[$assetId] = true;
                    $asset = $assets->get($assetId);
                    if (! $asset instanceof OperationalAsset || $asset->trashed()) {
                        throw ValidationException::withMessages(['status' => 'One or more linked assets are no longer available.']);
                    }
                    if (DB::table('ownership_transfers')->where('operational_asset_id', $assetId)->exists()) {
                        throw ValidationException::withMessages(['status' => "Equipment {$asset->code} already has an ownership transfer."]);
                    }
                    $this->availability->assertNoConflict(new AssetUsageRequest(
                        assetId: $assetId,
                        usageType: AssetUsageType::SalesTransfer,
                        targetStatus: AssetStatus::Unavailable,
                        source: new AssetUsageSource('sales_order', (int) $locked->id),
                    ), 'status');
                }

                $lines[] = ['item' => $item, 'catalog' => $catalog, 'asset' => $asset];
            }

            Gate::forUser($actor)->authorize(PermissionName::SalesTransferOwnership->value);

            $before = SalesAuditSnapshot::fromOrder($locked);
            foreach ($lines as $line) {
                /** @var SalesOrderItem $item */
                $item = $line['item'];
                /** @var SalesCatalogItem $catalog */
                $catalog = $line['catalog'];
                /** @var OperationalAsset|null $asset */
                $asset = $line['asset'];

                try {
                    DB::table('ownership_transfers')->insert([
                        'sales_order_id' => $locked->id,
                        'sales_order_item_id' => $item->id,
                        'sales_catalog_item_id' => $catalog->id,
                        'operational_asset_id' => $asset?->id,
                        'transferred_by' => $actor->id,
                        'transferred_at' => now(),
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                } catch (QueryException $exception) {
                    if (! $this->isUniqueViolation($exception)) {
                        throw $exception;
                    }

                    throw ValidationException::withMessages(['status' => 'Ownership has already been transferred for one or more items.']);
                }

                if ($asset instanceof OperationalAsset) {
                    $this->statusGuard->transition($asset, AssetStatus::Unavailable, new AssetUsageRequest(
                        assetId: (int) $asset->id,
                        usageType: AssetUsageType::SalesTransfer,
                        targetStatus: AssetStatus::Unavailable,
                        source: new AssetUsageSource('sales_order', (int) $locked->id),
                    ));
                }
            }

            $locked->update(['status' => SalesOrderStatus::Transferred]);
            $this->audit->handle($actor, $locked, 'sales_order.ownership_transferred', $before, SalesAuditSnapshot::fromOrder($locked->fresh()));

            return $locked->fresh(['items.catalogItem', 'client']);
        });
    }

    private function isUniqueViolation(QueryException $exception): bool
    {
        return in_array((string) $exception->getCode(), ['19', '23000', '23505'], true)
            || str_contains(strtolower($exception->getMessage()), 'unique');
    }
}
