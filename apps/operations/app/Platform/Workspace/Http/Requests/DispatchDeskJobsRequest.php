<?php

namespace App\Platform\Workspace\Http\Requests;

use App\Modules\Dispatch\Models\DispatchJob;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class DispatchDeskJobsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('viewAny', DispatchJob::class) ?? false;
    }

    protected function prepareForValidation(): void
    {
        $this->merge(['view' => $this->input('view', 'schedule')]);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $timestamp = ['bail', 'nullable', 'string', 'date', 'regex:/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/'];

        return [
            'view' => ['required', Rule::in(['schedule', 'in-progress', 'history'])],
            'q' => ['nullable', 'string', 'max:200'],
            'source' => ['sometimes', Rule::in(['all', 'manual', 'service_request', 'rental_reservation', 'sales_order'])],
            'page' => ['sometimes', 'integer', 'min:1', 'max:1000000'],
            'ends_after' => [...$timestamp, 'required_if:view,schedule', 'required_with:starts_before'],
            'starts_before' => [...$timestamp, 'required_if:view,schedule', 'required_with:ends_after', 'after:ends_after'],
        ];
    }

    /** @return array{view: string, q?: string|null, source?: string, page?: int|string, ends_after?: string|null, starts_before?: string|null} */
    public function filters(): array
    {
        /** @var array{view: string, q?: string|null, source?: string, page?: int|string, ends_after?: string|null, starts_before?: string|null} $validated */
        $validated = $this->validated();

        return $validated;
    }
}
