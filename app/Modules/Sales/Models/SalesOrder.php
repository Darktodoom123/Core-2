<?php

namespace App\Modules\Sales\Models;

use App\Modules\Dispatch\Models\Client;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Sales\Enums\SalesFulfillmentMode;
use App\Modules\Sales\Enums\SalesOrderStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property SalesOrderStatus $status
 * @property SalesFulfillmentMode $fulfillment_mode
 * @property int|null $dispatch_job_id
 */
class SalesOrder extends Model
{
    protected $fillable = ['reference', 'client_id', 'sales_quote_id', 'created_by', 'dispatch_job_id', 'fulfillment_mode', 'delivery_location', 'status', 'currency', 'total_cents', 'fulfilled_at'];

    protected function casts(): array
    {
        return [
            'status' => SalesOrderStatus::class,
            'fulfillment_mode' => SalesFulfillmentMode::class,
            'dispatch_job_id' => 'integer',
            'total_cents' => 'integer',
            'fulfilled_at' => 'datetime',
        ];
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

    /** @return BelongsTo<DispatchJob, $this> */
    public function dispatchJob(): BelongsTo
    {
        return $this->belongsTo(DispatchJob::class, 'dispatch_job_id');
    }

    public function requiresDispatch(): bool
    {
        return $this->fulfillmentMode()->requiresDispatch();
    }

    public function fulfillmentMode(): SalesFulfillmentMode
    {
        $mode = $this->getAttribute('fulfillment_mode');

        return $mode instanceof SalesFulfillmentMode
            ? $mode
            : SalesFulfillmentMode::tryFrom((string) $mode) ?? SalesFulfillmentMode::Pickup;
    }

    public function isReadyForDispatchHandoff(): bool
    {
        return $this->requiresDispatch()
            && $this->status === SalesOrderStatus::Confirmed
            && $this->dispatch_job_id === null;
    }

    /** @return array<string, mixed>|null */
    public function dispatchHandoffPayload(): ?array
    {
        if (! $this->requiresDispatch()) {
            return null;
        }

        return [
            'source_type' => 'sales_order',
            'source_id' => (int) $this->getKey(),
            'source_reference' => $this->reference,
            'client_id' => (int) $this->client_id,
            'fulfillment_mode' => $this->fulfillmentMode()->value,
            'delivery_location' => $this->delivery_location,
            'status' => $this->status->value,
            'dispatch_job_id' => $this->dispatch_job_id,
            'ready' => $this->isReadyForDispatchHandoff(),
        ];
    }

    /** @return HasMany<SalesOrderItem, $this> */
    public function items(): HasMany
    {
        return $this->hasMany(SalesOrderItem::class);
    }
}
