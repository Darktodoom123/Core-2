<?php

namespace App\Modules\Dispatch\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class UpdateDispatchResourceRequirementsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'version' => ['required', 'integer', 'min:1'],
            'resource_requirements' => ['required', 'array:personnel,assets'],
            'resource_requirements.personnel' => ['sometimes', 'array:driver,crane_operator,rigger'],
            'resource_requirements.assets' => ['sometimes', 'array:truck,vehicle,crane,mobile_crane,tower_crane,equipment'],
            'resource_requirements.personnel.*' => ['integer', 'min:0', 'max:50'],
            'resource_requirements.assets.*' => ['integer', 'min:0', 'max:50'],
        ];
    }
}
