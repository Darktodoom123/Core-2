<?php

namespace App\Platform\Safety\Policies;

use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Platform\Safety\Models\SiteHazardTicket;

final class SiteHazardTicketPolicy
{
    public function view(User $user, SiteHazardTicket $ticket): bool
    {
        return $user->is_active
            && ($user->id === $ticket->reporter_id
                || $user->can(PermissionName::SafetyGovernanceView->value));
    }
}
