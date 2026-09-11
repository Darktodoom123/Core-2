<?php

namespace App\Modules\Fuel\Http\Requests;

use App\Modules\Fuel\Models\FuelRequest;
use App\Platform\Attachments\Services\AttachmentFilePolicy;
use App\Platform\Identity\Enums\PermissionName;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

final class StoreMobileFuelLog extends FormRequest
{
    public function authorize(): bool
    {
        $fuel = $this->route('fuelRequest');
        $actor = $this->user();

        return $fuel instanceof FuelRequest && $actor !== null
            && $actor->can('view', $fuel) && $actor->can(PermissionName::FuelRecord->value)
            && ($fuel->requester_id === $actor->id || $actor->can(PermissionName::FuelViewAll->value));
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'quantity_litres' => ['required', 'numeric', 'min:0.01', 'max:100000'],
            'odometer_km' => ['nullable', 'integer', 'min:0', 'max:2147483647'],
            'hour_meter' => ['nullable', 'numeric', 'min:0', 'max:99999999'],
            'price_per_litre' => ['nullable', 'numeric', 'min:0', 'max:999999'],
            'total_cost' => ['nullable', 'numeric', 'min:0', 'max:99999999'],
            'fuel_station' => ['nullable', 'string', 'max:255'],
            'remarks' => ['nullable', 'string', 'max:2000'],
            'receipt' => ['nullable', 'file', 'max:15360'],
            'receipt_path' => ['prohibited'],
        ];
    }

    /** @return array<\Closure(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty() || ! $this->hasFile('receipt')) {
                return;
            }
            try {
                AttachmentFilePolicy::validate($this->file('receipt'));
            } catch (\InvalidArgumentException $exception) {
                $validator->errors()->add('receipt', $exception->getMessage());
            }
        }];
    }
}
