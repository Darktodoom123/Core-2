<?php

use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('operations.workspace', function (User $user) {
    return $user !== null;
});
