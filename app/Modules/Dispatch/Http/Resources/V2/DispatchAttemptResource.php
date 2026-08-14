<?php

namespace App\Modules\Dispatch\Http\Resources\V2;

use App\Modules\Dispatch\Models\DispatchExecutionAttempt;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin DispatchExecutionAttempt
 */
class DispatchAttemptResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'handoff_id' => $this->handoff_id,
            'attempt_number' => $this->attempt_number,
            'replaces_attempt_id' => $this->replaces_attempt_id,
            'status' => $this->status->value,
            'scheduled_start' => $this->scheduled_start?->toISOString(),
            'scheduled_end' => $this->scheduled_end?->toISOString(),
            'version' => $this->version,
            'is_archived' => $this->archived_at !== null,
            'archived_at' => $this->archived_at?->toISOString(),
            'cancellation_reason' => $this->cancellation_reason,
            'designated_lead_offer_id' => $this->designated_lead_offer_id,
            'lead_designated_at' => $this->lead_designated_at?->toISOString(),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
