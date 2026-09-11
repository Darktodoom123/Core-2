<?php

namespace App\Platform\Safety\Http\Requests;

use App\Platform\Safety\Models\SosIncident;
use Illuminate\Foundation\Http\FormRequest;

final class ResolveSosIncidentRequest extends FormRequest
{
    public function authorize(): bool
    {
        $incident = $this->route('sosIncident');

        return $incident instanceof SosIncident && ($this->user()?->can('respond', $incident) ?? false);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'resolution_code' => ['required', 'string', 'in:worker_safe,medical_assistance,emergency_services_contacted,asset_secured,other'],
            'resolution_notes' => ['required', 'string', 'max:2000'],
        ];
    }
}
