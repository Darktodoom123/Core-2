<?php

namespace App\Modules\Dispatch\Http\Requests\Api\V2;

use Illuminate\Foundation\Http\FormRequest;

class SubmitPlanV2Request extends FormRequest
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
            'snapshot' => ['required', 'array'],
            'version' => ['required', 'integer', 'min:1'],
            'command_id' => ['nullable', 'string', 'max:128'],
            'reason' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
