<?php

namespace App\Modules\Sales\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalesOrderItem extends Model
{
    protected $fillable = ['sales_order_id', 'sales_catalog_item_id', 'quantity', 'unit_price_cents', 'line_total_cents'];

    protected function casts(): array
    {
        return ['quantity' => 'integer', 'unit_price_cents' => 'integer', 'line_total_cents' => 'integer'];
    }

    /** @return BelongsTo<SalesOrder, $this> */
    public function order(): BelongsTo
    {
        return $this->belongsTo(SalesOrder::class, 'sales_order_id');
    }

    /** @return BelongsTo<SalesCatalogItem, $this> */
    public function catalogItem(): BelongsTo
    {
        return $this->belongsTo(SalesCatalogItem::class, 'sales_catalog_item_id');
    }
}
