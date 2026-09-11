<?php

namespace App\Modules\Rental\Http\Requests;

use App\Modules\Rental\Enums\RentalOperatorType;
use App\Platform\Identity\Enums\PermissionName;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class AssignRentalOperatorRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can(PermissionName::RentalAssignOperator->value) ?? false;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'rental_reservation_item_id' => ['required', 'integer', 'exists:rental_reservation_items,id'],
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'operator_type' => ['required', Rule::enum(RentalOperatorType::class)],
        ];
    }

    /** @return array{rental_reservation_item_id: int, user_id: int, operator_type: string} */
    public function toAttributes(): array
    {
        return [
            'rental_reservation_item_id' => (int) $this->validated('rental_reservation_item_id'),
            'user_id' => (int) $this->validated('user_id'),
            'operator_type' => (string) $this->validated('operator_type'),
        ];
    }
}
