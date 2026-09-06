<?php

namespace App\Modules\Dvir\Http\Resources\V1;

use App\Modules\Dvir\Models\DvirInspection;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin DvirInspection
 */
class DvirInspectionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->reference,
            'internal_id' => $this->getKey(),
            'type' => $this->inspection_type->value,
            'type_label' => $this->inspection_type->label(),
            'user_id' => $this->user_id,
            'operational_asset_id' => $this->operational_asset_id,
            'dispatch_job_id' => $this->dispatch_job_id,
            'asset_code' => $this->asset_code,
            'asset_name' => $this->asset_name,
            'inspector_name' => $this->inspector_name,
            'starting_odometer_km' => $this->starting_odometer_km,
            'ending_odometer_km' => $this->ending_odometer_km,
            'engine_hours' => $this->engine_hours,
            'has_defects' => $this->has_defects,
            'critical_defects_count' => $this->critical_defects_count,
            'signature_captured' => $this->signature_captured,
            'remarks' => $this->remarks,
            'completed_at' => $this->completed_at->toIso8601String(),
            'checks' => DvirInspectionCheckResource::collection($this->whenLoaded('checks')),
            'photos' => DvirInspectionPhotoResource::collection($this->whenLoaded('photos')),
        ];
    }
}
