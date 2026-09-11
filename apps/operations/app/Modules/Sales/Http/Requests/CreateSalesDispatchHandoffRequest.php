<?php

namespace App\Modules\Sales\Http\Requests;

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Platform\Identity\Enums\PermissionName;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class CreateSalesDispatchHandoffRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can(PermissionName::SalesView->value) ?? false;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'scheduled_start' => ['required', 'date', 'after_or_equal:now'],
            'scheduled_end' => ['required', 'date', 'after:scheduled_start'],
            'priority' => ['sometimes', Rule::enum(DispatchPriority::class)],
            'site_notes' => ['nullable', 'string', 'max:5000'],
            'requirements' => ['sometimes', 'array', 'max:20'],
            'requirements.*' => ['string', 'max:255'],
        ];
    }
}
