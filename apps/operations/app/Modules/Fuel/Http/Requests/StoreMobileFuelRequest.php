<?php

namespace App\Modules\Fuel\Http\Requests;

use App\Modules\Fuel\Actions\MobileFuelContexts;
use App\Modules\Fuel\Models\FuelRequest;
use App\Modules\HoursOfService\Models\OperatorShift;
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
            'quantity_litres' => ['required', 'numeric', 'min:0.01', 'max:100000'],
            'fuel_type' => ['required', 'in:diesel,gasoline'],
            'purpose' => ['required', 'string', 'max:2000'],
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
            $contexts = app(MobileFuelContexts::class);
            $actor = $this->user();
            // A previously accepted submission remains replayable after reassignment.
            // The action still compares every normalized field with its stored hash.
            if (FuelRequest::query()->where('requester_id', $actor->id)->where('client_request_id', $this->string('client_request_id')->toString())->exists()) {
                return;
            }
            if ($this->filled('operational_asset_id') && ! $contexts->assets($actor)->whereKey($this->integer('operational_asset_id'))->exists()) {
                $validator->errors()->add('operational_asset_id', 'Choose an asset assigned to you.');
            }
            $job = $this->filled('dispatch_job_id') ? $contexts->jobs($actor)->find($this->integer('dispatch_job_id')) : null;
            if ($this->filled('dispatch_job_id') && $job === null) {
                $validator->errors()->add('dispatch_job_id', 'Choose a job assigned to you.');
            }
            if ($job && $this->filled('operational_asset_id') && ! $job->assetAssignments()->active()->where('operational_asset_id', $this->integer('operational_asset_id'))->exists()) {
                $validator->errors()->add('operational_asset_id', 'The asset must belong to the selected job.');
            }
            if ($this->filled('operator_shift_id')) {
                $shift = OperatorShift::query()->where('user_id', $actor->id)->find($this->integer('operator_shift_id'));
                if ($shift === null || ($this->filled('operational_asset_id') && $shift->operational_asset_id !== $this->integer('operational_asset_id')) || ($this->filled('dispatch_job_id') && $shift->dispatch_job_id !== $this->integer('dispatch_job_id'))) {
                    $validator->errors()->add('operator_shift_id', 'Choose your matching shift.');
                }
            }
        }];
    }
}
