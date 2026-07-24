<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class ActivateDispatchJobRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, list<string>> */
    public function rules(): array
    {
        return [
            'version' => ['required', 'integer', 'min:1'],
        ];
    }
}
