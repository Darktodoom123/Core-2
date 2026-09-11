<?php

namespace App\Platform\Safety\Http\Requests;

use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use Illuminate\Foundation\Http\FormRequest;

final class StoreSosEmergencyContactRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user instanceof User
            && $user->operationalRole() === RoleName::SystemAdministrator
            && $user->can(PermissionName::SosConfigure->value);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:160'],
            'role_label' => ['required', 'string', 'max:120'],
            'phone_e164' => ['required', 'string', 'regex:/^\+[1-9]\d{7,14}$/'],
            'escalation_order' => ['required', 'integer', 'min:1', 'max:1000'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
