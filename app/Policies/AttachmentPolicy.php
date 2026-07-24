<?php

namespace App\Policies;

use App\Enums\PermissionName;
use App\Models\Attachment;
use App\Models\DispatchJob;
use App\Models\FuelRequest;
use App\Models\JobReport;
use App\Models\OperationalAsset;
use App\Models\User;

class AttachmentPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can(PermissionName::ReportsViewAll->value)
            || $user->can(PermissionName::ReportsViewDispatch->value)
            || $user->can(PermissionName::DispatchViewAll->value);
    }

    public function view(User $user, Attachment $attachment): bool
    {
        return $this->canAccess($user, $attachment);
    }

    public function download(User $user, Attachment $attachment): bool
    {
        return $this->canAccess($user, $attachment);
    }

    public function create(User $user): bool
    {
        return $user->is_active;
    }

    public function delete(User $user, Attachment $attachment): bool
    {
        return $user->id === $attachment->uploaded_by || $user->can(PermissionName::SystemConfigure->value);
    }

    private function canAccess(User $user, Attachment $attachment): bool
    {
        if ($user->id === $attachment->uploaded_by) {
            return true;
        }

        if ($user->can(PermissionName::ReportsViewAll->value) || $user->can(PermissionName::DispatchViewAll->value)) {
            return true;
        }

        $owner = $attachment->owner;
        if (! $owner) {
            return false;
        }

        return match (true) {
            $owner instanceof JobReport => $user->can('view', $owner),
            $owner instanceof DispatchJob => $user->can('view', $owner),
            $owner instanceof OperationalAsset => $user->can('view', $owner),
            $owner instanceof FuelRequest => $user->can('view', $owner),
            default => false,
        };
    }
}
