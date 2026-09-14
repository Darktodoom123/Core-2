<?php

namespace App\Platform\Identity\Services;

use App\Platform\Identity\Models\TrustedDevice;
use App\Platform\Identity\Models\User;
use App\Platform\Identity\Support\UserAgentParser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DeviceTrustService
{
    public const COOKIE_NAME = 'core2_device_trust';

    public const TRUST_DURATION_DAYS = 30;

    /**
     * Verify whether a trust token corresponds to an active, unexpired trusted device for this user.
     */
    public function verifyTrust(User $user, ?string $token): ?TrustedDevice
    {
        if ($token === null || trim($token) === '') {
            return null;
        }

        $keyHash = hash('sha256', $token);

        /** @var TrustedDevice|null $device */
        $device = TrustedDevice::query()
            ->where('user_id', $user->id)
            ->where('device_key_hash', $keyHash)
            ->where('expires_at', '>', now())
            ->first();

        if ($device) {
            // Record last activity without extending the fixed 30-day expiration window
            $device->update(['last_used_at' => now()]);
        }

        return $device;
    }

    /**
     * Issue a cryptographically random, revocable trust token bound to the account.
     * Fixed 30-day expiry without rolling extensions.
     *
     * @return array{token: string, device: TrustedDevice}
     */
    public function issueTrust(
        User $user,
        Request $request,
        string $platform = 'web',
        ?string $customLabel = null,
    ): array {
        $token = Str::random(64);
        $keyHash = hash('sha256', $token);
        $deviceId = (string) Str::uuid();

        $parsed = UserAgentParser::parse($request->userAgent());
        $deviceLabel = $customLabel
            ?: ($platform === 'mobile'
                ? ('Mobile Device ('.($parsed['platform'] ?: 'Field Mobile').')')
                : $parsed['label']);

        $expiresAt = now()->addDays(self::TRUST_DURATION_DAYS);

        /** @var TrustedDevice $device */
        $device = TrustedDevice::query()->create([
            'user_id' => $user->id,
            'device_id' => $deviceId,
            'device_key_hash' => $keyHash,
            'device_label' => $deviceLabel,
            'platform' => $platform,
            'ip_address' => $request->ip(),
            'last_used_at' => now(),
            'expires_at' => $expiresAt,
        ]);

        return [
            'token' => $token,
            'device' => $device,
        ];
    }

    /**
     * Revoke a single trusted device by public device ID.
     */
    public function revokeDevice(User $user, string $deviceId): bool
    {
        return TrustedDevice::query()
            ->where('user_id', $user->id)
            ->where('device_id', $deviceId)
            ->delete() > 0;
    }

    /**
     * Revoke all trusted devices for a user.
     */
    public function revokeAllDevices(User $user): int
    {
        return TrustedDevice::query()
            ->where('user_id', $user->id)
            ->delete();
    }

    /**
     * Revoke a device by token (e.g.  Sign out and forget this device).
     */
    public function revokeByToken(User $user, string $token): bool
    {
        $keyHash = hash('sha256', $token);

        return TrustedDevice::query()
            ->where('user_id', $user->id)
            ->where('device_key_hash', $keyHash)
            ->delete() > 0;
    }

    /**
     * Lost-device action: revokes both associated trust and access sessions/tokens.
     */
    public function markDeviceLost(User $user, string $deviceId): bool
    {
        /** @var TrustedDevice|null $device */
        $device = TrustedDevice::query()
            ->where('user_id', $user->id)
            ->where('device_id', $deviceId)
            ->first();

        if (! $device) {
            return false;
        }

        // Revoke the trust record
        $device->delete();

        // Revoke web sessions associated with the device IP or user agent if recorded
        if ($device->ip_address) {
            DB::table('sessions')
                ->where('user_id', $user->id)
                ->where('ip_address', $device->ip_address)
                ->delete();
        }

        // Revoke mobile personal access tokens matching device label
        $user->tokens()->where('name', $device->device_label)->delete();

        return true;
    }
}
