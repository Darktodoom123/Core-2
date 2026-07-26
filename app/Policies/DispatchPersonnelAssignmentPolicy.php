<?php

namespace App\Policies;

use App\Enums\AssignmentResponse;
use App\Enums\PermissionName;
use App\Models\DispatchPersonnelAssignment;
use App\Models\User;

final class DispatchPersonnelAssignmentPolicy
{
    public function respond(User $user, DispatchPersonnelAssignment $assignment): bool
    {
        return $user->can(PermissionName::DispatchRespondOwn->value)
            && $user->id === $assignment->user_id
            && $assignment->active_until === null
            && $assignment->response_status === AssignmentResponse::Pending;
    }
}
