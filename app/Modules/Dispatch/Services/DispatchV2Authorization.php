<?php

namespace App\Modules\Dispatch\Services;

use App\Modules\Dispatch\Enums\DispatchV2CommandCode;
use App\Modules\Dispatch\Exceptions\DispatchV2CommandException;
use App\Modules\Dispatch\Models\DispatchExecutionAttempt;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;

final class DispatchV2Authorization
{
    public function authorizeCreate(User $actor): void
    {
        $this->assertActive($actor);

        if (! $actor->can(PermissionName::DispatchCreate->value)) {
            $this->deny();
        }
    }

    public function authorizeRead(User $actor, DispatchExecutionAttempt $attempt): void
    {
        $this->assertActive($actor);

        if ($actor->can(PermissionName::DispatchViewAll->value)) {
            return;
        }

        $isAssigned = $attempt->assignmentOffers()
            ->where('user_id', $actor->id)
            ->where('status', 'accepted')
            ->exists();

        if (! $actor->can(PermissionName::DispatchViewAssigned->value) || ! $isAssigned) {
            $this->deny();
        }
    }

    public function authorize(User $actor, string $ability, DispatchExecutionAttempt $attempt): void
    {
        $this->assertActive($actor);

        $allowed = match ($ability) {
            'submit' => $actor->can(PermissionName::DispatchUpdate->value)
                || $actor->can(PermissionName::DispatchCreate->value),
            'approve' => $actor->can(PermissionName::DispatchApprovePriority->value)
                || $actor->can(PermissionName::DispatchApproveChange->value)
                || $actor->can(PermissionName::AssignmentsApprove->value),
            'dispatch' => $actor->can(PermissionName::DispatchActivate->value)
                || $actor->can(PermissionName::DispatchApprovePriority->value)
                || $actor->can(PermissionName::DispatchApproveChange->value),
            'cancel' => $actor->can(PermissionName::DispatchCancel->value)
                || $actor->can(PermissionName::DispatchApproveCancel->value),
            'reopen' => $actor->can(PermissionName::DispatchApproveCancel->value)
                || $actor->can(PermissionName::ArchiveManage->value),
            'archive' => $actor->can(PermissionName::ArchiveManage->value),
            'progress' => $this->isDesignatedLead($actor, $attempt)
                || $this->canOverrideProgress($actor),
            default => false,
        };

        if (! $allowed) {
            $this->deny();
        }
    }

    public function isDesignatedLead(User $actor, DispatchExecutionAttempt $attempt): bool
    {
        $offerId = $attempt->getAttribute('designated_lead_offer_id');

        if (! is_numeric($offerId)) {
            return false;
        }

        return $attempt->assignmentOffers()
            ->whereKey((int) $offerId)
            ->where('user_id', $actor->id)
            ->where('status', 'accepted')
            ->exists();
    }

    public function canOverrideProgress(User $actor): bool
    {
        return $actor->can(PermissionName::AssignmentsOverride->value)
            || $actor->can(PermissionName::DispatchApproveChange->value);
    }

    private function assertActive(User $actor): void
    {
        if ($actor->getAttribute('is_active') === false) {
            $this->deny();
        }
    }

    private function deny(): never
    {
        throw new DispatchV2CommandException(
            DispatchV2CommandCode::Forbidden,
            'You are not authorized to perform this dispatch operation.',
            status: 403,
        );
    }
}
