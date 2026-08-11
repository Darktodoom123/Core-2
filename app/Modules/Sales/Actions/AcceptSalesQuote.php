<?php

namespace App\Modules\Sales\Actions;

use App\Modules\Rental\Enums\RentalReservationStatus;
use App\Modules\Rental\Models\RentalReservationItem;
use App\Modules\Sales\Enums\SalesOrderStatus;
use App\Modules\Sales\Enums\SalesQuoteStatus;
use App\Modules\Sales\Models\SalesCatalogItem;
use App\Modules\Sales\Models\SalesOrder;
use App\Modules\Sales\Models\SalesQuote;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class AcceptSalesQuote
{
    public function __construct(private readonly RecordAuditEvent $audit) {}

    public function handle(SalesQuote $quote, User $actor): SalesOrder
    {
        return DB::transaction(function () use ($quote, $actor): SalesOrder {
            $locked = SalesQuote::query()->with('items')->lockForUpdate()->findOrFail($quote->id);
            if ($locked->status !== SalesQuoteStatus::Draft) {
                throw ValidationException::withMessages(['status' => 'Only draft quotes can be accepted.']);
            }
            $before = $locked->toArray();
            $orderReference = 'SO-'.$locked->reference;
            if (SalesOrder::query()->where('reference', $orderReference)->exists()) {
                throw ValidationException::withMessages(['reference' => 'An order has already been created for this quote.']);
            }
            $order = SalesOrder::query()->create([
                'reference' => $orderReference,
                'client_id' => $locked->client_id,
                'sales_quote_id' => $locked->id,
                'created_by' => $actor->id,
                'status' => SalesOrderStatus::Confirmed,
                'currency' => $locked->currency,
                'total_cents' => $locked->total_cents,
            ]);
            foreach ($locked->items as $quoteItem) {
                $catalog = SalesCatalogItem::query()->lockForUpdate()->findOrFail($quoteItem->sales_catalog_item_id);
                $asset = $catalog->asset()->lockForUpdate()->first();
                if ($catalog->status !== 'active' || ($asset !== null && ! $asset->status->dispatchable())) {
                    throw ValidationException::withMessages(['items' => "Saleable inventory {$catalog->sku} is no longer available."]);
                }
                if ($asset !== null && RentalReservationItem::query()
                    ->where('operational_asset_id', $asset->id)
                    ->whereHas('reservation', fn ($query) => $query->whereIn('status', [
                        RentalReservationStatus::Requested->value,
                        RentalReservationStatus::Reserved->value,
                        RentalReservationStatus::CheckedOut->value,
                    ]))
                    ->exists()) {
                    throw ValidationException::withMessages(['items' => "Equipment {$catalog->sku} is reserved for a rental."]);
                }
                $available = $catalog->quantity_on_hand - $catalog->quantity_reserved;
                if ($available < $quoteItem->quantity) {
                    throw ValidationException::withMessages(['items' => "Insufficient inventory for {$catalog->sku}."]);
                }
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
