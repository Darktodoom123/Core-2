<?php

namespace App\Modules\Sales\Actions;

use App\Modules\Sales\Data\SalesOrderReference;
use App\Modules\Sales\Enums\SalesOrderStatus;
use App\Modules\Sales\Enums\SalesQuoteStatus;
use App\Modules\Sales\Models\SalesCatalogItem;
use App\Modules\Sales\Models\SalesOrder;
use App\Modules\Sales\Models\SalesQuote;
use App\Modules\Sales\Models\SalesQuoteItem;
use App\Modules\Sales\Support\SalesAuditSnapshot;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Data\AssetUsageRequest;
use App\Shared\Assets\Enums\AssetUsageType;
use App\Shared\Assets\Services\OperationalAssetAvailability;
use App\Shared\Support\PersistedInteger;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
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
            $validUntil = $locked->getRawOriginal('valid_until');
            if ($validUntil !== null && CarbonImmutable::parse((string) $validUntil)->lt(today())) {
                throw ValidationException::withMessages(['valid_until' => 'This quote has expired.']);
            }

            $orderReference = SalesOrderReference::fromQuoteReference((string) $locked->reference)->value;
            if (SalesOrder::query()->where('reference', $orderReference)->exists()) {
                throw ValidationException::withMessages(['reference' => 'An order has already been created for this quote.']);
            }
            if ($quoteItems->isEmpty() || $quoteItems->count() > 100) {
                throw ValidationException::withMessages(['items' => 'A quote must contain between one and 100 items.']);
            }

            $catalogIds = [];
            foreach ($quoteItems as $quoteItem) {
                $catalogId = (int) $quoteItem->sales_catalog_item_id;
                if ($catalogId < 1 || isset($catalogIds[$catalogId])) {
                    throw ValidationException::withMessages(['items' => 'Each catalog item may appear only once on a quote.']);
                }
                $catalogIds[$catalogId] = true;
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
            foreach ($quoteItems as $quoteItem) {
                $catalog = $catalogs->get((int) $quoteItem->sales_catalog_item_id);
                if (! $catalog instanceof SalesCatalogItem || $catalog->status !== 'active') {
                    throw ValidationException::withMessages(['items' => 'One or more quoted catalog items are no longer active.']);
                }

                $quantity = PersistedInteger::checkedAdd((int) $quoteItem->quantity, 0, 'items');
                $unitPrice = PersistedInteger::checkedAdd((int) $quoteItem->unit_price_cents, 0, 'items');
                if ($quantity < 1) {
                    throw ValidationException::withMessages(['items' => 'A quoted quantity or price is outside the supported range.']);
                }
                if ($catalog->operational_asset_id !== null && $quantity !== 1) {
                    throw ValidationException::withMessages(['items' => "Saleable unit {$catalog->sku} can only be accepted once."]);
                }

                $lineTotal = PersistedInteger::checkedMultiply($quantity, $unitPrice, 'items');
                $total = PersistedInteger::checkedAdd($total, $lineTotal, 'items');

                $assetId = $catalog->operational_asset_id;
                if ($assetId !== null) {
                    $assetId = (int) $assetId;
                    if (! $assets->has($assetId)) {
                        throw ValidationException::withMessages(['items' => "Saleable inventory {$catalog->sku} is no longer available."]);
                    }
                    $this->availability->assertNoConflict(new AssetUsageRequest(
                        assetId: $assetId,
                        usageType: AssetUsageType::SalesAccept,
                    ), 'items');
                }

                $onHand = PersistedInteger::checkedAdd((int) $catalog->quantity_on_hand, 0, 'items');
                $reserved = PersistedInteger::checkedAdd((int) $catalog->quantity_reserved, 0, 'items');
                if ($reserved > $onHand) {
                    throw ValidationException::withMessages(['items' => "Inventory counters for {$catalog->sku} are invalid."]);
                }
                if ($onHand - $reserved < $quantity) {
                    throw ValidationException::withMessages(['items' => "Saleable inventory {$catalog->sku} is no longer available."]);
                }

                $lines[] = [
                    'quote_item' => $quoteItem,
                    'catalog' => $catalog,
                    'quantity' => $quantity,
                    'unit_price' => $unitPrice,
                    'line_total' => $lineTotal,
                    'next_reserved' => PersistedInteger::checkedAdd($reserved, $quantity, 'items'),
                ];
            }

            if ((int) $locked->total_cents !== $total) {
                throw ValidationException::withMessages(['total_cents' => 'The quote total is inconsistent with its server-calculated lines.']);
            }

            Gate::forUser($actor)->authorize(PermissionName::SalesApproveOrder->value);

            $before = SalesAuditSnapshot::fromQuote($locked);
            $order = SalesOrder::query()->create([
                'reference' => $orderReference,
                'client_id' => $locked->client_id,
                'sales_quote_id' => $locked->id,
                'created_by' => $actor->id,
                'status' => SalesOrderStatus::Confirmed,
                'currency' => $locked->currency,
                'total_cents' => $total,
            ]);

            foreach ($lines as $line) {
                /** @var SalesQuoteItem $quoteItem */
                $quoteItem = $line['quote_item'];
                /** @var SalesCatalogItem $catalog */
                $catalog = $line['catalog'];
                $orderItem = $order->items()->create([
                    'sales_catalog_item_id' => $catalog->id,
                    'quantity' => $line['quantity'],
                    'unit_price_cents' => $line['unit_price'],
                    'line_total_cents' => $line['line_total'],
                ]);
                $catalog->update(['quantity_reserved' => $line['next_reserved']]);
                DB::table('sales_inventory_ledger')->insert([
                    'sales_catalog_item_id' => $catalog->id,
                    'sales_order_id' => $order->id,
                    'created_by' => $actor->id,
                    'entry_type' => 'reserve',
                    'quantity_delta' => $line['quantity'],
                    'metadata' => json_encode(['sales_order_item_id' => $orderItem->id], JSON_THROW_ON_ERROR),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            $locked->update(['status' => SalesQuoteStatus::Accepted]);
            $this->audit->handle($actor, $locked, 'sales_quote.accepted', $before, SalesAuditSnapshot::fromQuote($locked->fresh()));
            $this->audit->handle($actor, $order, 'sales_order.created', null, SalesAuditSnapshot::fromOrder($order));

            return $order->fresh(['items.catalogItem', 'client']);
        });
    }
}
