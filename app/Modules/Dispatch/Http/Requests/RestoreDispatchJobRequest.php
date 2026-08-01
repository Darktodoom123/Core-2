<?php

namespace App\Modules\Dispatch\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class RestoreDispatchJobRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, list<string>> */
    public function rules(): array
    {
        return [
            'reason' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
