<?php

namespace App\Http\Requests;

use App\Enums\PermissionName;
use Illuminate\Foundation\Http\FormRequest;

final class StoreLocationUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can(PermissionName::TrackingShareOwn->value) ?? false;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'operational_asset_id' => ['nullable', 'integer', 'exists:operational_assets,id'],
            'dispatch_job_id' => ['nullable', 'integer', 'exists:dispatch_jobs,id'],
            'latitude' => ['required_if:sharing_enabled,true', 'nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['required_if:sharing_enabled,true', 'nullable', 'numeric', 'between:-180,180'],
            'accuracy_metres' => ['nullable', 'numeric', 'min:0', 'max:10000'],
            'captured_at' => ['required', 'date', 'before_or_equal:now'],
            'sharing_enabled' => ['required', 'boolean'],
            'remarks' => ['nullable', 'string', 'max:1000'],
            'command_id' => ['nullable', 'uuid'],
        ];
    }
}
