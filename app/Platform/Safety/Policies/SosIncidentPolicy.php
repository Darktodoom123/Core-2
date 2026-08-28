<?php

namespace App\Platform\Safety\Policies;

use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Safety\Models\SosIncident;

final class SosIncidentPolicy
{
    public function trigger(User $user): bool
    {
        return $user->operationalRole() === RoleName::CraneOperator
            && $user->can(PermissionName::SosTrigger->value);
    }

    public function viewAny(User $user): bool
    {
        return $user->can(PermissionName::SosView->value);
    }

    public function view(User $user, SosIncident $incident): bool
    {
        return $incident->reporter_id === $user->id
            || $user->can(PermissionName::SosView->value);
    }

    public function respond(User $user, SosIncident $incident): bool
    {
        return $user->operationalRole() === RoleName::OperationsManager
            && $user->can(PermissionName::SosRespond->value)
            && $this->view($user, $incident);
    }

    public function classify(User $user, SosIncident $incident): bool
    {
        return $incident->reporter_id === $user->id && $this->trigger($user);
    }

    public function updateLocation(User $user, SosIncident $incident): bool
    {
        return $incident->reporter_id === $user->id && $this->trigger($user);
    }

    public function cancel(User $user, SosIncident $incident): bool
    {
        return $incident->reporter_id === $user->id || $this->respond($user, $incident);
    }

    public function configure(User $user): bool
    {
        return $user->can(PermissionName::SosConfigure->value)
            && $user->operationalRole() === RoleName::SystemAdministrator;
    }
}
