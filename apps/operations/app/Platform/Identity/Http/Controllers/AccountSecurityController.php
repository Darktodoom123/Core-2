<?php

namespace App\Platform\Identity\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Http\Middleware\ValidateActiveSession;
use App\Platform\Identity\Models\EmailOneTimeCode;
use App\Platform\Identity\Models\User;
use App\Platform\Identity\Services\DeviceTrustService;
use App\Platform\Identity\Services\EmailOtpService;
use App\Platform\Identity\Support\UserAgentParser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class AccountSecurityController extends Controller
{
    public function requestEnableOtp(Request $request, EmailOtpService $otpService): JsonResponse|RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();

        $request->validate([
            'current_password' => ['required', 'string', 'current_password:web'],
        ]);

        if (! $user->hasVerifiedEmail()) {
            throw ValidationException::withMessages([
                'email' => 'A verified email address is required before enabling email verification codes.',
            ]);
        }

        $result = $otpService->generateCode(
            user: $user,
            purpose: EmailOneTimeCode::PURPOSE_ENABLE_OTP,
            ip: $request->ip(),
        );

        if ($request->wantsJson()) {
            return response()->json([
                'message' => 'A verification code has been sent to your verified email address.',
                'challenge_id' => $result['challenge_id'],
                'cooldown_seconds' => $result['cooldown_seconds'],
            ]);
        }

        return back()->with([
            'status' => 'A verification code has been sent to your verified email address.',
            'otp_challenge_id' => $result['challenge_id'],
            'otp_action' => 'enable',
        ]);
    }

    public function confirmEnableOtp(
        Request $request,
        EmailOtpService $otpService,
        RecordAuditEvent $audit,
    ): JsonResponse|RedirectResponse {
        /** @var User $user */
        $user = $request->user();

        if (! $user->hasVerifiedEmail()) {
            throw ValidationException::withMessages([
                'email' => 'A verified email address is required before enabling email verification codes.',
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

        if ($request->wantsJson()) {
            return response()->json([
                'message' => 'Email code verification has been enabled for your web account.',
                'email_otp_enabled' => true,
            ]);
        }

        return back()->with('status', 'Email code verification has been enabled for your web account.');
    }

    public function requestDisableOtp(Request $request, EmailOtpService $otpService): JsonResponse|RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();

        if ($user->hasRole(RoleName::SystemAdministrator->value)) {
            throw ValidationException::withMessages([
                'current_password' => 'Email verification codes are mandatory for System Administrators by organizational policy.',
            ]);
        }

        $request->validate([
            'current_password' => ['required', 'string', 'current_password:web'],
        ]);

        $result = $otpService->generateCode(
            user: $user,
            purpose: EmailOneTimeCode::PURPOSE_DISABLE_OTP,
            ip: $request->ip(),
        );

        if ($request->wantsJson()) {
            return response()->json([
                'message' => 'A verification code has been sent to confirm disabling email verification.',
                'challenge_id' => $result['challenge_id'],
                'cooldown_seconds' => $result['cooldown_seconds'],
            ]);
        }

        return back()->with([
            'status' => 'A verification code has been sent to confirm disabling email verification.',
            'otp_challenge_id' => $result['challenge_id'],
            'otp_action' => 'disable',
        ]);
    }

    public function confirmDisableOtp(
        Request $request,
        EmailOtpService $otpService,
        RecordAuditEvent $audit,
    ): JsonResponse|RedirectResponse {
        /** @var User $user */
        $user = $request->user();

        if ($user->hasRole(RoleName::SystemAdministrator->value)) {
            throw ValidationException::withMessages([
                'code' => 'Email verification codes are mandatory for System Administrators by organizational policy.',
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

        if ($request->wantsJson()) {
            return response()->json([
                'message' => 'Email code verification has been disabled.',
                'email_otp_enabled' => false,
            ]);
        }

        return back()->with('status', 'Email code verification has been disabled.');
    }

    public function resendOtp(Request $request, EmailOtpService $otpService): JsonResponse|RedirectResponse
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

        if ($request->wantsJson()) {
            return response()->json([
                'message' => 'A fresh verification code has been sent to your email address.',
                'challenge_id' => $result['challenge_id'],
                'cooldown_seconds' => $result['cooldown_seconds'],
            ]);
        }

        return back()->with([
            'status' => 'A fresh verification code has been sent to your email address.',
            'challenge_id' => $result['challenge_id'],
            'otp_challenge_id' => $result['challenge_id'],
        ]);
    }

    public function revokeSession(
        Request $request,
        string $sessionId,
        RecordAuditEvent $audit,
    ): JsonResponse|RedirectResponse {
        /** @var User $user */
        $user = $request->user();

        if ($sessionId === $request->session()->getId()) {
            abort(400, 'Cannot revoke your current active session from this action.');
        }

        // Enforce strict server-side ownership
        $session = DB::table('sessions')
            ->where('user_id', $user->id)
            ->where('id', $sessionId)
            ->first();

        abort_unless($session !== null, 404, 'Session not found or access denied.');

        DB::table('sessions')
            ->where('user_id', $user->id)
            ->where('id', $sessionId)
            ->delete();

        $parsed = UserAgentParser::parse($session->user_agent);
        $audit->handle($user, $user, 'user.session_revoked', null, [
            'device' => $parsed['label'],
            'ip_address' => $session->ip_address,
            'outcome' => 'success',
        ]);

        if ($request->wantsJson()) {
            return response()->json(['message' => 'Session revoked successfully.']);
        }

        return back()->with('status', 'Web session revoked successfully.');
    }

    public function revokeOtherSessions(
        Request $request,
        RecordAuditEvent $audit,
    ): JsonResponse|RedirectResponse {
        /** @var User $user */
        $user = $request->user();

        $request->validate([
            'current_password' => ['required', 'string', 'current_password:web'],
        ]);

        $user->forceFill([
            'remember_token' => null,
        ])->save();

        $request->session()->regenerate();
        $newSessionId = $request->session()->getId();
        ValidateActiveSession::track($user, $request);

        $deletedCount = DB::table('sessions')
            ->where('user_id', $user->id)
            ->where('id', '!=', $newSessionId)
            ->delete();

        $deviceInfo = UserAgentParser::parse($request->userAgent());
        $audit->handle($user, $user, 'user.other_sessions_revoked', null, [
            'revoked_count' => $deletedCount,
            'device' => $deviceInfo['label'],
            'outcome' => 'success',
        ]);

        if ($request->wantsJson()) {
            return response()->json([
                'message' => 'All other web sessions have been signed out successfully.',
                'revoked_count' => $deletedCount,
            ]);
        }

        return back()->with('status', 'All other web sessions have been signed out successfully.');
    }

    public function revokeTrustedDevice(
        Request $request,
        string $deviceId,
        DeviceTrustService $trustService,
        RecordAuditEvent $audit,
    ): JsonResponse|RedirectResponse {
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

        if ($request->wantsJson()) {
            return response()->json(['message' => 'Trusted device revoked successfully.']);
        }

        return back()->with('status', 'Trusted device revoked successfully.');
    }

    public function revokeAllTrustedDevices(
        Request $request,
        DeviceTrustService $trustService,
        RecordAuditEvent $audit,
    ): JsonResponse|RedirectResponse {
        /** @var User $user */
        $user = $request->user();

        $count = $trustService->revokeAllDevices($user);

        $deviceInfo = UserAgentParser::parse($request->userAgent());
        $audit->handle($user, $user, 'user.all_trusted_devices_revoked', null, [
            'revoked_count' => $count,
            'device' => $deviceInfo['label'],
            'outcome' => 'success',
        ]);

        if ($request->wantsJson()) {
            return response()->json([
                'message' => 'All trusted devices revoked successfully.',
                'revoked_count' => $count,
            ]);
        }

        return back()->with('status', 'All trusted devices have been revoked.');
    }

    public function markDeviceLost(
        Request $request,
        string $deviceId,
        DeviceTrustService $trustService,
        RecordAuditEvent $audit,
    ): JsonResponse|RedirectResponse {
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

        if ($request->wantsJson()) {
            return response()->json(['message' => 'Lost device trust and active sessions revoked successfully.']);
        }

        return back()->with('status', 'Lost device trust and active access revoked successfully.');
    }
}
