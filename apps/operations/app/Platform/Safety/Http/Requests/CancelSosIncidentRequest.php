<?php

namespace App\Platform\Safety\Http\Requests;

use App\Platform\Safety\Models\SosIncident;
use Illuminate\Foundation\Http\FormRequest;

final class CancelSosIncidentRequest extends FormRequest
{
    public function authorize(): bool
    {
        $incident = $this->route('sosIncident');

        return $incident instanceof SosIncident && ($this->user()?->can('cancel', $incident) ?? false);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return ['cancellation_reason' => ['required', 'string', 'max:1000']];
    }
}
