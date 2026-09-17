<?php

namespace App\Modules\Sales\Http\Requests;

use App\Modules\Sales\Enums\SalesOrderStatus;
use App\Modules\Sales\Models\SalesOrder;
use App\Platform\Identity\Enums\PermissionName;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class SubmitSalesDeliveryRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        if ($user === null || ! $user->is_active) {
            return false;
        }

        /** @var SalesOrder|null $order */
        $order = $this->route('salesOrder');
        if (! $order instanceof SalesOrder) {
            return false;
        }

        // Managerial roles can submit evidence
        if (
            $user->can(PermissionName::SalesFulfill->value)
            || $user->can(PermissionName::DispatchUpdate->value)
        ) {
            return true;
        }

        // Operator roles require DispatchUpdateOwnStatus AND an active assignment boundary
        if ($user->can(PermissionName::DispatchUpdateOwnStatus->value)) {
            if ($order->dispatchJob !== null) {
                return $order->dispatchJob->personnelAssignments()->open()->where('user_id', $user->id)->exists();
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
            'verified_vin' => ['required', 'string', 'max:64'],
            'accessories_checked' => ['nullable', 'array'],
            'accessories_checked.*' => ['string', 'max:100'],
            'delivery_notes' => ['nullable', 'string', 'max:5000'],
            'photos' => ['nullable', 'array', 'max:10'],
            'photos.*.base64' => ['nullable', 'string'],
            'photos.*.file_path' => ['nullable', 'string'],
            'photos.*.label' => ['nullable', 'string', 'max:100'],
            'signature_base64' => ['nullable', 'string'],
            'signee_name' => ['required', 'string', 'max:255'],
            'signee_role' => ['required', 'string', 'max:255'],
            'command_id' => ['nullable', 'uuid'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v): void {
            /** @var SalesOrder|null $order */
            $order = $this->route('salesOrder');
            if (! $order instanceof SalesOrder) {
                return;
            }

            if ($order->status !== SalesOrderStatus::Confirmed) {
                $v->errors()->add('status', 'Only confirmed sales orders can accept delivery evidence.');
            }

            if ($this->filled('dispatch_job_id') && $order->dispatch_job_id !== null) {
                if ((int) $this->input('dispatch_job_id') !== (int) $order->dispatch_job_id) {
                    $v->errors()->add('dispatch_job_id', 'The provided dispatch job ID does not match this sales order.');
                }
            }
        });
    }
}
