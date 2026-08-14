<?php

namespace App\Modules\Dispatch\Http\Resources\V2;

use App\Modules\Dispatch\Models\DispatchPlanVersion;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin DispatchPlanVersion
 */
class DispatchPlanVersionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'attempt_id' => $this->attempt_id,
            'version' => $this->version,
            'status' => $this->status->value,
            'snapshot' => $this->snapshot,
            'content_hash' => $this->content_hash,
            'scheduled_start' => $this->scheduled_start?->toISOString(),
            'scheduled_end' => $this->scheduled_end?->toISOString(),
            'submitted_by' => $this->submitted_by,
            'submitted_at' => $this->submitted_at?->toISOString(),
            'sealed_at' => $this->sealed_at?->toISOString(),
            'superseded_at' => $this->superseded_at?->toISOString(),
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
