<?php

namespace App\Modules\Assignment\Policies;

use App\Modules\Dispatch\Enums\DispatchAssignmentOfferStatus;
use App\Modules\Dispatch\Models\DispatchAssignmentOffer;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;

final class DispatchAssignmentOfferPolicy
{
    public function respond(User $user, DispatchAssignmentOffer $offer): bool
    {
        return $user->can(PermissionName::DispatchRespondOwn->value)
            && $user->id === $offer->user_id
            && $offer->status === DispatchAssignmentOfferStatus::Offered
            && $offer->workspace_key !== '';
    }

    public function manage(User $user, DispatchAssignmentOffer $offer): bool
    {
        return $user->can(PermissionName::AssignmentsCreate->value)
            || $user->can(PermissionName::AssignmentsReassign->value)
            || $user->can(PermissionName::AssignmentsOverride->value);
    }
}
