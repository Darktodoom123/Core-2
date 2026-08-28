<?php

namespace App\Platform\Safety\Http\Requests;

use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

final class TriggerSosIncidentRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if (! $this->filled('command_id') && $this->header('Idempotency-Key') !== null) {
            $this->merge(['command_id' => $this->header('Idempotency-Key')]);
        }

        if (! $this->filled('worker_note') && $this->filled('note')) {
            $this->merge(['worker_note' => $this->input('note')]);
        }

        $location = $this->input('location');
        if (is_array($location)) {
            $this->merge([
                'latitude' => $location['latitude'] ?? $this->input('latitude'),
                'longitude' => $location['longitude'] ?? $this->input('longitude'),
                'accuracy_metres' => $location['accuracy_metres'] ?? $this->input('accuracy_metres'),
            ]);
        }

        $this->merge(['category' => $this->input('category', 'unclassified')]);
    }

    public function authorize(): bool
    {
        $user = $this->user();
        if (! $user instanceof User) {
            return false;
        }

        return $user->operationalRole() === RoleName::CraneOperator
            && $user->can(PermissionName::SosTrigger->value);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'command_id' => ['required', 'uuid'],
            'category' => ['required', 'string', 'in:unclassified,vehicular_accident,site_accident,critical_asset_malfunction,other_immediate_danger'],
            'worker_note' => ['nullable', 'string', 'max:2000'],
            'dispatch_job_id' => ['nullable', 'integer'],
            'operational_asset_id' => ['nullable', 'integer'],
            'device_activated_at' => ['nullable', 'date', 'before_or_equal:now'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'accuracy_metres' => ['nullable', 'numeric', 'min:0', 'max:10000'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $latitude = $this->input('latitude');
            $longitude = $this->input('longitude');
            if (($latitude === null) !== ($longitude === null)) {
                $validator->errors()->add('location', 'Latitude and longitude must be supplied together.');
            }
        });
    }
}
