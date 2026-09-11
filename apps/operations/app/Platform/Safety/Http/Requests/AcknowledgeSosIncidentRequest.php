<?php

namespace App\Platform\Safety\Http\Requests;

use App\Platform\Safety\Models\SosIncident;
use Illuminate\Foundation\Http\FormRequest;

final class AcknowledgeSosIncidentRequest extends FormRequest
{
    public function authorize(): bool
    {
        $incident = $this->route('sosIncident');

        return $incident instanceof SosIncident && ($this->user()?->can('respond', $incident) ?? false);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [];
    }
}
