<?php

namespace App\Modules\Dvir\Http\Resources\V1;

use App\Modules\Dvir\Models\DvirInspectionCheck;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin DvirInspectionCheck
 */
class DvirInspectionCheckResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->external_id ?? (string) $this->getKey(),
            'category' => $this->category,
            'label' => $this->label,
            'status' => $this->status->value,
            'status_label' => $this->status_label,
            'notes' => $this->notes,
        ];
    }
}
