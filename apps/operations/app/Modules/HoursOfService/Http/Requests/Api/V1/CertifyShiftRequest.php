<?php

namespace App\Modules\HoursOfService\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class CertifyShiftRequest extends FormRequest
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
            'certification_statement' => ['required', 'string', 'min:5', 'max:1000'],
            'remarks' => ['nullable', 'string', 'max:1000'],
            'command_id' => ['nullable', 'uuid'],
        ];
    }
}
