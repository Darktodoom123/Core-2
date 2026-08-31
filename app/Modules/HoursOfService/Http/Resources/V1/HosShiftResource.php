<?php

namespace App\Modules\HoursOfService\Http\Resources\V1;

use App\Modules\HoursOfService\Models\OperatorShift;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin OperatorShift
 */
class HosShiftResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'started_at' => $this->started_at->toIso8601String(),
            'ended_at' => $this->ended_at?->toIso8601String(),
            'operating_minutes' => $this->operating_minutes,
            'driving_minutes' => $this->driving_minutes,
            'standby_minutes' => $this->standby_minutes,
            'break_minutes' => $this->break_minutes,
            'is_certified' => $this->is_certified,
            'certified_at' => $this->certified_at?->toIso8601String(),
            'certification_statement' => $this->certification_statement,
            'remarks' => $this->remarks,
            'active_duty' => $this->activeDutyLog !== null ? new DutyLogResource($this->activeDutyLog) : null,
            'duty_logs' => DutyLogResource::collection($this->whenLoaded('dutyLogs')),
        ];
    }
}
