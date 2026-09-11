<?php

namespace App\Platform\Notifications\Policies;

use App\Platform\Identity\Models\User;
use App\Platform\Notifications\Models\Notification;

class NotificationPolicy
{
    public function view(User $user, Notification $notification): bool
    {
        return $notification->notifiable_type === $user->getMorphClass() && (int) $notification->notifiable_id === (int) $user->id;
    }

    public function update(User $user, Notification $notification): bool
    {
        return $notification->notifiable_type === $user->getMorphClass() && (int) $notification->notifiable_id === (int) $user->id;
    }
}
