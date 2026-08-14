<?php

namespace App\Modules\Dispatch\Policies;

use App\Modules\Dispatch\Enums\ApprovalStatus;
use App\Modules\Dispatch\Models\ApprovalRequest;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;

final class ApprovalRequestPolicy
{
    public function decide(User $user, ApprovalRequest $approval): bool
    {
        if ($approval->status !== ApprovalStatus::Pending || $approval->requested_by === $user->id) {
            return false;
        }

        $permission = match ($approval->kind) {
            'assignment_override' => PermissionName::AssignmentsApprove,
            'reassignment_override' => PermissionName::AssignmentsApprove,
            'dispatch_activation' => PermissionName::DispatchApprovePriority,
            'plan_version', 'plan_approval' => PermissionName::DispatchApproveChange,
            default => null,
        };

        return $permission !== null && $user->can($permission->value);
    }
}
