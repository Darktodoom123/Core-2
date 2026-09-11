<?php

namespace App\Modules\Assignment\Http\Resources\V1;

use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin DispatchPersonnelAssignment */
final class DispatchPersonnelAssignmentResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'user_name' => $this->user->name,
            'response_status' => $this->response_status->value,
            'response_status_label' => $this->response_status->label(),
            'responded_at' => $this->responded_at?->toIso8601String(),
            'assigned_at' => $this->created_at?->toIso8601String(),
            'active_until' => $this->active_until?->toIso8601String(),
        ];
    }
}
