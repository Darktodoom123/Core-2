<?php

namespace App\Modules\HoursOfService\Http\Requests\Api\V1;

use App\Modules\HoursOfService\Enums\DutyStatus;
use App\Modules\HoursOfService\Enums\StandbyReason;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

class ChangeDutyStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null && $this->user()->is_active;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'duty_status' => ['required', new Enum(DutyStatus::class)],
            'operational_asset_id' => ['nullable', 'integer', 'exists:operational_assets,id'],
            'dispatch_job_id' => ['nullable', 'integer', 'exists:dispatch_jobs,id'],
            'occurred_at' => ['nullable', 'date', 'before_or_equal:now'],
            'standby_reason' => ['nullable', new Enum(StandbyReason::class)],
            'latitude' => ['nullable', 'numeric', 'between:-90,90', 'required_with:longitude'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180', 'required_with:latitude'],
            'accuracy_metres' => ['nullable', 'numeric', 'between:0,10000'],
            'location_observed_at' => ['nullable', 'date'],
            'location_source' => ['nullable', 'string', 'max:40', 'in:gps,last_known,browser_gps,permission_denied,unavailable,legacy,retention_pruned'],
            'location_name' => ['nullable', 'string', 'max:255'],
            'remarks' => ['nullable', 'string', 'max:1000'],
            'command_id' => ['nullable', 'uuid'],
        ];
    }
}
