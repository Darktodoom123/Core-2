<?php

use App\Platform\Identity\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('operations.workspace', function (User $user) {
    return true;
});
