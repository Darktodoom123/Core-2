<?php

namespace App\Platform\Attachments\Policies;

use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Fuel\Models\FuelRequest;
use App\Platform\Attachments\Models\Attachment;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Models\JobReport;
use App\Shared\Assets\Models\OperationalAsset;

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
