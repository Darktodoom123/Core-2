<?php

namespace App\Platform\Identity\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Http\Middleware\ValidateActiveSession;
use App\Platform\Identity\Http\Requests\Auth\LoginRequest;
use App\Platform\Identity\Models\EmailOneTimeCode;
use App\Platform\Identity\Services\DeviceTrustService;
use App\Platform\Identity\Services\EmailOtpService;
use App\Platform\Identity\Support\UserAgentParser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

final class AuthenticatedSessionController extends Controller
{
    public function create(): Response
    {
        return Inertia::render('auth/login', ['status' => session('status')]);
    }

    public function store(
        LoginRequest $request,
        EmailOtpService $otpService,
        DeviceTrustService $trustService,
        RecordAuditEvent $audit,
    ): RedirectResponse {
        $user = $request->validateCredentials();

        // Check whether this browser is already trusted for this user
        $trustCookie = $request->cookie(DeviceTrustService::COOKIE_NAME);
        $trustedDevice = $trustService->verifyTrust($user, is_string($trustCookie) ? $trustCookie : null);

        if ($user->requiresDeviceVerification() && ! $trustedDevice) {
            $result = $otpService->generateCode(
                user: $user,
                purpose: EmailOneTimeCode::PURPOSE_LOGIN,
                ip: $request->ip(),
            );

            $request->session()->put('login.two_factor', [
                'user_id' => $user->id,
                'challenge_id' => $result['challenge_id'],
                'remember' => $request->boolean('remember'),
                'expires_at' => now()->addMinutes(5)->timestamp,
            ]);

            return redirect()->route('login.challenge');
        }

        Auth::login($user, false);
        $request->session()->regenerate();
        ValidateActiveSession::track($user, $request);

        $deviceInfo = UserAgentParser::parse($request->userAgent());
        $audit->handle($user, $user, 'user.login', null, [
            'auth_type' => $trustedDevice ? 'trusted_device' : 'password',
            'device' => $deviceInfo['label'],
            'user_agent' => $request->userAgent(),
            'outcome' => 'success',
        ]);

        return redirect()->intended(route('home', absolute: false));
    }

    public function destroy(
        Request $request,
        RecordAuditEvent $audit,
        DeviceTrustService $trustService,
    ): RedirectResponse {
        $user = $request->user();
        if ($user) {
            $deviceInfo = UserAgentParser::parse($request->userAgent());
            $audit->handle($user, $user, 'user.logout', null, [
                'device' => $deviceInfo['label'],
                'user_agent' => $request->userAgent(),
                'outcome' => 'success',
            ]);
        }

        $forgetDevice = $request->boolean('forget_device');
        if ($user && $forgetDevice) {
            $trustCookie = $request->cookie(DeviceTrustService::COOKIE_NAME);
            if (is_string($trustCookie) && $trustCookie !== '') {
                $trustService->revokeByToken($user, $trustCookie);
            }
        }

        ValidateActiveSession::forget($request);
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        $response = redirect()->route('login');
        if ($forgetDevice) {
            $response->withoutCookie(DeviceTrustService::COOKIE_NAME);
        }

        return $response;
    }
}
