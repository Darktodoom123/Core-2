<?php

namespace App\Modules\Sales\Actions;

use App\Modules\Sales\Enums\SalesOrderStatus;
use App\Modules\Sales\Models\SalesOrder;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Enums\AssetStatus;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class TransferSalesOwnership
{
    public function __construct(private readonly RecordAuditEvent $audit) {}

    public function handle(SalesOrder $order, User $actor): SalesOrder
    {
        return DB::transaction(function () use ($order, $actor): SalesOrder {
            $locked = SalesOrder::query()->with('items.catalogItem')->lockForUpdate()->findOrFail($order->id);
            if ($locked->status !== SalesOrderStatus::Fulfilled) {
                throw ValidationException::withMessages(['status' => 'Only fulfilled orders can transfer ownership.']);
            }
            $before = $locked->toArray();
            foreach ($locked->items as $item) {
                $alreadyTransferred = DB::table('ownership_transfers')->where('sales_order_item_id', $item->id)->exists();
                if ($alreadyTransferred) {
                    throw ValidationException::withMessages(['status' => 'Ownership has already been transferred for this order.']);
                }
                $catalog = $item->catalogItem;
                $asset = $catalog?->asset;
                DB::table('ownership_transfers')->insert([
                    'sales_order_id' => $locked->id,
                    'sales_order_item_id' => $item->id,
                    'sales_catalog_item_id' => $catalog->id,
                    'operational_asset_id' => $asset?->id,
                    'transferred_by' => $actor->id,
                    'transferred_at' => now(),
                    'created_at' => now(), 'updated_at' => now(),
                ]);
                if ($asset !== null) {
                    $asset->update(['status' => AssetStatus::Unavailable]);
                }
            }
            $locked->update(['status' => SalesOrderStatus::Transferred]);
            $this->audit->handle($actor, $locked, 'sales_order.ownership_transferred', $before, $locked->fresh()->toArray());

            return $locked->fresh(['items.catalogItem', 'client']);
        });
    }
}
