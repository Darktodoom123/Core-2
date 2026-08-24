<?php

namespace App\Platform\Safety\Http\Requests;

use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Safety\Models\SosIncident;
use Illuminate\Foundation\Http\FormRequest;

final class ClassifySosIncidentRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        $incident = $this->route('sosIncident');
        if (! $user instanceof User) {
            return false;
        }

        return $incident instanceof SosIncident
            && $incident->reporter_id === $user->id
            && in_array($user->operationalRole(), [RoleName::Driver, RoleName::CraneOperator, RoleName::FieldTechnician], true)
            && $user->can(PermissionName::SosTrigger->value);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'category' => ['required', 'string', 'in:vehicular_accident,site_accident,critical_asset_malfunction,other_immediate_danger'],
            'operational_asset_id' => ['nullable', 'integer'],
        ];
    }
}
