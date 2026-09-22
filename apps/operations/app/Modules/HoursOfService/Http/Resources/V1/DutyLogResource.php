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
        $freshness = $this->location_freshness
            ?? ($this->latitude !== null && $this->longitude !== null ? 'last_known' : 'unavailable');

        $locationLabel = match ($freshness) {
            'fresh' => $this->location_name ?? 'GPS position',
            'last_known' => 'Last known location',
            default => 'Location unavailable',
        };

        return [
            'id' => $this->id,
            'previous_duty_status' => $this->previous_duty_status?->value,
            'previous_duty_status_label' => $this->previous_duty_status?->label(),
            'duty_status' => $this->duty_status->value,
            'new_duty_status' => $this->duty_status->value,
            'duty_status_label' => $this->duty_status->label(),
            'standby_reason' => $this->standby_reason?->value,
            'standby_reason_label' => $this->standby_reason?->label(),
            'is_demurrage_billable' => $this->is_demurrage_billable,
            'started_at' => $this->started_at->toIso8601String(),
            'ended_at' => $this->ended_at?->toIso8601String(),
            'occurred_at' => ($this->occurred_at ?? $this->started_at)->toIso8601String(),
            'accepted_at' => ($this->accepted_at ?? $this->created_at)->toIso8601String(),
            'duration_minutes' => $this->duration_minutes,
            'operational_asset_id' => $this->operational_asset_id,
            'dispatch_job_id' => $this->dispatch_job_id,
            'equipment' => $this->whenLoaded('operationalAsset', function (): array {
                return [
                    'id' => $this->operationalAsset?->id,
                    'code' => $this->operationalAsset?->code,
                    'name' => $this->operationalAsset?->name,
                    'kind' => $this->operationalAsset?->kind,
                ];
            }),
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'accuracy_metres' => $this->accuracy_metres,
            'location_observed_at' => $this->location_observed_at?->toIso8601String(),
            'location_source' => $this->location_source,
            'location_freshness' => $freshness,
            'location_label' => $locationLabel,
            'location_name' => $this->location_name,
            'remarks' => $this->remarks,
        ];
    }
}
