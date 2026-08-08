<?php

namespace App\Platform\Gpt\Policies;

use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Gpt\Enums\GptRecommendationStatus;
use App\Platform\Gpt\Models\GptRecommendation;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use Illuminate\Support\Facades\Gate;

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
        return $this->canAccessPurpose($user, $recommendation->purpose)
            && $this->canAccessSubject($user, $recommendation);
    }

    public function create(User $user): bool
    {
        return $this->viewAny($user);
    }

    public function decide(User $user, GptRecommendation $recommendation): bool
    {
        return $this->canAccessPurpose($user, $recommendation->purpose)
            && $this->canAccessSubject($user, $recommendation);
    }

    public function retry(User $user, GptRecommendation $recommendation): bool
    {
        $retryable = $recommendation->status->isTerminal()
            && $recommendation->status !== GptRecommendationStatus::Accepted;

        return ($retryable || ($recommendation->status === GptRecommendationStatus::PendingReview && $recommendation->isExpired()))
            && $this->canAccessPurpose($user, $recommendation->purpose)
            && $this->canAccessSubject($user, $recommendation);
    }

    private function canAccessPurpose(User $user, string $purpose): bool
    {
        return match ($purpose) {
            'dispatch_assignment' => $user->can(PermissionName::GptUseDispatch->value),
            'operations_review' => $user->can(PermissionName::GptUseOperations->value),
            'maintenance_advice' => $user->can(PermissionName::GptUseMaintenance->value),
            default => false,
        };
    }

    private function canAccessSubject(User $user, GptRecommendation $recommendation): bool
    {
        $subject = $recommendation->subject;

        return $subject instanceof DispatchJob
            && Gate::forUser($user)->allows('view', $subject);
    }
}
