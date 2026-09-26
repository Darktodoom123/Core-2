<?php

namespace App\Modules\Fuel\Http\Requests;

use App\Modules\Fuel\Actions\MobileFuelContexts;
use App\Modules\Fuel\Enums\FuelUrgency;
use App\Modules\HoursOfService\Models\OperatorShift;
use App\Platform\Identity\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/** Field rules and assignment scoping shared by the web and mobile request forms. */
final class FuelRequestContextRules
{
    /** @return array<string, mixed> */
    public static function requestDetails(): array
    {
        return [
            'quantity_litres' => ['required', 'numeric', 'min:0.01', 'max:100000'],
            'fuel_type' => ['required', 'string', 'in:diesel,gasoline'],
            'purpose' => ['required', 'string', 'max:2000'],
            'urgency' => ['nullable', Rule::enum(FuelUrgency::class)],
            'needed_by' => ['nullable', 'date', 'before:+30 days'],
            'current_fuel_level_percent' => ['nullable', 'integer', 'min:0', 'max:100'],
        ];
    }

    /**
     * Operators may only reference their own active assignments; fuel.view_all
     * holders are scoped to everything by MobileFuelContexts.
     */
    public static function validateAssignmentScope(FormRequest $request, Validator $validator, User $actor): void
    {
        $contexts = app(MobileFuelContexts::class);

        if ($request->filled('operational_asset_id') && ! $contexts->assets($actor)->whereKey($request->integer('operational_asset_id'))->exists()) {
            $validator->errors()->add('operational_asset_id', 'Choose an asset assigned to you.');
        }

        $job = $request->filled('dispatch_job_id') ? $contexts->jobs($actor)->find($request->integer('dispatch_job_id')) : null;

        if ($request->filled('dispatch_job_id') && $job === null) {
            $validator->errors()->add('dispatch_job_id', 'Choose a job assigned to you.');
        }

        if ($job && $request->filled('operational_asset_id') && ! $job->assetAssignments()->active()->where('operational_asset_id', $request->integer('operational_asset_id'))->exists()) {
            $validator->errors()->add('operational_asset_id', 'The asset must belong to the selected job.');
        }

        if ($request->filled('operator_shift_id')) {
            $shift = OperatorShift::query()->where('user_id', $actor->id)->find($request->integer('operator_shift_id'));

            if ($shift === null || ($request->filled('operational_asset_id') && $shift->operational_asset_id !== $request->integer('operational_asset_id')) || ($request->filled('dispatch_job_id') && $shift->dispatch_job_id !== $request->integer('dispatch_job_id'))) {
                $validator->errors()->add('operator_shift_id', 'Choose your matching shift.');
            }
        }
    }
}
