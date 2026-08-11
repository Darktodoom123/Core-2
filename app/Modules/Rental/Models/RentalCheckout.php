<?php

namespace App\Modules\Rental\Models;

use App\Platform\Identity\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RentalCheckout extends Model
{
    protected $fillable = ['rental_reservation_id', 'checked_out_by', 'checked_out_at', 'condition_before', 'notes'];

    protected function casts(): array
    {
        return ['checked_out_at' => 'datetime', 'condition_before' => 'array'];
    }

    /** @return BelongsTo<RentalReservation, $this> */
    public function reservation(): BelongsTo
    {
        return $this->belongsTo(RentalReservation::class, 'rental_reservation_id');
    }

    /** @return BelongsTo<User, $this> */
    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'checked_out_by');
    }
}
