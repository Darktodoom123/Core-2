<?php

namespace App\Http\Requests;

use App\Enums\DispatchPriority;
use App\Models\DispatchJob;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class StoreDispatchJobRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('create', DispatchJob::class) ?? false;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'service_request_id' => ['nullable', 'integer', 'exists:service_requests,id'],
            'reference' => ['required', 'string', 'max:40', 'unique:dispatch_jobs,reference'],
            'client' => ['required_without:service_request_id', 'string', 'max:255'], 'title' => ['required_without:service_request_id', 'string', 'max:255'],
            'site' => ['required_without:service_request_id', 'string', 'max:2000'], 'site_notes' => ['nullable', 'string', 'max:5000'],
            'scheduled_start' => ['required', 'date'], 'scheduled_end' => ['required', 'date', 'after:scheduled_start'],
            'priority' => ['required_without:service_request_id', Rule::enum(DispatchPriority::class)], 'requirements' => ['sometimes', 'array'],
            'requirements.*' => ['string', 'max:255'],
        ];
    }
}
