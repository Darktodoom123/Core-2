<?php

namespace App\Modules\Rental\Http\Requests;

use App\Modules\Rental\Enums\RentalReservationStatus;
use App\Modules\Rental\Models\RentalReservation;
use App\Platform\Identity\Enums\PermissionName;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class SubmitRentalHandoverRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        if ($user === null || ! $user->is_active) {
            return false;
        }

        /** @var RentalReservation|null $reservation */
        $reservation = $this->route('rentalReservation');
        if (! $reservation instanceof RentalReservation) {
            return false;
        }

        // Managerial roles can submit evidence
        if (
            $user->can(PermissionName::RentalCheckout->value)
            || $user->can(PermissionName::RentalReturn->value)
            || $user->can(PermissionName::RentalApprove->value)
            || $user->can(PermissionName::DispatchUpdate->value)
        ) {
            return true;
        }

        // Operator roles require an active assignment boundary on this rental or linked dispatch job
        if (
            $user->can(PermissionName::RentalOperate->value)
            || $user->can(PermissionName::DispatchUpdateOwnStatus->value)
        ) {
            if ($reservation->operatorAssignments()->where('user_id', $user->id)->exists()) {
                return true;
            }

            if ($reservation->dispatchJob !== null) {
                return $reservation->dispatchJob->personnelAssignments()->open()->where('user_id', $user->id)->exists();
            }
        }

        return false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'dispatch_job_id' => ['nullable', 'integer', 'exists:dispatch_jobs,id'],
            'operational_asset_id' => ['nullable', 'integer', 'exists:operational_assets,id'],
            'handover_type' => ['sometimes', 'string', 'in:checkout,return'],
            'hour_meter' => ['required', 'numeric', 'min:0'],
            'fuel_percent' => ['required', 'integer', 'min:0', 'max:100'],
            'condition_assessment' => ['nullable', 'string', 'in:excellent,good,fair,poor'],
            'condition_notes' => ['nullable', 'string', 'max:5000'],
            'damage_noted' => ['nullable', 'boolean'],
            'damage_notes' => ['nullable', 'string', 'max:5000'],
            'photos' => ['nullable', 'array', 'max:10'],
            'photos.*.base64' => ['nullable', 'string'],
            'photos.*.file_path' => ['nullable', 'string'],
            'photos.*.label' => ['nullable', 'string', 'max:100'],
            'signature_base64' => ['nullable', 'string'],
            'signee_name' => ['required', 'string', 'max:255'],
            'signee_role' => ['nullable', 'string', 'max:255'],
            'command_id' => ['nullable', 'uuid'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v): void {
            /** @var RentalReservation|null $reservation */
            $reservation = $this->route('rentalReservation');
            if (! $reservation instanceof RentalReservation) {
                return;
            }

            $handoverType = $this->input('handover_type', $this->routeIs('*checkout*') ? 'checkout' : 'return');

            if ($handoverType === 'checkout' && $reservation->status !== RentalReservationStatus::Reserved) {
                $v->errors()->add('status', 'Only reserved rentals can accept checkout handover evidence.');
            } elseif ($handoverType === 'return' && $reservation->status !== RentalReservationStatus::CheckedOut) {
                $v->errors()->add('status', 'Only checked-out rentals can accept return handover evidence.');
            }

            if ($this->filled('dispatch_job_id') && $reservation->dispatch_job_id !== null) {
                if ((int) $this->input('dispatch_job_id') !== (int) $reservation->dispatch_job_id) {
                    $v->errors()->add('dispatch_job_id', 'The provided dispatch job ID does not match this rental reservation.');
                }
            }

            if ($this->filled('operational_asset_id')) {
                $assetId = (int) $this->input('operational_asset_id');
                $isReservedAsset = $reservation->items()->where('operational_asset_id', $assetId)->exists();
                if (! $isReservedAsset) {
                    $v->errors()->add('operational_asset_id', 'The selected asset is not part of this rental reservation.');
                }
            }
        });
    }
}
