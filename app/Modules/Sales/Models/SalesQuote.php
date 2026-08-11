<?php

namespace App\Modules\Sales\Models;

use App\Modules\Dispatch\Models\Client;
use App\Modules\Sales\Enums\SalesQuoteStatus;
use App\Platform\Identity\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property SalesQuoteStatus $status
 */
class SalesQuote extends Model
{
    protected $fillable = ['reference', 'client_id', 'created_by', 'status', 'currency', 'total_cents', 'valid_until', 'notes'];

    protected function casts(): array
    {
        return ['status' => SalesQuoteStatus::class, 'valid_until' => 'date', 'total_cents' => 'integer'];
    }

    /** @return BelongsTo<Client, $this> */
    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** @return HasMany<SalesQuoteItem, $this> */
    public function items(): HasMany
    {
        return $this->hasMany(SalesQuoteItem::class);
    }
}
