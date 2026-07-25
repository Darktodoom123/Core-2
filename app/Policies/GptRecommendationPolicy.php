<?php

namespace App\Policies;

use App\Enums\PermissionName;
use App\Models\GptRecommendation;
use App\Models\User;

final class GptRecommendationPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can(PermissionName::GptUseDispatch->value)
            || $user->can(PermissionName::GptUseOperations->value)
            || $user->can(PermissionName::GptUseMaintenance->value);
    }

    public function view(User $user, GptRecommendation $recommendation): bool
    {
        return $this->canAccessPurpose($user, $recommendation->purpose);
    }

    public function create(User $user): bool
    {
        return $this->viewAny($user);
    }

    public function decide(User $user, GptRecommendation $recommendation): bool
    {
        return $this->canAccessPurpose($user, $recommendation->purpose);
    }

    private function canAccessPurpose(User $user, string $purpose): bool
    {
        return match ($purpose) {
            'dispatch_assignment' => $user->can(PermissionName::GptUseDispatch->value),
            'operations_review' => $user->can(PermissionName::GptUseOperations->value),
            'maintenance_advice' => $user->can(PermissionName::GptUseMaintenance->value),
            default => $user->can(PermissionName::GptUseDispatch->value),
        };
    }
}
