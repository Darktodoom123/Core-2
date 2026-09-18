<?php

namespace App\Platform\Identity\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class RegisterDeviceTokenRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null && $this->user()->is_active;
    }

    /** @return array<string, list<string>> */
    public function rules(): array
    {
        return [
            'token' => ['required', 'string', 'min:10', 'max:512'],
            'installation_id' => ['required', 'string', 'min:8', 'max:128'],
            'platform' => ['required', 'string', 'in:android,ios'],
            'provider' => ['sometimes', 'string', 'in:expo,fcm'],
            'app_version' => ['nullable', 'string', 'max:32'],
        ];
    }
}
