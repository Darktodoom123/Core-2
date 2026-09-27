<?php

namespace App\Modules\Dispatch\Http\Requests;

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\ServiceRequestStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use Illuminate\Database\Query\Builder;
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
        $linkedToServiceRequest = $this->filled('service_request_id');

        return [
            'service_request_id' => [
                'nullable',
                'integer',
                Rule::exists('service_requests', 'id')->where(
                    fn (Builder $query): Builder => $query
                        ->whereIn('status', [
                            ServiceRequestStatus::Submitted->value,
                            ServiceRequestStatus::Dispatching->value,
                        ])
                        ->whereNull('deleted_at'),
                ),
            ],
            'reference' => [
                Rule::requiredIf($linkedToServiceRequest),
                'nullable',
                'string',
                'max:40',
                'unique:dispatch_jobs,reference',
            ],
            'client' => [Rule::prohibitedIf($linkedToServiceRequest), 'required_without:service_request_id', 'string', 'max:255'],
            'title' => [Rule::prohibitedIf($linkedToServiceRequest), 'required_without:service_request_id', 'string', 'max:255'],
            'site' => [Rule::prohibitedIf($linkedToServiceRequest), 'required_without:service_request_id', 'string', 'max:2000'],
            'site_notes' => [Rule::prohibitedIf($linkedToServiceRequest), 'nullable', 'string', 'max:5000'],
            'scheduled_start' => ['required', 'date'],
            'scheduled_end' => ['required', 'date', 'after:scheduled_start'],
            'priority' => [Rule::prohibitedIf($linkedToServiceRequest), 'required_without:service_request_id', Rule::enum(DispatchPriority::class)],
            'work_stream' => ['nullable', 'string', Rule::in(['service', 'rental', 'general'])],
            'equipment_subtype' => ['nullable', 'string', 'max:50'],
            'requirements' => [Rule::prohibitedIf($linkedToServiceRequest), 'sometimes', 'array'],
            'requirements.*' => ['string', 'max:255'],
            'resource_requirements' => [Rule::prohibitedIf($linkedToServiceRequest), 'sometimes', 'array:personnel,assets'],
            'resource_requirements.personnel' => ['sometimes', 'array:driver,crane_operator,rigger'],
            'resource_requirements.assets' => ['sometimes', 'array:truck,vehicle,crane,mobile_crane,tower_crane,equipment'],
            'resource_requirements.personnel.*' => ['integer', 'min:0', 'max:50'],
            'resource_requirements.assets.*' => ['integer', 'min:0', 'max:50'],
        ];
    }
}
