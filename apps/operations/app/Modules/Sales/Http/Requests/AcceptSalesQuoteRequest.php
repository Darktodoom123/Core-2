<?php

namespace App\Modules\Sales\Http\Requests;

use App\Modules\Sales\Enums\SalesFulfillmentMode;
use App\Platform\Identity\Enums\PermissionName;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class AcceptSalesQuoteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can(PermissionName::SalesApproveOrder->value) ?? false;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'fulfillment_mode' => ['sometimes', Rule::enum(SalesFulfillmentMode::class)],
            'delivery_location' => [
                'nullable',
                'string',
                'max:2000',
                'required_if:fulfillment_mode,delivery',
                'prohibited_if:fulfillment_mode,pickup',
            ],
        ];
    }

    /** @return array{fulfillment_mode?: string, delivery_location?: string|null} */
    public function fulfillmentAttributes(): array
    {
        return $this->validated();
    }
}
