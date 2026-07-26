<?php

namespace App\Http\Requests;

use App\Enums\AssignmentResponse;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class RespondToDispatchAssignmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'response' => ['required', 'string', Rule::in([AssignmentResponse::Accepted->value, AssignmentResponse::Rejected->value])],
            'reason' => ['nullable', 'required_if:response,'.AssignmentResponse::Rejected->value, 'string', 'max:1000'],
            'version' => ['required', 'integer', 'min:1'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'reason.required_if' => 'A reason is required when rejecting an assignment.',
        ];
    }
}
