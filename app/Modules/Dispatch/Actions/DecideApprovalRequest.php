<?php

namespace App\Modules\Dispatch\Actions;

use App\Modules\Assignment\Actions\ReassignDispatchResources;
use App\Modules\Dispatch\Enums\ApprovalStatus;
use App\Modules\Dispatch\Models\ApprovalRequest;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class DecideApprovalRequest
{
    public function __construct(
        private RecordAuditEvent $audit,
        private ReassignDispatchResources $reassign,
        private ActivateDispatchJob $activate,
    ) {}

    public function handle(
        User $actor,
        ApprovalRequest $approval,
        ApprovalStatus $status,
        ?string $reason,
        bool $activateOnApproval = false,
    ): ApprovalRequest {
        Gate::forUser($actor)->authorize('decide', $approval);

        if ($status === ApprovalStatus::Pending) {
            throw ValidationException::withMessages(['status' => 'Choose approval or rejection.']);
        }

        if ($reason === null || trim($reason) === '') {
            throw ValidationException::withMessages(['reason' => 'A decision reason is required.']);
        }

        return DB::transaction(function () use ($actor, $approval, $status, $reason, $activateOnApproval): ApprovalRequest {
            if ($approval->kind === 'reassignment_override' && $approval->subject_type === (new DispatchJob)->getMorphClass()) {
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

            if ($status === ApprovalStatus::Approved && $activateOnApproval && in_array($approval->kind, [
                'dispatch_activation',
                'assignment_override',
                'reassignment_override',
                'plan_version',
                'plan_approval',
            ], true)) {
                $subject = $approval->subject;
                if ($subject instanceof DispatchJob) {
                    $this->activate->handle($actor, $subject, $subject->version);
                }
            }

            return $approval->refresh();
        });
    }
}
