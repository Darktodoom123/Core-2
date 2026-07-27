<?php

namespace App\Http\Resources\V1;

use App\Models\LocationUpdate;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin LocationUpdate */
final class LocationUpdateResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'dispatch_job_id' => $this->dispatch_job_id,
            'operational_asset_id' => $this->operational_asset_id,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'accuracy_metres' => $this->accuracy_metres,
            'sharing_enabled' => $this->sharing_enabled,
            'captured_at' => $this->captured_at?->toIso8601String(),
            'received_at' => $this->received_at?->toIso8601String(),
            'remarks' => $this->remarks,
        ];
    }
}
