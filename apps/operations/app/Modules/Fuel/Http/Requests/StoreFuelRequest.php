<?php

namespace App\Modules\Fuel\Http\Requests;

use App\Modules\Fuel\Models\FuelRequest;
use Illuminate\Foundation\Http\FormRequest;

final class StoreFuelRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('create', FuelRequest::class) ?? false;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'dispatch_job_id' => ['nullable', 'integer', 'exists:dispatch_jobs,id'],
            'operational_asset_id' => ['nullable', 'integer', 'exists:operational_assets,id'],
            'operator_shift_id' => ['nullable', 'integer', 'exists:operator_shifts,id'],
            ...FuelRequestContextRules::requestDetails(),
        ];
    }
}
