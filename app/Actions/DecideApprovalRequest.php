<?php

namespace App\Actions;

use App\Enums\ApprovalStatus;
use App\Enums\PermissionName;
use App\Models\ApprovalRequest;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;

final class DecideApprovalRequest
{
    public function __construct(private RecordAuditEvent $audit) {}

    public function handle(User $actor, ApprovalRequest $approval, ApprovalStatus $status, ?string $reason): ApprovalRequest
    {
        $permission = $approval->kind === 'assignment_override' ? PermissionName::AssignmentsApprove : PermissionName::DispatchApprovePriority;
        if (! $actor->can($permission->value) || $approval->requested_by === $actor->id || $approval->status !== ApprovalStatus::Pending) {
            throw new AuthorizationException('This approval requires an independent Operations Manager.');
        }

        return DB::transaction(function () use ($actor, $approval, $status, $reason): ApprovalRequest {
            $approval = ApprovalRequest::query()->lockForUpdate()->findOrFail($approval->id);
            $approval->update(['status' => $status, 'decided_by' => $actor->id, 'reason' => $reason, 'decided_at' => now()]);
            $this->audit->handle($actor, $approval, 'approval.decided', ['status' => ApprovalStatus::Pending->value], ['status' => $status->value], $reason);

            return $approval->refresh();
        });
    }
}
