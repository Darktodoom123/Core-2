<?php

namespace App\Modules\Assignment\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

final class ClaimHandoverRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null && $this->user()->is_active;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'handover_token' => ['nullable', 'string', 'uuid'],
            'pin' => ['nullable', 'string', 'digits:4'],
        ];
    }

    public function hasValidCredentials(): bool
    {
        return $this->filled('handover_token') || $this->filled('pin');
    }
}
