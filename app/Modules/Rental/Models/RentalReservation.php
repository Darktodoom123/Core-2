<?php

namespace App\Modules\Rental\Models;

use App\Modules\Dispatch\Models\Client;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Rental\Enums\RentalFulfillmentMode;
use App\Modules\Rental\Enums\RentalReservationStatus;
use App\Platform\Identity\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property RentalReservationStatus $status
 * @property RentalFulfillmentMode $fulfillment_mode
 * @property int|null $dispatch_job_id
 */
class RentalReservation extends Model
{
    use SoftDeletes;

    protected $fillable = ['reference', 'client_id', 'created_by', 'approved_by', 'dispatch_job_id', 'status', 'start_date', 'end_date', 'delivery_location', 'fulfillment_mode', 'notes', 'total_cents'];

    protected function casts(): array
    {
        return [
            'status' => RentalReservationStatus::class,
            'fulfillment_mode' => RentalFulfillmentMode::class,
            'start_date' => 'date',
            'end_date' => 'date',
            'dispatch_job_id' => 'integer',
            'total_cents' => 'integer',
        ];
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

    /** @return BelongsTo<DispatchJob, $this> */
    public function dispatchJob(): BelongsTo
    {
        return $this->belongsTo(DispatchJob::class, 'dispatch_job_id');
    }

    public function requiresDispatch(): bool
    {
        return $this->fulfillmentMode()->requiresDispatch();
    }

    public function fulfillmentMode(): RentalFulfillmentMode
    {
        $mode = $this->getAttribute('fulfillment_mode');

        return $mode instanceof RentalFulfillmentMode
            ? $mode
            : RentalFulfillmentMode::tryFrom((string) $mode) ?? RentalFulfillmentMode::Delivery;
    }

    public function isReadyForDispatchHandoff(): bool
    {
        return $this->requiresDispatch()
            && $this->status === RentalReservationStatus::Reserved
            && $this->dispatch_job_id === null;
    }

    /** @return array<string, mixed>|null */
    public function dispatchHandoffPayload(): ?array
    {
        if (! $this->requiresDispatch()) {
            return null;
        }

        return [
            'source_type' => 'rental_reservation',
            'source_id' => (int) $this->getKey(),
            'source_reference' => $this->reference,
            'client_id' => (int) $this->client_id,
            'fulfillment_mode' => $this->fulfillmentMode()->value,
            'delivery_location' => $this->delivery_location,
            'start_date' => $this->getAttribute('start_date') !== null
                ? CarbonImmutable::parse((string) $this->getAttribute('start_date'))->toDateString()
                : null,
            'end_date' => $this->getAttribute('end_date') !== null
                ? CarbonImmutable::parse((string) $this->getAttribute('end_date'))->toDateString()
                : null,
            'status' => $this->status->value,
            'dispatch_job_id' => $this->dispatch_job_id,
            'ready' => $this->isReadyForDispatchHandoff(),
        ];
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
