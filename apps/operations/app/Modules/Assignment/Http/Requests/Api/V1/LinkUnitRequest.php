<?php

namespace App\Modules\Assignment\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

final class LinkUnitRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null && $this->user()->is_active;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'operational_asset_id' => ['required', 'integer', 'exists:operational_assets,id'],
            'dispatch_job_id' => ['nullable', 'integer', 'exists:dispatch_jobs,id'],
            'command_id' => ['nullable', 'uuid'],
        ];
    }
}
