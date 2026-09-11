<?php

namespace App\Modules\Sales\Models;

use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalesCatalogItem extends Model
{
    protected $fillable = ['sku', 'name', 'description', 'unit_price_cents', 'quantity_on_hand', 'quantity_reserved', 'operational_asset_id', 'status'];

    protected function casts(): array
    {
        return ['unit_price_cents' => 'integer', 'quantity_on_hand' => 'integer', 'quantity_reserved' => 'integer'];
    }

    /** @return BelongsTo<OperationalAsset, $this> */
    public function asset(): BelongsTo
    {
        return $this->belongsTo(OperationalAsset::class, 'operational_asset_id');
    }
}
