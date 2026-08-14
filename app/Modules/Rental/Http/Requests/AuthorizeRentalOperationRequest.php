<?php

namespace App\Modules\Rental\Http\Requests;

use App\Platform\Identity\Enums\PermissionName;
use Illuminate\Foundation\Http\FormRequest;

final class AuthorizeRentalOperationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can(PermissionName::RentalOperate->value) ?? false;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'operational_asset_id' => ['required', 'integer', 'exists:operational_assets,id'],
        ];
    }
}
