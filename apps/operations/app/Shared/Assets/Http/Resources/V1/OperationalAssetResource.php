<?php

namespace App\Shared\Assets\Http\Resources\V1;

use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin OperationalAsset */
final class OperationalAssetResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'name' => $this->name,
            'kind' => $this->kind,
            'subtype' => $this->subtype,
            'status' => $this->status->value,
            'registration_number' => $this->registration_number,
            'manufacturer' => $this->manufacturer,
            'model' => $this->model,
            'rated_capacity' => $this->rated_capacity,
            'capacity_unit' => $this->capacity_unit,
            'meter_type' => $this->meter_type,
            'meter_value' => $this->meter_value,
            'location' => $this->location,
        ];
    }
}
