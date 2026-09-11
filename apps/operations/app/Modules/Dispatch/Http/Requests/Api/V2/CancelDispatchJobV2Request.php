<?php

namespace App\Modules\Dispatch\Http\Requests\Api\V2;

use Illuminate\Foundation\Http\FormRequest;

class CancelDispatchJobV2Request extends FormRequest
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
            'version' => ['required', 'integer', 'min:1'],
            'reason' => ['required', 'string', 'max:1000'],
            'command_id' => ['nullable', 'string', 'max:128'],
        ];
    }
}
