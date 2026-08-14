<?php

namespace App\Modules\Rental\Models;

use App\Modules\Rental\Enums\RentalOperatorType;
use App\Platform\Identity\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property RentalOperatorType $operator_type
 * @property Carbon $active_from
 * @property Carbon $active_until
 */
class RentalOperatorAssignment extends Model
{
    protected $fillable = [
        'rental_reservation_id',
        'rental_reservation_item_id',
        'user_id',
        'operator_type',
        'assigned_by',
        'active_from',
        'active_until',
    ];

    protected function casts(): array
    {
        return [
            'operator_type' => RentalOperatorType::class,
            'active_from' => 'datetime',
            'active_until' => 'datetime',
        ];
    }

    /** @return BelongsTo<RentalReservation, $this> */
    public function reservation(): BelongsTo
    {
        return $this->belongsTo(RentalReservation::class, 'rental_reservation_id');
    }

    /** @return BelongsTo<RentalReservationItem, $this> */
    public function item(): BelongsTo
    {
        return $this->belongsTo(RentalReservationItem::class, 'rental_reservation_item_id');
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<User, $this> */
    public function assigner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }
}
