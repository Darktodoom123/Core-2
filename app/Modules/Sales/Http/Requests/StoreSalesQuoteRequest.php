<?php

namespace App\Modules\Sales\Http\Requests;

use App\Platform\Identity\Enums\PermissionName;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class StoreSalesQuoteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can(PermissionName::SalesCreateQuote->value) ?? false;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'reference' => ['required', 'string', 'max:48', 'unique:sales_quotes,reference'],
            'client_id' => ['required', 'integer', Rule::exists('clients', 'id')->where(fn ($q) => $q->where('status', 'active')->whereNull('deleted_at'))],
            'currency' => ['sometimes', 'string', 'size:3'],
            'valid_until' => ['nullable', 'date', 'after_or_equal:today'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.sales_catalog_item_id' => ['required', 'integer', Rule::exists('sales_catalog_items', 'id')->where(fn ($q) => $q->where('status', 'active'))],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
        ];
    }
}
