<?php

namespace App\Modules\Rental\Http\Requests;

use App\Platform\Identity\Enums\PermissionName;
use Illuminate\Foundation\Http\FormRequest;

final class RentalConditionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can($this->routeIs('rental.checkout') ? PermissionName::RentalCheckout->value : PermissionName::RentalReturn->value) ?? false;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'condition' => ['nullable', 'array'],
            'condition.*' => ['string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'damage_notes' => ['nullable', 'string', 'max:5000'],
        ];
    }
}
