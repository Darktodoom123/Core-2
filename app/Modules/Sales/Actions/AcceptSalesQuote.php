<?php

namespace App\Modules\Sales\Actions;

use App\Modules\Sales\Enums\SalesOrderStatus;
use App\Modules\Sales\Enums\SalesQuoteStatus;
use App\Modules\Sales\Models\SalesCatalogItem;
use App\Modules\Sales\Models\SalesOrder;
use App\Modules\Sales\Models\SalesQuote;
use App\Modules\Sales\Models\SalesQuoteItem;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Data\AssetUsageRequest;
use App\Shared\Assets\Enums\AssetUsageType;
use App\Shared\Assets\Services\OperationalAssetAvailability;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class AcceptSalesQuote
{
    public function __construct(
        private readonly RecordAuditEvent $audit,
        private readonly OperationalAssetAvailability $availability,
    ) {}

    public function handle(SalesQuote $quote, User $actor): SalesOrder
    {
        return DB::transaction(function () use ($quote, $actor): SalesOrder {
            $locked = SalesQuote::query()->lockForUpdate()->findOrFail($quote->id);
            $quoteItems = SalesQuoteItem::query()
                ->where('sales_quote_id', $locked->id)
                ->orderBy('id')
                ->lockForUpdate()
                ->get();
            $locked->setRelation('items', $quoteItems);
            if ($locked->status !== SalesQuoteStatus::Draft) {
                throw ValidationException::withMessages(['status' => 'Only draft quotes can be accepted.']);
            }
            $orderReference = 'SO-'.$locked->reference;
            if (SalesOrder::query()->where('reference', $orderReference)->exists()) {
                throw ValidationException::withMessages(['reference' => 'An order has already been created for this quote.']);
            }
            $catalogIds = $quoteItems->pluck('sales_catalog_item_id')->map(static fn (mixed $id): int => (int) $id)->unique()->sort()->values()->all();
            $catalogs = SalesCatalogItem::query()->whereIn('id', $catalogIds)->orderBy('id')->lockForUpdate()->get()->keyBy('id');
            $assetIds = $catalogs->pluck('operational_asset_id')->filter()->map(static fn (mixed $id): int => (int) $id)->all();
            $assets = $this->availability->lockAssetsForUpdate($assetIds);

            foreach ($quoteItems as $quoteItem) {
                $catalog = $catalogs->get($quoteItem->sales_catalog_item_id);
                if (! $catalog instanceof SalesCatalogItem) {
                    throw ValidationException::withMessages(['items' => 'One or more quoted inventory items no longer exist.']);
                }
                $assetId = $catalog->operational_asset_id;
                if ($assetId !== null) {
                    if (! $assets->has($assetId)) {
                        throw ValidationException::withMessages(['items' => "Saleable inventory {$catalog->sku} is no longer available."]);
                    }
                    $this->availability->assertNoConflict(new AssetUsageRequest(
                        assetId: (int) $assetId,
                        usageType: AssetUsageType::SalesAccept,
                    ), 'items');
                }
                $available = $catalog->quantity_on_hand - $catalog->quantity_reserved;
                if ($catalog->status !== 'active' || $available < $quoteItem->quantity) {
                    throw ValidationException::withMessages(['items' => "Saleable inventory {$catalog->sku} is no longer available."]);
                }
            }

            $before = $locked->toArray();
            $order = SalesOrder::query()->create([
                'reference' => $orderReference,
                'client_id' => $locked->client_id,
                'sales_quote_id' => $locked->id,
                'created_by' => $actor->id,
                'status' => SalesOrderStatus::Confirmed,
                'currency' => $locked->currency,
                'total_cents' => $locked->total_cents,
            ]);
            foreach ($quoteItems as $quoteItem) {
                $catalog = $catalogs->get($quoteItem->sales_catalog_item_id);
                $orderItem = $order->items()->create([
                    'sales_catalog_item_id' => $catalog->id,
                    'quantity' => $quoteItem->quantity,
                    'unit_price_cents' => $quoteItem->unit_price_cents,
                    'line_total_cents' => $quoteItem->line_total_cents,
                ]);
                $catalog->increment('quantity_reserved', $quoteItem->quantity);
                DB::table('sales_inventory_ledger')->insert([
                    'sales_catalog_item_id' => $catalog->id,
                    'sales_order_id' => $order->id,
                    'created_by' => $actor->id,
                    'entry_type' => 'reserve',
                    'quantity_delta' => $quoteItem->quantity,
                    'metadata' => json_encode(['sales_order_item_id' => $orderItem->id], JSON_THROW_ON_ERROR),
                    'created_at' => now(), 'updated_at' => now(),
                ]);
            }
            $locked->update(['status' => SalesQuoteStatus::Accepted]);
            $this->audit->handle($actor, $locked, 'sales_quote.accepted', $before, $locked->fresh()->toArray());
            $this->audit->handle($actor, $order, 'sales_order.created', null, $order->toArray());

            return $order->fresh(['items.catalogItem', 'client']);
        });
    }
}
