<?php

namespace App\Modules\Sales\Models;

use App\Modules\Dispatch\Models\Client;
use App\Modules\Sales\Enums\SalesOrderStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property SalesOrderStatus $status
 */
class SalesOrder extends Model
{
    protected $fillable = ['reference', 'client_id', 'sales_quote_id', 'created_by', 'status', 'currency', 'total_cents', 'fulfilled_at'];

    protected function casts(): array
    {
        return ['status' => SalesOrderStatus::class, 'total_cents' => 'integer', 'fulfilled_at' => 'datetime'];
    }

    /** @return BelongsTo<Client, $this> */
    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    /** @return BelongsTo<SalesQuote, $this> */
    public function quote(): BelongsTo
    {
        return $this->belongsTo(SalesQuote::class, 'sales_quote_id');
    }

    /** @return HasMany<SalesOrderItem, $this> */
    public function items(): HasMany
    {
        return $this->hasMany(SalesOrderItem::class);
    }
}
