<?php

namespace App\Modules\Dispatch\Http\Requests\Api\V2;

use Illuminate\Foundation\Http\FormRequest;

class ProposeEmergencyOverrideV2Request extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'override_type' => ['required', 'string', 'max:64'],
            'reason' => ['required', 'string', 'max:1000'],
            'version' => ['required', 'integer', 'min:1'],
            'command_id' => ['nullable', 'string', 'max:128'],
        ];
    }
}
