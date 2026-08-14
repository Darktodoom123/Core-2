<?php

namespace App\Modules\Rental\Models;

use App\Modules\Dispatch\Models\Client;
use App\Modules\Rental\Enums\RentalReservationStatus;
use App\Platform\Identity\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property RentalReservationStatus $status
 */
class RentalReservation extends Model
{
    use SoftDeletes;

    protected $fillable = ['reference', 'client_id', 'created_by', 'approved_by', 'dispatch_job_id', 'status', 'start_date', 'end_date', 'delivery_location', 'fulfillment_mode', 'notes', 'total_cents'];

    protected function casts(): array
    {
        return ['status' => RentalReservationStatus::class, 'start_date' => 'date', 'end_date' => 'date', 'total_cents' => 'integer'];
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

    /** @return HasMany<RentalReservationItem, $this> */
    public function items(): HasMany
    {
        return $this->hasMany(RentalReservationItem::class);
    }

    /** @return HasMany<RentalOperatorAssignment, $this> */
    public function operatorAssignments(): HasMany
    {
        return $this->hasMany(RentalOperatorAssignment::class);
    }

    /** @return HasOne<RentalCheckout, $this> */
    public function checkout(): HasOne
    {
        return $this->hasOne(RentalCheckout::class);
    }

    /** @return HasOne<RentalReturnRecord, $this> */
    public function returnRecord(): HasOne
    {
        return $this->hasOne(RentalReturnRecord::class);
    }
}
