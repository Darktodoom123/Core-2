<?php

namespace App\Platform\Workspace\Http\Requests;

use App\Modules\Dispatch\Models\DispatchJob;
use Illuminate\Foundation\Http\FormRequest;

final class DispatchDeskIncomingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('viewAny', DispatchJob::class) ?? false;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'page' => ['sometimes', 'integer', 'min:1', 'max:1000000'],
            'focus_service_request_id' => ['sometimes', 'nullable', 'integer', 'min:1'],
        ];
    }

    /** @return array{page: int, focus_service_request_id: int|null} */
    public function filters(): array
    {
        return [
            'page' => (int) $this->validated('page', 1),
            'focus_service_request_id' => $this->validated('focus_service_request_id') === null
                ? null
                : (int) $this->validated('focus_service_request_id'),
        ];
    }
}
