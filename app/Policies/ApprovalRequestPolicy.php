<?php

namespace App\Policies;

use App\Enums\ApprovalStatus;
use App\Enums\PermissionName;
use App\Models\ApprovalRequest;
use App\Models\User;

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
            default => null,
        };

        return $permission !== null && $user->can($permission->value);
    }
}
