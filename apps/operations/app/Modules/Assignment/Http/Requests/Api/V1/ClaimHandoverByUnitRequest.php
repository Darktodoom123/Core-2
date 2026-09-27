<?php

namespace App\Modules\Assignment\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

final class ClaimHandoverByUnitRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null && $this->user()->is_active;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'asset_code' => ['required', 'string', 'max:64'],
            'pin' => ['required', 'string', 'digits:4'],
        ];
    }
}
