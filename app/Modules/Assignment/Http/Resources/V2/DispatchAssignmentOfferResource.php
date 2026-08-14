<?php

namespace App\Modules\Assignment\Http\Resources\V2;

use App\Modules\Dispatch\Models\DispatchAssignmentOffer;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin DispatchAssignmentOffer
 */
class DispatchAssignmentOfferResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'attempt_id' => $this->attempt_id,
            'plan_version_id' => $this->plan_version_id,
            'user_id' => $this->user_id,
            'user_name' => $this->user?->name,
            'assignment_type' => $this->assignment_type,
            'is_mandatory' => $this->is_mandatory,
            'status' => $this->status->value,
            'offered_at' => $this->offered_at?->toISOString(),
            'response_deadline' => $this->response_deadline?->toISOString(),
            'responded_at' => $this->responded_at?->toISOString(),
            'response_reason' => $this->response_reason,
            'accepted_at' => $this->accepted_at?->toISOString(),
            'rejected_at' => $this->rejected_at?->toISOString(),
            'withdrawn_at' => $this->withdrawn_at?->toISOString(),
            'expired_at' => $this->expired_at?->toISOString(),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
