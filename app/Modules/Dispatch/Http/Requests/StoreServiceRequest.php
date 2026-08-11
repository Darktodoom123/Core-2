<?php

namespace App\Modules\Dispatch\Http\Requests;

use App\Modules\Dispatch\Enums\BusinessLine;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Platform\Identity\Enums\PermissionName;
use Illuminate\Contracts\Validation\Validator;
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
            'business_line' => ['nullable', Rule::enum(BusinessLine::class)],
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

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $line = $this->input('business_line', BusinessLine::Service->value);
            if ($line !== BusinessLine::Service->value) {
                $validator->errors()->add('business_line', 'Rental and sales intake use their dedicated reservation or quote endpoints.');
            }
        });
    }
}
