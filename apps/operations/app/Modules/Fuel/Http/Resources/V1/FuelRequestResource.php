<?php

namespace App\Modules\Fuel\Http\Resources\V1;

use App\Modules\Fuel\Enums\FuelNoReceiptReason;
use App\Modules\Fuel\Enums\FuelRequestStatus;
use App\Modules\Fuel\Models\FuelRequest;
use App\Platform\Identity\Enums\PermissionName;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin FuelRequest */
final class FuelRequestResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'reference' => $this->reference,
            'client_request_id' => $this->resource->getAttribute('client_request_id'),
            'can_record' => $this->status === FuelRequestStatus::Verified && $request->user()->can('record', $this->resource) && ($this->requester_id === $request->user()->id || $request->user()->can(PermissionName::FuelViewAll->value)),
            'can_withdraw' => $this->requester_id === $request->user()->id && $this->status->isAwaitingDecision(),
            'reviewed_at' => $this->reviewed_at?->toISOString(),
            'approved_at' => $this->approved_at?->toISOString(),
            'verified_at' => $this->verified_at?->toISOString(),
            'withdrawn_at' => $this->withdrawn_at?->toISOString(),
            'withdrawal_reason' => $this->withdrawal_reason,
            'dispatch_job_id' => $this->dispatch_job_id,
            'operational_asset_id' => $this->operational_asset_id,
            'asset' => $this->whenLoaded('asset', fn () => [
                'id' => $this->asset?->id,
                'code' => $this->asset?->code,
                'name' => $this->asset?->name,
                'meter_type' => $this->asset?->meter_type,
                'meter_value' => $this->asset?->meter_value,
                'kind' => $this->asset?->kind,
                'subtype' => $this->asset?->subtype,
                'registration_number' => $this->asset?->registration_number,
                'manufacturer' => $this->asset?->manufacturer,
                'model' => $this->asset?->model,
            ]),
            'job' => $this->whenLoaded('job', fn () => [
                'id' => $this->job?->id,
                'reference' => $this->job?->reference,
                'title' => $this->job?->title,
            ]),
            'quantity_litres' => $this->quantity_litres,
            'fuel_type' => $this->fuel_type,
            'purpose' => $this->purpose,
            'urgency' => $this->urgency,
            'needed_by' => $this->needed_by?->toISOString(),
            'current_fuel_level_percent' => $this->current_fuel_level_percent,
            'status' => $this->status->value,
            'decision_reason' => $this->decision_reason,
            'logs' => $this->whenLoaded('logs', fn () => $this->logs->map(fn ($log) => [
                'id' => $log->id,
                'quantity_litres' => $log->quantity_litres,
                'odometer_km' => $log->odometer_km,
                'hour_meter' => $log->hour_meter,
                'variance_litres' => $log->variance_litres,
                'variance_percentage' => $log->variance_percentage,
                'effective_burn_rate' => $log->effective_burn_rate,
                'burn_rate_unit' => $log->burn_rate_unit,
                'is_anomaly' => $log->is_anomaly,
                'anomaly_reason' => $log->anomaly_reason,
                'total_cost' => $log->total_cost,
                'price_per_litre' => $log->price_per_litre,
                'remarks' => $log->remarks,
                'has_receipt' => $log->receipt_path !== null,
                'receipt_number' => $log->receipt_number,
                'no_receipt_reason' => $log->no_receipt_reason,
                'no_receipt_reason_label' => FuelNoReceiptReason::tryFrom((string) $log->no_receipt_reason)?->label(),
                'no_receipt_note' => $log->no_receipt_note,
                'requires_receipt_review' => $log->requiresReceiptReview(),
                'receipt_reviewed_at' => $log->receipt_reviewed_at?->toISOString(),
                'receipt_review_note' => $log->receipt_review_note,
                'fuel_station' => $log->fuel_station,
                'recorded_at' => $log->recorded_at?->toISOString(),
            ])->values()->all()),
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
