<?php

namespace App\Platform\Identity\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\EmailOneTimeCode;
use App\Platform\Identity\Models\User;
use App\Platform\Identity\Services\DeviceTrustService;
use App\Platform\Identity\Services\EmailOtpService;
use App\Platform\Identity\Support\IpLocationResolver;
use App\Platform\Identity\Support\UserAgentParser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

final class AccountSecurityApiController extends Controller
{
    public function requestEnableOtp(Request $request, EmailOtpService $otpService): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $request->validate([
            'current_password' => ['required', 'string'],
        ]);

        if (! Hash::check($request->input('current_password'), $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['The provided password does not match our records.'],
            ]);
        }

        if (! $user->hasVerifiedEmail()) {
            throw ValidationException::withMessages([
                'email' => ['A verified email address is required before enabling email verification codes.'],
            ]);
        }

        $result = $otpService->generateCode(
            user: $user,
            purpose: EmailOneTimeCode::PURPOSE_ENABLE_OTP,
            ip: $request->ip(),
        );

        return response()->json([
            'message' => 'A verification code has been sent to your verified email address.',
            'challenge_id' => $result['challenge_id'],
            'cooldown_seconds' => $result['cooldown_seconds'],
        ]);
    }

    public function confirmEnableOtp(
        Request $request,
        EmailOtpService $otpService,
        RecordAuditEvent $audit,
    ): JsonResponse {
        /** @var User $user */
        $user = $request->user();

        if (! $user->hasVerifiedEmail()) {
            throw ValidationException::withMessages([
                'email' => ['A verified email address is required before enabling email verification codes.'],
            ]);
        }

        $validated = $request->validate([
            'challenge_id' => ['required', 'string'],
            'code' => ['required', 'string', 'digits:6'],
        ]);

        $otpService->verifyCode(
            user: $user,
            purpose: EmailOneTimeCode::PURPOSE_ENABLE_OTP,
            challengeId: $validated['challenge_id'],
            code: $validated['code'],
            ip: $request->ip(),
        );

        $user->update([
            'email_otp_enabled' => true,
        ]);

        $deviceInfo = UserAgentParser::parse($request->userAgent());
        $audit->handle($user, $user, 'user.email_otp_enabled', ['email_otp_enabled' => false], [
            'email_otp_enabled' => true,
            'device' => $deviceInfo['label'],
            'user_agent' => $request->userAgent(),
            'outcome' => 'success',
        ]);

        return response()->json([
            'message' => 'Email code verification has been enabled for your account.',
            'email_otp_enabled' => true,
        ]);
    }

    public function requestDisableOtp(Request $request, EmailOtpService $otpService): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if ($user->hasRole(RoleName::SystemAdministrator->value)) {
            throw ValidationException::withMessages([
                'current_password' => ['Email verification codes are mandatory for System Administrators by organizational policy.'],
            ]);
        }

        $request->validate([
            'current_password' => ['required', 'string'],
        ]);

        if (! Hash::check($request->input('current_password'), $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['The provided password does not match our records.'],
            ]);
        }

        $result = $otpService->generateCode(
            user: $user,
            purpose: EmailOneTimeCode::PURPOSE_DISABLE_OTP,
            ip: $request->ip(),
        );

        return response()->json([
            'message' => 'A verification code has been sent to confirm disabling email verification.',
            'challenge_id' => $result['challenge_id'],
            'cooldown_seconds' => $result['cooldown_seconds'],
        ]);
    }

    public function confirmDisableOtp(
        Request $request,
        EmailOtpService $otpService,
        RecordAuditEvent $audit,
    ): JsonResponse {
        /** @var User $user */
        $user = $request->user();

        if ($user->hasRole(RoleName::SystemAdministrator->value)) {
            throw ValidationException::withMessages([
                'code' => ['Email verification codes are mandatory for System Administrators by organizational policy.'],
            ]);
        }

        $validated = $request->validate([
            'challenge_id' => ['required', 'string'],
            'code' => ['required', 'string', 'digits:6'],
        ]);

        $otpService->verifyCode(
            user: $user,
            purpose: EmailOneTimeCode::PURPOSE_DISABLE_OTP,
            challengeId: $validated['challenge_id'],
            code: $validated['code'],
            ip: $request->ip(),
        );

        $user->update([
            'email_otp_enabled' => false,
        ]);

        $deviceInfo = UserAgentParser::parse($request->userAgent());
        $audit->handle($user, $user, 'user.email_otp_disabled', ['email_otp_enabled' => true], [
            'email_otp_enabled' => false,
            'device' => $deviceInfo['label'],
            'user_agent' => $request->userAgent(),
            'outcome' => 'success',
        ]);

        return response()->json([
            'message' => 'Email code verification has been disabled.',
            'email_otp_enabled' => false,
        ]);
    }

    public function resendOtp(Request $request, EmailOtpService $otpService): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'challenge_id' => ['required', 'string'],
            'purpose' => ['required', 'string', 'in:enable_email_otp,disable_email_otp,email_change'],
        ]);

        $result = $otpService->resendCode(
            user: $user,
            purpose: $validated['purpose'],
            challengeId: $validated['challenge_id'],
            ip: $request->ip(),
        );

        return response()->json([
            'message' => 'A fresh verification code has been sent to your email address.',
            'challenge_id' => $result['challenge_id'],
            'cooldown_seconds' => $result['cooldown_seconds'],
        ]);
    }

    public function revokeSession(
        Request $request,
        string $session,
        RecordAuditEvent $audit,
    ): JsonResponse {
        /** @var User $user */
        $user = $request->user();

        $currentToken = $user->currentAccessToken();
        if ($session === 'token-'.$currentToken->id) {
            abort(400, 'Cannot revoke your current active session from this action.');
        }

        // Check if revoking another Sanctum token
        if (str_starts_with($session, 'token-')) {
            $tokenId = (int) substr($session, 6);
            $token = $user->tokens()->where('id', $tokenId)->first();
            abort_unless($token !== null, 404, 'Session not found or access denied.');
            $token->delete();

            $audit->handle($user, $user, 'user.session_revoked', null, [
                'device' => $token->name,
                'outcome' => 'success',
            ]);

            return response()->json(['message' => 'Session revoked successfully.']);
        }

        // Web session revocation
        $dbSession = DB::table('sessions')
            ->where('user_id', $user->id)
            ->where('id', $session)
            ->first();

        abort_unless($dbSession !== null, 404, 'Session not found or access denied.');

        DB::table('sessions')
            ->where('user_id', $user->id)
            ->where('id', $session)
            ->delete();

        $parsed = UserAgentParser::parse($dbSession->user_agent);
        $audit->handle($user, $user, 'user.session_revoked', null, [
            'device' => $parsed['label'],
            'ip_address' => $dbSession->ip_address,
            'outcome' => 'success',
        ]);

        return response()->json(['message' => 'Session revoked successfully.']);
    }

    public function revokeOtherSessions(
        Request $request,
        RecordAuditEvent $audit,
    ): JsonResponse {
        /** @var User $user */
        $user = $request->user();

        $request->validate([
            'current_password' => ['required', 'string'],
        ]);

        if (! Hash::check($request->input('current_password'), $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['The provided password does not match our records.'],
            ]);
        }

        $user->forceFill([
            'remember_token' => null,
        ])->save();

        $deletedSessionsCount = DB::table('sessions')
            ->where('user_id', $user->id)
            ->delete();

        // Revoke all other personal access tokens except current bearer token
        $currentToken = $user->currentAccessToken();
        $deletedTokensCount = $user->tokens()
            ->where('id', '!=', $currentToken->id)
            ->delete();

        $totalRevoked = $deletedSessionsCount + $deletedTokensCount;

        $deviceInfo = UserAgentParser::parse($request->userAgent());
        $audit->handle($user, $user, 'user.other_sessions_revoked', null, [
            'revoked_count' => $totalRevoked,
            'device' => $deviceInfo['label'],
            'outcome' => 'success',
        ]);

        return response()->json([
            'message' => 'All other sessions have been signed out successfully.',
            'revoked_count' => $totalRevoked,
        ]);
    }

    public function revokeTrustedDevice(
        Request $request,
        string $deviceId,
        DeviceTrustService $trustService,
        RecordAuditEvent $audit,
    ): JsonResponse {
        /** @var User $user */
        $user = $request->user();

        $revoked = $trustService->revokeDevice($user, $deviceId);
        abort_unless($revoked, 404, 'Trusted device not found or already revoked.');

        $deviceInfo = UserAgentParser::parse($request->userAgent());
        $audit->handle($user, $user, 'user.trusted_device_revoked', null, [
            'device_id' => $deviceId,
            'device' => $deviceInfo['label'],
            'outcome' => 'success',
        ]);

        return response()->json(['message' => 'Trusted device revoked successfully.']);
    }

    public function revokeAllTrustedDevices(
        Request $request,
        DeviceTrustService $trustService,
        RecordAuditEvent $audit,
    ): JsonResponse {
        /** @var User $user */
        $user = $request->user();

        $count = $trustService->revokeAllDevices($user);

        $deviceInfo = UserAgentParser::parse($request->userAgent());
        $audit->handle($user, $user, 'user.all_trusted_devices_revoked', null, [
            'revoked_count' => $count,
            'device' => $deviceInfo['label'],
            'outcome' => 'success',
        ]);

        return response()->json([
            'message' => 'All trusted devices revoked successfully.',
            'revoked_count' => $count,
        ]);
    }

    public function markDeviceLost(
        Request $request,
        string $deviceId,
        DeviceTrustService $trustService,
        RecordAuditEvent $audit,
    ): JsonResponse {
        /** @var User $user */
        $user = $request->user();

        $revoked = $trustService->markDeviceLost($user, $deviceId);
        abort_unless($revoked, 404, 'Device not found.');

        $deviceInfo = UserAgentParser::parse($request->userAgent());
        $audit->handle($user, $user, 'user.lost_device_reported', null, [
            'device_id' => $deviceId,
            'device' => $deviceInfo['label'],
            'outcome' => 'success',
        ]);

        return response()->json(['message' => 'Lost device trust and active sessions revoked successfully.']);
    }

    public function activity(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $perPage = min(max($request->integer('per_page', 10), 1), 50);

        $activity = AuditEvent::query()
            ->where('subject_type', $user->getMorphClass())
            ->where('subject_id', (string) $user->id)
            ->whereIn('action', [
                'user.login',
                'user.logout',
                'user.password_changed',
                'user.email_otp_enabled',
                'user.email_otp_disabled',
                'user.session_revoked',
                'user.other_sessions_revoked',
                'user.email_updated',
                'user.profile_updated',
                'user.trusted_device_revoked',
                'user.all_trusted_devices_revoked',
                'user.lost_device_reported',
            ])
            ->orderByDesc('occurred_at')
            ->orderByDesc('id')
            ->paginate($perPage)
            ->through(function (AuditEvent $event): array {
                /** @var array<string, mixed> $after */
                $after = is_array($event->after) ? $event->after : [];
                $actionLabels = [
                    'user.login' => 'Signed in',
                    'user.logout' => 'Signed out',
                    'user.password_changed' => 'Password changed',
                    'user.email_otp_enabled' => 'Email code sign-in enabled',
                    'user.email_otp_disabled' => 'Email code sign-in disabled',
                    'user.session_revoked' => 'Session revoked',
                    'user.other_sessions_revoked' => 'Other sessions revoked',
                    'user.email_updated' => 'Email address updated',
                    'user.profile_updated' => 'Contact details updated',
                    'user.trusted_device_revoked' => 'Trusted device revoked',
                    'user.all_trusted_devices_revoked' => 'All trusted devices revoked',
                    'user.lost_device_reported' => 'Device reported lost',
                ];

                $outcome = isset($after['outcome']) && is_string($after['outcome']) ? $after['outcome'] : 'success';
                $device = isset($after['device']) && is_string($after['device']) ? $after['device'] : null;
                $userAgent = isset($after['user_agent']) && is_string($after['user_agent']) ? $after['user_agent'] : null;
                $deviceLabel = $device ?? ($userAgent !== null ? UserAgentParser::parse($userAgent)['label'] : 'Field Mobile Client');

                return [
                    'id' => $event->id,
                    'action' => $event->action,
                    'event_label' => $actionLabels[$event->action] ?? $event->action,
                    'outcome' => $outcome,
                    'ip_address' => $event->ip_address ?: 'Unknown IP',
                    'device_label' => $deviceLabel,
                    'location' => IpLocationResolver::resolve($event->ip_address),
                    'occurred_at' => $event->occurred_at?->toIso8601String(),
                    'occurred_at_human' => $event->occurred_at?->diffForHumans(),
                ];
            });

        return response()->json([
            'data' => $activity->items(),
            'current_page' => $activity->currentPage(),
            'last_page' => $activity->lastPage(),
            'prev_page_url' => $activity->previousPageUrl(),
            'next_page_url' => $activity->nextPageUrl(),
            'total' => $activity->total(),
        ]);
    }
}
