<?php

namespace App\Http\Requests;

use App\Enums\PermissionName;
use Illuminate\Foundation\Http\FormRequest;

final class AssignDispatchResourcesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can(PermissionName::AssignmentsCreate->value) ?? false;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'personnel' => ['sometimes', 'array'], 'personnel.*.user_id' => ['required', 'integer', 'exists:users,id'],
            'personnel.*.assignment_type' => ['required', 'string', 'in:driver,crane_operator,field_technician'],
            'assets' => ['sometimes', 'array'], 'assets.*.operational_asset_id' => ['required', 'integer', 'exists:operational_assets,id'],
            'assets.*.assignment_type' => ['required', 'string', 'in:truck,crane,equipment'],
        ];
    }
}
