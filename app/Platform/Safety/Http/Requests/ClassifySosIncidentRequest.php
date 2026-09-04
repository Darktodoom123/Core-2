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
            && $user->operationalRole() === RoleName::CraneOperator
            && $user->can(PermissionName::SosTrigger->value);
    }

    protected function prepareForValidation(): void
    {
        if (! $this->filled('worker_note') && $this->filled('note')) {
            $this->merge(['worker_note' => $this->input('note')]);
        }
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'category' => ['required', 'string', 'in:vehicular_accident,site_accident,critical_asset_malfunction,other_immediate_danger'],
            'operational_asset_id' => ['nullable', 'integer'],
            'worker_note' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
