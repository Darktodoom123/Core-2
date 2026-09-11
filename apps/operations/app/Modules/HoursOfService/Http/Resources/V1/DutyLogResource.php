<?php

namespace App\Modules\HoursOfService\Http\Resources\V1;

use App\Modules\HoursOfService\Models\OperatorDutyLog;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin OperatorDutyLog
 */
class DutyLogResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'duty_status' => $this->duty_status->value,
            'duty_status_label' => $this->duty_status->label(),
            'standby_reason' => $this->standby_reason?->value,
            'standby_reason_label' => $this->standby_reason?->label(),
            'is_demurrage_billable' => $this->is_demurrage_billable,
            'started_at' => $this->started_at->toIso8601String(),
            'ended_at' => $this->ended_at?->toIso8601String(),
            'duration_minutes' => $this->duration_minutes,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'location_name' => $this->location_name,
            'remarks' => $this->remarks,
        ];
    }
}
