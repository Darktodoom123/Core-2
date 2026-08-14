<?php

namespace App\Modules\Dispatch\Http\Resources\V2;

use App\Modules\Dispatch\Models\DispatchPlanApproval;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin DispatchPlanApproval
 */
class DispatchPlanApprovalResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'plan_version_id' => $this->plan_version_id,
            'approval_request_id' => $this->approval_request_id,
            'kind' => $this->kind,
            'status' => $this->status->value,
            'reason' => $this->reason,
            'requested_by' => $this->requested_by,
            'decided_by' => $this->decided_by,
            'decided_at' => $this->decided_at?->toISOString(),
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
