<?php

namespace App\Modules\Dispatch\Planning\Http;

use App\Modules\Dispatch\Planning\Services\PlanningAccess;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class PlanningRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user !== null && (in_array($this->planningAction(), ['decision', 'shift-decision'], true)
            ? PlanningAccess::approve($user) : PlanningAccess::edit($user));
    }

    private function planningAction(): string
    {
        return match ($this->route()->getActionMethod()) {
            'store' => 'create',
            'preview' => 'allocation',
            'shiftDecision' => 'shift-decision',
            default => $this->route()->getActionMethod(),
        };
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $version = ['version' => ['required', 'integer', 'min:1']];
        $window = ['starts_at' => ['required', 'date'], 'ends_at' => ['required', 'date', 'after:starts_at']];
        $decision = ['decision' => ['required', Rule::in(['approved', 'rejected'])], 'reason' => ['required', 'string', 'max:2000']];

        return match ($this->planningAction()) {
            'create' => ['name' => ['required', 'string', 'max:255'], 'source_reference' => ['required', 'string', 'max:150', 'unique:dispatch_project_plans'], 'client' => ['required', 'string', 'max:255'], 'site' => ['required', 'string', 'max:255']],
            'phase' => [...$version, ...$window, 'name' => ['required', 'string', 'max:255'], 'kind' => ['required', Rule::in(['mobilization', 'operations', 'standby', 'demobilization'])], 'coverage' => ['required', 'array:driver,crane_operator,rigger'], 'coverage.driver' => ['required', 'integer', 'between:0,50'], 'coverage.crane_operator' => ['required', 'integer', 'between:0,50'], 'coverage.rigger' => ['required', 'integer', 'between:0,50']],
            'allocation' => [...$version, ...$window, 'operational_asset_id' => ['required', 'integer', 'exists:operational_assets,id'], 'kind' => ['required', Rule::in(['reservation', 'maintenance'])], 'notes' => ['nullable', 'string', 'max:2000']],
            'shifts' => [...$version, ...$window, 'days' => ['required', 'integer', 'between:1,7']],
            'roster' => [...$version, 'shift_version' => ['required', 'integer', 'min:1'], 'personnel' => ['present', 'array', 'max:150'], 'personnel.*' => ['array:user_id,assignment_type'], 'personnel.*.user_id' => ['required', 'integer', 'distinct', 'exists:users,id'], 'personnel.*.assignment_type' => ['required', Rule::in(['driver', 'crane_operator', 'rigger'])], 'reason' => ['required', 'string', 'max:2000']],
            'decision' => [...$version, ...$decision],
            'shift-decision' => [...$version, ...$decision, 'shift_version' => ['required', 'integer', 'min:1']],
            default => $version,
        };
    }
}
