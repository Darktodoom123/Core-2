<?php

namespace App\Modules\Sales\Actions;

use App\Modules\Sales\Enums\SalesOrderStatus;
use App\Modules\Sales\Models\SalesCatalogItem;
use App\Modules\Sales\Models\SalesOrder;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class FulfillSalesOrder
{
    public function __construct(private readonly RecordAuditEvent $audit) {}

    public function handle(SalesOrder $order, User $actor): SalesOrder
    {
        return DB::transaction(function () use ($order, $actor): SalesOrder {
            $locked = SalesOrder::query()->with('items')->lockForUpdate()->findOrFail($order->id);
            if ($locked->status !== SalesOrderStatus::Confirmed) {
                throw ValidationException::withMessages(['status' => 'Only confirmed orders can be fulfilled.']);
            }
            $before = $locked->toArray();
            foreach ($locked->items as $item) {
                $catalog = SalesCatalogItem::query()->lockForUpdate()->findOrFail($item->sales_catalog_item_id);
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
            $locked->update(['status' => SalesOrderStatus::Fulfilled, 'fulfilled_at' => now()]);
            $this->audit->handle($actor, $locked, 'sales_order.fulfilled', $before, $locked->fresh()->toArray());

            return $locked->fresh(['items.catalogItem', 'client']);
        });
    }
}
