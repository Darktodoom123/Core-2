<?php

namespace App\Modules\Assignment\Http\Requests;

use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Enums\PermissionName;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

final class AssignDispatchResourcesRequest extends FormRequest
{
    public function authorize(): bool
    {
        $job = $this->route('dispatchJob');

        return $job instanceof DispatchJob
            && $this->user()?->can(PermissionName::AssignmentsCreate->value)
            && Gate::forUser($this->user())->allows('assignResources', $job);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'personnel' => ['required_without:assets', 'array'],
            'personnel.*.user_id' => ['required', 'integer', 'distinct', 'exists:users,id'],
            'personnel.*.assignment_type' => ['required', 'string', Rule::in(['driver', 'crane_operator', 'field_technician'])],
            'assets' => ['required_without:personnel', 'array'],
            'assets.*.operational_asset_id' => ['required', 'integer', 'distinct', 'exists:operational_assets,id'],
            'assets.*.assignment_type' => ['required', 'string', Rule::in(['truck', 'crane', 'equipment'])],
        ];
    }
}
