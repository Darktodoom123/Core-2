<?php

namespace App\Modules\Assignment\Http\Resources\V1;

use App\Modules\Assignment\Models\DispatchAssetAssignment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin DispatchAssetAssignment */
final class DispatchAssetAssignmentResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'operational_asset_id' => $this->operational_asset_id,
            'asset_code' => $this->asset->code,
            'asset_name' => $this->asset->name,
            'asset_kind' => $this->asset->kind,
            'asset_subtype' => $this->asset->subtype,
            'model' => $this->asset->model,
            'rated_capacity' => $this->asset->rated_capacity !== null ? (float) $this->asset->rated_capacity : null,
            'capacity_unit' => $this->asset->capacity_unit,
            'engine_hours' => $this->asset->meter_value !== null ? (float) $this->asset->meter_value : null,
            'meter_type' => $this->asset->meter_type,
            'attachments' => $this->asset->specifications['attachments'] ?? [],
            'site_latitude' => $this->site_latitude !== null ? (float) $this->site_latitude : null,
            'site_longitude' => $this->site_longitude !== null ? (float) $this->site_longitude : null,
            'jib_length_meters' => isset($this->asset->specifications['jib_length_meters'])
                ? (int) $this->asset->specifications['jib_length_meters']
                : 60,
            'assigned_at' => $this->created_at?->toIso8601String(),
            'active_until' => $this->active_until?->toIso8601String(),
        ];
    }
}
