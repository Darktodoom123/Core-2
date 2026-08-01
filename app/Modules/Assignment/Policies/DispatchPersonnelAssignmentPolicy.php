<?php

namespace App\Modules\Assignment\Policies;

use App\Modules\Assignment\Enums\AssignmentResponse;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;

final class DispatchPersonnelAssignmentPolicy
{
    public function respond(User $user, DispatchPersonnelAssignment $assignment): bool
    {
        return $user->can(PermissionName::DispatchRespondOwn->value)
            && $user->id === $assignment->user_id
            && ($assignment->active_until === null || $assignment->active_until->gt(now()))
            && $assignment->response_status === AssignmentResponse::Pending;
    }
}
