<?php

namespace App\Platform\Tracking\Http\Requests;

use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Tracking\Validation\LocationSampleRules;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

final class StoreLocationUpdateRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $this->replace(LocationSampleRules::normalize($this->user(), $this->all()));
    }

    public function authorize(): bool
    {
        return $this->user()?->can(PermissionName::TrackingShareOwn->value) ?? false;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return LocationSampleRules::rules();
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            LocationSampleRules::after($validator, $this->user(), $this->all());
        });
    }
}
