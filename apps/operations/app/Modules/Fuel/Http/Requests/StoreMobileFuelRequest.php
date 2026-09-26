<?php

namespace App\Modules\Fuel\Http\Requests;

use App\Modules\Fuel\Models\FuelRequest;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

final class StoreMobileFuelRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('create', FuelRequest::class) ?? false;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'client_request_id' => ['required', 'uuid'],
            ...FuelRequestContextRules::requestDetails(),
            'operational_asset_id' => ['nullable', 'integer'],
            'dispatch_job_id' => ['nullable', 'integer'],
            'operator_shift_id' => ['nullable', 'integer'],
        ];
    }

    /** @return array<\Closure(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }
            $actor = $this->user();
            // A previously accepted submission remains replayable after reassignment.
            // The action still compares every normalized field with its stored hash.
            if (FuelRequest::query()->where('requester_id', $actor->id)->where('client_request_id', $this->string('client_request_id')->toString())->exists()) {
                return;
            }
            FuelRequestContextRules::validateAssignmentScope($this, $validator, $actor);
        }];
    }
}
