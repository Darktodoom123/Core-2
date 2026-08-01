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
            'quantity_litres' => $this->quantity_litres,
            'fuel_type' => $this->fuel_type,
            'purpose' => $this->purpose,
            'status' => $this->status->value,
            'decision_reason' => $this->decision_reason,
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
