<?php

namespace App\Modules\Dispatch\Http\Resources\V2;

use App\Modules\Dispatch\Models\DispatchEmergencyOverride;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin DispatchEmergencyOverride
 */
class DispatchEmergencyOverrideResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'attempt_id' => $this->attempt_id,
            'override_type' => $this->kind,
            'kind' => $this->kind,
            'status' => $this->status->value,
            'reason' => $this->request_reason,
            'request_reason' => $this->request_reason,
            'proposed_by' => $this->requested_by,
            'requested_by' => $this->requested_by,
            'proposed_at' => $this->created_at?->toISOString(),
            'requested_at' => $this->created_at?->toISOString(),
            'decided_by' => $this->decided_by,
            'decided_at' => $this->decided_at?->toISOString(),
            'decision_notes' => $this->decision_reason,
            'decision_reason' => $this->decision_reason,
            'expires_at' => $this->expires_at?->toISOString(),
        ];
    }
}
