<?php

namespace App\Modules\Sales\Http\Requests;

use App\Platform\Identity\Enums\PermissionName;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class StoreSalesCatalogItemRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can(PermissionName::SalesCatalogManage->value) ?? false;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'sku' => ['required', 'string', 'max:64', 'unique:sales_catalog_items,sku'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'unit_price_cents' => ['required', 'integer', 'min:0'],
            'quantity_on_hand' => ['required', 'integer', 'min:0'],
            'operational_asset_id' => ['nullable', 'integer', Rule::exists('operational_assets', 'id')->whereNull('deleted_at')],
        ];
    }
}
