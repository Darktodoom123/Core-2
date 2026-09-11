<?php

namespace App\Modules\Sales\Http\Requests;

use App\Platform\Identity\Enums\PermissionName;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Support\PersistedInteger;
use Illuminate\Contracts\Validation\Validator;
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
            'unit_price_cents' => ['required', 'integer', 'min:0', 'max:'.PersistedInteger::MAX],
            'quantity_on_hand' => ['required', 'integer', 'min:0', 'max:'.PersistedInteger::MAX],
            'operational_asset_id' => ['nullable', 'integer', Rule::exists('operational_assets', 'id')->where(fn ($query) => $query->whereIn('status', [AssetStatus::Available->value, AssetStatus::ReadyForService->value])->whereNull('deleted_at'))],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($this->filled('operational_asset_id') && (int) $this->input('quantity_on_hand') !== 1) {
                $validator->errors()->add('quantity_on_hand', 'A catalog entry linked to a physical unit must have exactly one unit in stock.');
            }
        });
    }
}
