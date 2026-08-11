<?php

namespace App\Modules\Rental\Models;

use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RentalReservationItem extends Model
{
    protected $fillable = ['rental_reservation_id', 'operational_asset_id', 'quantity', 'rate_cents', 'line_total_cents'];

    protected function casts(): array
    {
        return ['quantity' => 'integer', 'rate_cents' => 'integer', 'line_total_cents' => 'integer'];
    }

    /** @return BelongsTo<RentalReservation, $this> */
    public function reservation(): BelongsTo
    {
        return $this->belongsTo(RentalReservation::class, 'rental_reservation_id');
    }

    /** @return BelongsTo<OperationalAsset, $this> */
    public function asset(): BelongsTo
    {
        return $this->belongsTo(OperationalAsset::class, 'operational_asset_id');
    }
}
