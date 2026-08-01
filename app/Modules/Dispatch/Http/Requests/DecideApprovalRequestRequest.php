<?php

namespace App\Modules\Dispatch\Http\Requests;

use App\Modules\Dispatch\Enums\ApprovalStatus;
use App\Modules\Dispatch\Models\ApprovalRequest;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

final class DecideApprovalRequestRequest extends FormRequest
{
    public function authorize(): bool
    {
        $approval = $this->route('approvalRequest');

        return $approval instanceof ApprovalRequest
            && Gate::forUser($this->user())->allows('decide', $approval);
    }

    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        return [
            'status' => [
                'required',
                Rule::enum(ApprovalStatus::class)->only([
                    ApprovalStatus::Approved,
                    ApprovalStatus::Rejected,
                ]),
            ],
            'reason' => ['required', 'string', 'max:2000'],
        ];
    }
}
