<?php

namespace App\Policies;

use App\Enums\PermissionName;
use App\Models\FuelRequest;
use App\Models\User;

final class FuelRequestPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can(PermissionName::FuelViewAll->value) || $user->can(PermissionName::FuelViewOwn->value);
    }

    public function view(User $user, FuelRequest $fuelRequest): bool
    {
        return $user->can(PermissionName::FuelViewAll->value) || ($user->can(PermissionName::FuelViewOwn->value) && $fuelRequest->requester_id === $user->id);
    }

    public function create(User $user): bool
    {
        return $user->can(PermissionName::FuelRequest->value);
    }

    public function forward(User $user, FuelRequest $fuelRequest): bool
    {
        return $user->can(PermissionName::FuelForward->value);
    }

    public function approve(User $user, FuelRequest $fuelRequest): bool
    {
        return $user->can(PermissionName::FuelApprove->value) && $fuelRequest->requester_id !== $user->id;
    }

    public function verify(User $user, FuelRequest $fuelRequest): bool
    {
        return $user->can(PermissionName::FuelVerify->value);
    }
}
