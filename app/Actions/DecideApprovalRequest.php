<?php

namespace App\Actions;

use App\Enums\ApprovalStatus;
use App\Models\ApprovalRequest;
use App\Models\DispatchJob;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class DecideApprovalRequest
{
    public function __construct(
        private RecordAuditEvent $audit,
        private ReassignDispatchResources $reassign,
    ) {}

    public function handle(User $actor, ApprovalRequest $approval, ApprovalStatus $status, ?string $reason): ApprovalRequest
    {
        Gate::forUser($actor)->authorize('decide', $approval);

        if ($status === ApprovalStatus::Pending) {
            throw ValidationException::withMessages(['status' => 'Choose approval or rejection.']);
        }

        if ($reason === null || trim($reason) === '') {
            throw ValidationException::withMessages(['reason' => 'A decision reason is required.']);
        }

        return DB::transaction(function () use ($actor, $approval, $status, $reason): ApprovalRequest {
            if ($approval->kind === 'reassignment_override' && $approval->subject_type === DispatchJob::class) {
                DispatchJob::query()->lockForUpdate()->findOrFail($approval->subject_id);
                $approval = ApprovalRequest::query()->lockForUpdate()->findOrFail($approval->id);
                Gate::forUser($actor)->authorize('decide', $approval);

                if ($status === ApprovalStatus::Approved) {
                    $this->reassign->applyApproved($actor, $approval, $reason);
                }
            } else {
                $approval = ApprovalRequest::query()->lockForUpdate()->findOrFail($approval->id);
                Gate::forUser($actor)->authorize('decide', $approval);
            }

            $approval->update(['status' => $status, 'decided_by' => $actor->id, 'reason' => $reason, 'decided_at' => now()]);
            $this->audit->handle($actor, $approval, 'approval.decided', ['status' => ApprovalStatus::Pending->value], ['status' => $status->value], $reason);

            return $approval->refresh();
        });
    }
}
