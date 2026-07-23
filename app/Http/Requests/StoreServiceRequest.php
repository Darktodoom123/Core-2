<?php

namespace App\Http\Requests;

use App\Enums\DispatchPriority;
use App\Enums\PermissionName;
use Illuminate\Database\Query\Builder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class StoreServiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can(PermissionName::DispatchCreate->value) ?? false;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'reference' => ['required', 'string', 'max:48', 'unique:service_requests,reference'],
            'client_id' => [
                'required',
                'integer',
                Rule::exists('clients', 'id')->where(
                    fn (Builder $query): Builder => $query
                        ->where('status', 'active')
                        ->whereNull('deleted_at'),
                ),
            ],
            'project_name' => ['required', 'string', 'max:255'],
            'service_type' => ['required', 'string', 'max:64'],
            'location' => ['required', 'string', 'max:2000'],
            'site_notes' => ['nullable', 'string', 'max:5000'],
            'scheduled_date' => ['nullable', 'date'],
            'priority' => ['required', Rule::enum(DispatchPriority::class)],
            'requirements' => ['sometimes', 'array'],
            'requirements.*' => ['string', 'max:255'],
        ];
    }
}
