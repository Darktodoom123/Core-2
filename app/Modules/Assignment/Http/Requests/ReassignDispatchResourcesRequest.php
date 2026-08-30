<?php

namespace App\Modules\Assignment\Http\Requests;

use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Enums\PermissionName;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

final class ReassignDispatchResourcesRequest extends FormRequest
{
    public function authorize(): bool
    {
        $job = $this->route('dispatchJob');

        return $job instanceof DispatchJob
            && $this->user()?->can(PermissionName::AssignmentsReassign->value)
            && Gate::forUser($this->user())->allows('reassignResources', $job);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'end_personnel_assignment_ids' => ['sometimes', 'array'],
            'end_personnel_assignment_ids.*' => ['integer', 'distinct', 'exists:dispatch_personnel_assignments,id'],
            'end_asset_assignment_ids' => ['sometimes', 'array'],
            'end_asset_assignment_ids.*' => ['integer', 'distinct', 'exists:dispatch_asset_assignments,id'],
            'personnel' => ['sometimes', 'array'],
            'personnel.*.user_id' => ['required', 'integer', 'distinct', 'exists:users,id'],
            'personnel.*.assignment_type' => ['required', 'string', Rule::in(['driver', 'crane_operator', 'rigger'])],
            'assets' => ['sometimes', 'array'],
            'assets.*.operational_asset_id' => ['required', 'integer', 'distinct', 'exists:operational_assets,id'],
            'assets.*.assignment_type' => ['required', 'string', Rule::in(['truck', 'crane', 'mobile_crane', 'equipment'])],
            'reason' => ['nullable', 'string', 'max:1000'],
            'version' => ['required', 'integer', 'min:1'],
        ];
    }
}
