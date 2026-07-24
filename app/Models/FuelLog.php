<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $fuel_request_id
 * @property int $recorded_by
 * @property string $quantity_litres
 * @property int|null $odometer_km
 * @property string|null $hour_meter
 * @property string|null $price_per_litre
 * @property string|null $total_cost
 * @property string|null $fuel_station
 * @property string|null $remarks
 * @property string|null $receipt_path
 * @property Carbon|null $recorded_at
 * @property FuelRequest $request
 * @property User $recorder
 */
class FuelLog extends Model
{
    protected $fillable = ['fuel_request_id', 'recorded_by', 'quantity_litres', 'odometer_km', 'hour_meter', 'receipt_path', 'recorded_at', 'price_per_litre', 'total_cost', 'fuel_station', 'remarks'];

    protected function casts(): array
    {
        return [
            'quantity_litres' => 'decimal:2',
            'hour_meter' => 'decimal:2',
            'price_per_litre' => 'decimal:2',
            'total_cost' => 'decimal:2',
            'recorded_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<FuelRequest, $this> */
    public function request(): BelongsTo
    {
        return $this->belongsTo(FuelRequest::class, 'fuel_request_id');
    }

    /** @return BelongsTo<User, $this> */
    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    /** @return MorphMany<Attachment, $this> */
    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'owner');
    }
}
