<?php

namespace App\Modules\Rental\Http\Requests;

use App\Platform\Identity\Enums\PermissionName;
use App\Shared\Assets\Enums\AssetStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class StoreRentalReservationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can(PermissionName::RentalCreate->value) ?? false;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'reference' => ['required', 'string', 'max:48', 'unique:rental_reservations,reference'],
            'client_id' => ['required', 'integer', Rule::exists('clients', 'id')->where(fn ($q) => $q->where('status', 'active')->whereNull('deleted_at'))],
            'start_date' => ['required', 'date', 'after_or_equal:today'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'delivery_location' => ['nullable', 'string', 'max:2000'],
            'fulfillment_mode' => ['required', Rule::in(['delivery', 'pickup'])],
            'notes' => ['nullable', 'string', 'max:5000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.operational_asset_id' => ['required', 'integer', Rule::exists('operational_assets', 'id')->where(fn ($q) => $q->whereIn('status', [AssetStatus::Available->value, AssetStatus::ReadyForService->value])->whereNull('deleted_at'))],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.rate_cents' => ['required', 'integer', 'min:0'],
        ];
    }
}
