<?php

use App\Platform\Identity\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('operations.workspace', function (User $user): bool {
    return $user->is_active
        && $user->suspended_at === null
        && $user->hasVerifiedEmail()
        && $user->operationalRole() !== null;
});

Broadcast::channel('operations.sos', function (User $user): bool {
    return $user->is_active
        && $user->suspended_at === null
        && $user->hasVerifiedEmail()
        && $user->can('sos.view');
});
