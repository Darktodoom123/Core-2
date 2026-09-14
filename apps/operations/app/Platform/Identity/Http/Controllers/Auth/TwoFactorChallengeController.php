<?php

namespace App\Platform\Identity\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Http\Middleware\ValidateActiveSession;
use App\Platform\Identity\Models\EmailOneTimeCode;
use App\Platform\Identity\Models\User;
use App\Platform\Identity\Services\DeviceTrustService;
use App\Platform\Identity\Services\EmailOtpService;
use App\Platform\Identity\Support\UserAgentParser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

final class TwoFactorChallengeController extends Controller
{
    public function create(Request $request): Response|RedirectResponse
    {
        $twoFactorData = $request->session()->get('login.two_factor');

        if (! is_array($twoFactorData) || empty($twoFactorData['user_id'])) {
            return redirect()->route('login');
        }

        if (($twoFactorData['expires_at'] ?? 0) < time()) {
            $request->session()->forget('login.two_factor');

            return redirect()->route('login')->withErrors([
                'username' => 'Your verification session expired. Please sign in again.',
            ]);
        }

        /** @var User|null $user */
        $user = User::query()->find($twoFactorData['user_id']);
        if (! $user || ! $user->is_active || $user->suspended_at !== null || ! $user->hasVerifiedEmail()) {
            $request->session()->forget('login.two_factor');

            return redirect()->route('login')->withErrors([
                'username' => 'Account is suspended or ineligible for sign in.',
            ]);
        }

        $emailParts = explode('@', $user->email);
        $namePart = $emailParts[0];
        $domainPart = $emailParts[1] ?? '';
        $maskedName = strlen($namePart) > 2
            ? substr($namePart, 0, 2).str_repeat('*', max(1, strlen($namePart) - 3)).substr($namePart, -1)
            : $namePart.'*';
        $obfuscatedEmail = $maskedName.'@'.$domainPart;

        return Inertia::render('auth/two-factor-challenge', [
            'email_obfuscated' => $obfuscatedEmail,
            'expires_in_seconds' => max(0, ((int) $twoFactorData['expires_at']) - time()),
            'status' => session('status'),
        ]);
    }

    public function store(
        Request $request,
        EmailOtpService $otpService,
        DeviceTrustService $trustService,
        RecordAuditEvent $audit,
    ): RedirectResponse {
        $twoFactorData = $request->session()->get('login.two_factor');

        if (! is_array($twoFactorData) || empty($twoFactorData['user_id'])) {
            return redirect()->route('login');
        }

        if (($twoFactorData['expires_at'] ?? 0) < time()) {
            $request->session()->forget('login.two_factor');

            return redirect()->route('login')->withErrors([
                'username' => 'Your verification session expired. Please sign in again.',
            ]);
        }

        $request->validate([
            'code' => ['required', 'string', 'digits:6'],
            'trust_device' => ['sometimes', 'boolean'],
        ]);

        /** @var User|null $user */
        $user = User::query()->find($twoFactorData['user_id']);

        // Recheck account eligibility
        if (! $user || ! $user->is_active || $user->suspended_at !== null || ! $user->hasVerifiedEmail()) {
            $request->session()->forget('login.two_factor');

            return redirect()->route('login')->withErrors([
                'username' => 'This account is not eligible for sign in.',
            ]);
        }

        $code = (string) $request->string('code');
        $otpService->verifyCode(
            user: $user,
            purpose: EmailOneTimeCode::PURPOSE_LOGIN,
            challengeId: (string) $twoFactorData['challenge_id'],
            code: $code,
            ip: $request->ip(),
        );

        $request->session()->forget('login.two_factor');

        Auth::login($user, false);
        $request->session()->regenerate();
        ValidateActiveSession::track($user, $request);

        $trustToken = null;
        if ($request->boolean('trust_device')) {
            $issued = $trustService->issueTrust($user, $request, 'web');
            $trustToken = $issued['token'];
        }

        $deviceInfo = UserAgentParser::parse($request->userAgent());
        $audit->handle($user, $user, 'user.login', null, [
            'auth_type' => 'email_otp',
            'device' => $deviceInfo['label'],
            'trusted_device' => $trustToken !== null,
            'user_agent' => $request->userAgent(),
            'outcome' => 'success',
        ]);

        $redirect = redirect()->intended(route('home', absolute: false));
        if ($trustToken !== null) {
            $redirect->withCookie(
                cookie(
                    DeviceTrustService::COOKIE_NAME,
                    $trustToken,
                    DeviceTrustService::TRUST_DURATION_DAYS * 24 * 60,
                    '/',
                    null,
                    (bool) config('session.secure', false),
                    true,
                    false,
                    'lax',
                )
            );
        }

        return $redirect;
    }

    public function resend(Request $request, EmailOtpService $otpService): RedirectResponse
    {
        $twoFactorData = $request->session()->get('login.two_factor');

        if (! is_array($twoFactorData) || empty($twoFactorData['user_id'])) {
            return redirect()->route('login');
        }

        if (($twoFactorData['expires_at'] ?? 0) < time()) {
            $request->session()->forget('login.two_factor');

            return redirect()->route('login')->withErrors([
                'username' => 'Your verification session expired. Please sign in again.',
            ]);
        }

        /** @var User|null $user */
        $user = User::query()->find($twoFactorData['user_id']);
        if (! $user || ! $user->is_active || $user->suspended_at !== null || ! $user->hasVerifiedEmail()) {
            $request->session()->forget('login.two_factor');

            return redirect()->route('login')->withErrors([
                'username' => 'Account is suspended or ineligible for sign in.',
            ]);
        }

        $result = $otpService->resendCode(
            user: $user,
            purpose: EmailOneTimeCode::PURPOSE_LOGIN,
            challengeId: (string) $twoFactorData['challenge_id'],
            ip: $request->ip(),
        );

        $twoFactorData['challenge_id'] = $result['challenge_id'];
        $twoFactorData['expires_at'] = now()->addMinutes(5)->timestamp;
        $request->session()->put('login.two_factor', $twoFactorData);

        return back()->with('status', 'A new verification code has been sent to your email.');
    }
}
