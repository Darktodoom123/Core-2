<?php

namespace App\Platform\Identity\Services;

use App\Platform\Identity\Mail\EmailOtpMail;
use App\Platform\Identity\Models\EmailOneTimeCode;
use App\Platform\Identity\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class EmailOtpService
{
    /**
     * Generate and dispatch a new 6-digit verification code.
     *
     * @param  array<string, mixed>|null  $metadata
     * @return array{challenge_id: string, expires_at: string, cooldown_seconds: int}
     */
    public function generateCode(
        User $user,
        string $purpose,
        ?string $destinationEmail = null,
        ?array $metadata = null,
        ?string $ip = null,
    ): array {
        $sendThrottleKey = 'email-otp-send:'.$user->id.':'.($ip ?: 'unknown');
        if (RateLimiter::tooManyAttempts($sendThrottleKey, 5)) {
            $seconds = RateLimiter::availableIn($sendThrottleKey);
            throw ValidationException::withMessages([
                'email' => "Too many code requests. Please try again in {$seconds} seconds.",
            ]);
        }
        RateLimiter::hit($sendThrottleKey, 300);

        // Cooldown throttle: 1 send per 45 seconds
        $cooldownKey = 'email-otp-cooldown:'.$user->id.':'.$purpose;
        RateLimiter::hit($cooldownKey, 45);

        // Invalidate earlier active codes for this user and purpose
        EmailOneTimeCode::query()
            ->where('user_id', $user->id)
            ->where('purpose', $purpose)
            ->whereNull('verified_at')
            ->delete();

        $challengeId = (string) Str::uuid();
        $code = sprintf('%06d', random_int(100000, 999999));
        $codeHash = hash_hmac('sha256', $code, (string) config('app.key'));
        $expiresAt = now()->addMinutes(5);

        EmailOneTimeCode::query()->create([
            'user_id' => $user->id,
            'challenge_id' => $challengeId,
            'purpose' => $purpose,
            'code_hash' => $codeHash,
            'attempts' => 0,
            'max_attempts' => 5,
            'resend_count' => 0,
            'expires_at' => $expiresAt,
            'verified_at' => null,
            'metadata' => $metadata,
            'ip_address' => $ip,
        ]);

        $recipient = $destinationEmail ?? $user->email;
        Mail::to($recipient)->send(new EmailOtpMail($code, $purpose, 5));

        return [
            'challenge_id' => $challengeId,
            'expires_at' => $expiresAt->toIso8601String(),
            'cooldown_seconds' => 45,
        ];
    }

    /**
     * Resend a fresh code for an existing challenge or initiate a new code.
     *
     * @return array{challenge_id: string, expires_at: string, cooldown_seconds: int}
     */
    public function resendCode(
        User $user,
        string $purpose,
        string $challengeId,
        ?string $destinationEmail = null,
        ?string $ip = null,
    ): array {
        $cooldownKey = 'email-otp-cooldown:'.$user->id.':'.$purpose;
        if (RateLimiter::tooManyAttempts($cooldownKey, 1)) {
            $seconds = RateLimiter::availableIn($cooldownKey);
            throw ValidationException::withMessages([
                'code' => "Please wait {$seconds} seconds before requesting a new code.",
            ]);
        }

        // Retrieve prior metadata if present
        $existing = EmailOneTimeCode::query()
            ->where('user_id', $user->id)
            ->where('purpose', $purpose)
            ->where('challenge_id', $challengeId)
            ->first();

        if (! $existing) {
            throw ValidationException::withMessages([
                'code' => 'The verification challenge was not found or is invalid.',
            ]);
        }

        if ($existing->isVerified()) {
            throw ValidationException::withMessages([
                'code' => 'This verification challenge has already been completed.',
            ]);
        }

        $metadata = $existing->metadata;
        $resendCount = $existing->resend_count + 1;

        if ($resendCount > 5) {
            throw ValidationException::withMessages([
                'code' => 'Maximum code resend limit reached. Please restart this verification flow.',
            ]);
        }

        // Delete earlier code
        EmailOneTimeCode::query()
            ->where('user_id', $user->id)
            ->where('purpose', $purpose)
            ->delete();

        RateLimiter::hit($cooldownKey, 45);

        $newChallengeId = (string) Str::uuid();
        $code = sprintf('%06d', random_int(100000, 999999));
        $codeHash = hash_hmac('sha256', $code, (string) config('app.key'));
        $expiresAt = now()->addMinutes(5);

        EmailOneTimeCode::query()->create([
            'user_id' => $user->id,
            'challenge_id' => $newChallengeId,
            'purpose' => $purpose,
            'code_hash' => $codeHash,
            'attempts' => 0,
            'max_attempts' => 5,
            'resend_count' => $resendCount,
            'expires_at' => $expiresAt,
            'verified_at' => null,
            'metadata' => $metadata,
            'ip_address' => $ip,
        ]);

        $recipient = $destinationEmail ?? $metadata['new_email'] ?? $user->email;
        Mail::to($recipient)->send(new EmailOtpMail($code, $purpose, 5));

        return [
            'challenge_id' => $newChallengeId,
            'expires_at' => $expiresAt->toIso8601String(),
            'cooldown_seconds' => 45,
        ];
    }

    /**
     * Atomically verify a submitted 6-digit code.
     */
    public function verifyCode(
        User $user,
        string $purpose,
        string $challengeId,
        string $code,
        ?string $ip = null,
    ): EmailOneTimeCode {
        $verifyThrottleKey = 'email-otp-verify:'.$user->id.':'.($ip ?: 'unknown');
        if (RateLimiter::tooManyAttempts($verifyThrottleKey, 10)) {
            $seconds = RateLimiter::availableIn($verifyThrottleKey);
            throw ValidationException::withMessages([
                'code' => "Too many incorrect attempts. Please try again in {$seconds} seconds.",
            ]);
        }

        /** @var EmailOneTimeCode|null $record */
        $record = EmailOneTimeCode::query()
            ->where('user_id', $user->id)
            ->where('purpose', $purpose)
            ->where('challenge_id', $challengeId)
            ->first();

        if (! $record) {
            RateLimiter::hit($verifyThrottleKey, 300);
            throw ValidationException::withMessages([
                'code' => 'The verification challenge was not found or is invalid.',
            ]);
        }

        if ($record->isVerified()) {
            RateLimiter::hit($verifyThrottleKey, 300);
            throw ValidationException::withMessages([
                'code' => 'This verification code has already been used.',
            ]);
        }

        if ($record->isExpired()) {
            RateLimiter::hit($verifyThrottleKey, 300);
            throw ValidationException::withMessages([
                'code' => 'This verification code has expired. Please request a new code.',
            ]);
        }

        if ($record->isExhausted()) {
            RateLimiter::hit($verifyThrottleKey, 300);
            throw ValidationException::withMessages([
                'code' => 'Too many incorrect attempts. This code is invalid. Please request a new code.',
            ]);
        }

        $expectedHash = hash_hmac('sha256', trim($code), (string) config('app.key'));
        if (! hash_equals($record->code_hash, $expectedHash)) {
            // Persist the attempt count immediately outside any rollback
            DB::table('email_one_time_codes')
                ->where('id', $record->id)
                ->increment('attempts');
            $record->refresh();

            RateLimiter::hit($verifyThrottleKey, 300);

            if ($record->attempts >= $record->max_attempts) {
                throw ValidationException::withMessages([
                    'code' => 'Too many incorrect attempts. This code is now invalid. Please request a new code.',
                ]);
            }

            $remaining = $record->max_attempts - $record->attempts;
            throw ValidationException::withMessages([
                'code' => "The provided verification code is incorrect. {$remaining} attempt(s) remaining.",
            ]);
        }

        return DB::transaction(function () use ($record, $verifyThrottleKey): EmailOneTimeCode {
            /** @var EmailOneTimeCode $lockedRecord */
            $lockedRecord = EmailOneTimeCode::query()->lockForUpdate()->findOrFail($record->id);
            if ($lockedRecord->isVerified()) {
                throw ValidationException::withMessages([
                    'code' => 'This verification code has already been used.',
                ]);
            }

            $lockedRecord->update(['verified_at' => now()]);
            RateLimiter::clear($verifyThrottleKey);

            return $lockedRecord;
        });
    }
}
