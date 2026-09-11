<?php

namespace App\Platform\Safety\Http\Requests;

use App\Platform\Safety\Models\SosIncident;
use Illuminate\Foundation\Http\FormRequest;

final class UpdateSosIncidentLocationRequest extends FormRequest
{
    public function authorize(): bool
    {
        $incident = $this->route('sosIncident');

        return $incident instanceof SosIncident && ($this->user()?->can('updateLocation', $incident) ?? false);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'accuracy_metres' => ['nullable', 'numeric', 'min:0', 'max:10000'],
        ];
    }
}
