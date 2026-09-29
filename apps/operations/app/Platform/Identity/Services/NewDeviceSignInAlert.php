<?php

namespace App\Platform\Identity\Services;

use App\Platform\Identity\Mail\NewDeviceSignInMail;
use App\Platform\Identity\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Emails the account owner after a sign-in passes the email code challenge
 * on an untrusted device. Failure to queue must never block the sign-in.
 */
final class NewDeviceSignInAlert
{
    public function send(User $user, string $deviceLabel, ?string $ipAddress): void
    {
        // Accounts that cannot trust devices already get a code on every sign-in.
        if (! $user->canTrustDevice()) {
            return;
        }

        try {
            Mail::to($user->email)->queue(new NewDeviceSignInMail($deviceLabel, $ipAddress, now()));
        } catch (\Throwable $e) {
            Log::error('Failed to queue new device sign-in alert: '.$e->getMessage(), [
                'user_id' => $user->id,
            ]);
        }
    }
}
