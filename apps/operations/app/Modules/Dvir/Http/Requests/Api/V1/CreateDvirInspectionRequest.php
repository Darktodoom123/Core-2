<?php

namespace App\Modules\Dvir\Http\Requests\Api\V1;

use App\Modules\Dvir\Enums\DvirCheckStatus;
use App\Modules\Dvir\Enums\DvirInspectionType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CreateDvirInspectionRequest extends FormRequest
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
            'inspection_type' => ['required', 'string', Rule::enum(DvirInspectionType::class)],
            'operational_asset_id' => ['nullable', 'integer', 'exists:operational_assets,id'],
            'dispatch_job_id' => ['nullable', 'integer', 'exists:dispatch_jobs,id'],
            'asset_code' => ['required_without:operational_asset_id', 'nullable', 'string', 'max:64'],
            'asset_name' => ['nullable', 'string', 'max:255'],
            'inspector_name' => ['nullable', 'string', 'max:255'],
            'starting_odometer_km' => ['nullable', 'numeric', 'min:0', 'max:4294967295'],
            'ending_odometer_km' => ['nullable', 'numeric', 'min:0', 'max:4294967295'],
            'engine_hours' => ['nullable', 'numeric', 'min:0', 'max:4294967295'],
            'has_defects' => ['required', 'boolean'],
            'signature_captured' => ['required', 'boolean'],
            'remarks' => ['nullable', 'string', 'max:2000'],
            'completed_at' => ['nullable', 'date'],
            'checks' => ['present', 'array', 'max:100'],
            'checks.*.id' => ['nullable', 'string', 'max:64'],
            'checks.*.category' => ['required', 'string', 'max:64'],
            'checks.*.label' => ['required', 'string', 'max:255'],
            'checks.*.status' => [
                'required',
                'string',
                Rule::enum(DvirCheckStatus::class),
            ],
            'checks.*.status_label' => ['nullable', 'string', 'max:255'],
            'checks.*.notes' => ['nullable', 'string', 'max:2000'],
            'photos' => ['nullable', 'array', 'max:8'],
            'photos.*.angle' => ['required', 'string', 'in:front,back,driver_side,passenger_side,defect'],
            'photos.*.file_name' => ['nullable', 'string', 'max:255'],
            'photos.*.file_size' => ['nullable', 'integer', 'max:15728640'],
            'photos.*.base64' => ['nullable', 'string'],
            'photos.*.uri' => ['nullable', 'string', 'max:1000'],
            'command_id' => ['nullable', 'uuid'],
        ];
    }

    /**
     * Checks in the order submitted by the client. `validated()` normalizes
     * nested array data and can shuffle element order, which would corrupt the
     * recorded sort order. The values stored by the action are exactly the
     * fields covered by the `checks.*` rules.
     *
     * @return list<array<string, mixed>>
     */
    public function checksPayload(): array
    {
        $checks = $this->input('checks');

        return is_array($checks) ? array_values($checks) : [];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function photosPayload(): array
    {
        $photos = $this->input('photos');

        return is_array($photos) ? array_values($photos) : [];
    }
}
