<?php

namespace App\Modules\Assignment\Http\Requests\Api\V2;

use Illuminate\Foundation\Http\FormRequest;

class ProposeAssignmentOfferV2Request extends FormRequest
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
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'assignment_type' => ['required', 'string', 'max:32'],
            'is_mandatory' => ['nullable', 'boolean'],
            'version' => ['required', 'integer', 'min:1'],
            'command_id' => ['nullable', 'string', 'max:128'],
            'reason' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
