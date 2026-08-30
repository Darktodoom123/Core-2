<?php

namespace App\Modules\Fuel\Http\Resources\V1;

use App\Modules\Fuel\Models\FuelRequest;
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
            'dispatch_job_id' => $this->dispatch_job_id,
            'operational_asset_id' => $this->operational_asset_id,
            'asset' => $this->whenLoaded('asset', fn () => [
                'id' => $this->asset?->id,
                'code' => $this->asset?->code,
                'name' => $this->asset?->name,
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
                'fuel_station' => $log->fuel_station,
                'recorded_at' => $log->recorded_at?->toISOString(),
            ])),
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
