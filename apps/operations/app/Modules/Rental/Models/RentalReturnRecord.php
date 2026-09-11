<?php

namespace App\Modules\Rental\Models;

use App\Platform\Identity\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RentalReturnRecord extends Model
{
    protected $table = 'rental_returns';

    protected $fillable = ['rental_reservation_id', 'returned_by', 'returned_at', 'condition_after', 'damage_notes'];

    protected function casts(): array
    {
        return ['returned_at' => 'datetime', 'condition_after' => 'array'];
    }

    /** @return BelongsTo<RentalReservation, $this> */
    public function reservation(): BelongsTo
    {
        return $this->belongsTo(RentalReservation::class, 'rental_reservation_id');
    }

    /** @return BelongsTo<User, $this> */
    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'returned_by');
    }
}
