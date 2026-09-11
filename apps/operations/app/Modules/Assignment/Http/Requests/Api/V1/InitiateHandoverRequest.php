<?php

namespace App\Modules\Assignment\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

final class InitiateHandoverRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null && $this->user()->is_active;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'relief_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'remarks' => ['nullable', 'string', 'max:500'],
        ];
    }
}
