<?php

namespace App\Platform\Identity\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Platform\Identity\Http\Resources\V1\UserResource;
use App\Platform\Identity\Models\EmailOneTimeCode;
use App\Platform\Identity\Models\User;
use App\Platform\Identity\Services\DeviceTrustService;
use App\Platform\Identity\Services\EmailOtpService;
use App\Platform\Identity\Support\Username;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

final class AuthController extends Controller
{
    public function login(
        Request $request,
        EmailOtpService $otpService,
        DeviceTrustService $trustService,
    ): JsonResponse {
        $username = $request->input('username');
        $email = $request->input('email');

        $request->merge([
            'username' => is_string($username) ? Username::normalize($username) : $username,
            'email' => is_string($email) && trim($email) !== ''
                ? Str::lower(trim($email))
                : $email,
        ]);

        $legacyEmailLogin = $request->filled('email') && ! $request->filled('username');

        if ($request->filled('email') && $request->filled('username')) {
            throw ValidationException::withMessages([
                'username' => 'Provide either a username or an email address, not both.',
            ]);
        }

        if ($legacyEmailLogin && ! $this->legacyEmailLoginIsEnabled()) {
            return response()->json([
                'message' => 'Username login is required for new mobile clients.',
                'errors' => [
                    'username' => ['Username login is required.'],
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $validated = $request->validate([
            'username' => ['nullable', ...Username::validationRules(), 'required_without:email'],
            'email' => ['nullable', 'string', 'email', 'max:255', 'required_without:username'],
            'password' => ['required', 'string'],
            'device_name' => ['nullable', 'string', 'max:255'],
            'device_trust_token' => ['nullable', 'string'],
        ]);

        $legacyEmailLogin = filled($validated['email'] ?? null);
        $credentialField = $legacyEmailLogin ? 'email' : 'username';
        $identifier = $legacyEmailLogin
            ? (string) $validated['email']
            : (string) $validated['username'];
        $throttleKey = Str::transliterate($identifier.'|'.$request->ip());

        if (RateLimiter::tooManyAttempts($throttleKey, 5)) {
            $seconds = RateLimiter::availableIn($throttleKey);

            return response()->json([
                'message' => "Too many login attempts. Try again in {$seconds} seconds.",
            ], Response::HTTP_TOO_MANY_REQUESTS);
        }

        $user = User::query()
            ->where($legacyEmailLogin ? 'email' : 'username', $identifier)
            ->first();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            RateLimiter::hit($throttleKey);

            return response()->json([
                'message' => 'The provided credentials are invalid.',
                'errors' => [
                    $credentialField => ['The provided credentials are invalid.'],
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if (! $user->is_active || $user->suspended_at !== null) {
            RateLimiter::hit($throttleKey);

            return response()->json([
                'message' => 'This account is suspended. Contact a system administrator.',
            ], Response::HTTP_FORBIDDEN);
        }

        if (! $user->hasVerifiedEmail()) {
            RateLimiter::hit($throttleKey);

            return response()->json([
                'message' => 'Your email address is not verified.',
            ], Response::HTTP_FORBIDDEN);
        }

        RateLimiter::clear($throttleKey);

        // Check if device is recognized and trusted for this user
        $trustToken = $request->input('device_trust_token') ?? $request->header('X-Device-Trust');
        $trustedDevice = $trustService->verifyTrust($user, is_string($trustToken) ? $trustToken : null);

        // If user is enrolled in device verification and device is not trusted: require verification
        if ($user->requiresDeviceVerification() && ! $trustedDevice) {
            if ($request->header('X-Legacy-Client') === 'true') {
                return response()->json([
                    'message' => 'Device verification is required. Please update the field mobile application.',
                    'error' => 'client_upgrade_required',
                ], Response::HTTP_UPGRADE_REQUIRED);
            }

            $result = $otpService->generateCode(
                user: $user,
                purpose: EmailOneTimeCode::PURPOSE_LOGIN,
                ip: $request->ip(),
            );

            $emailParts = explode('@', $user->email);
            $namePart = $emailParts[0];
            $domainPart = $emailParts[1] ?? '';
            $maskedName = strlen($namePart) > 2
                ? substr($namePart, 0, 2).str_repeat('*', max(1, strlen($namePart) - 3)).substr($namePart, -1)
                : $namePart.'*';
            $obfuscatedEmail = $maskedName.'@'.$domainPart;

            return response()->json([
                'requires_verification' => true,
                'challenge_id' => $result['challenge_id'],
                'email_obfuscated' => $obfuscatedEmail,
                'expires_in_seconds' => 300,
                'cooldown_seconds' => 45,
            ]);
        }

        $deviceName = ! empty($validated['device_name'])
            ? (string) $validated['device_name']
            : 'React Native Field Mobile';

        $token = $user->createToken($deviceName)->plainTextToken;

        return response()->json([
            'requires_verification' => false,
            'data' => [
                'token' => $token,
                'user' => new UserResource($user),
            ],
        ]);
    }

    public function verifyChallenge(
        Request $request,
        EmailOtpService $otpService,
        DeviceTrustService $trustService,
    ): JsonResponse {
        $validated = $request->validate([
            'challenge_id' => ['required', 'string'],
            'code' => ['required', 'string', 'digits:6'],
            'trust_device' => ['sometimes', 'boolean'],
            'device_name' => ['nullable', 'string', 'max:255'],
        ]);

        /** @var EmailOneTimeCode|null $record */
        $record = EmailOneTimeCode::query()
            ->where('challenge_id', $validated['challenge_id'])
            ->where('purpose', EmailOneTimeCode::PURPOSE_LOGIN)
            ->first();

        if (! $record) {
            return response()->json([
                'message' => 'The verification challenge was not found or has expired.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        /** @var User|null $user */
        $user = $record->user;

        // Recheck account eligibility
        if (! $user || ! $user->is_active || $user->suspended_at !== null) {
            return response()->json([
                'message' => 'This account is suspended. Contact a system administrator.',
            ], Response::HTTP_FORBIDDEN);
        }

        if (! $user->hasVerifiedEmail()) {
            return response()->json([
                'message' => 'Your email address is not verified.',
            ], Response::HTTP_FORBIDDEN);
        }

        $otpService->verifyCode(
            user: $user,
            purpose: EmailOneTimeCode::PURPOSE_LOGIN,
            challengeId: $validated['challenge_id'],
            code: $validated['code'],
            ip: $request->ip(),
        );

        $deviceName = ! empty($validated['device_name'])
            ? (string) $validated['device_name']
            : 'React Native Field Mobile';

        $trustToken = null;
        if ($request->boolean('trust_device')) {
            $issued = $trustService->issueTrust($user, $request, 'mobile', $deviceName);
            $trustToken = $issued['token'];
        }

        $token = $user->createToken($deviceName)->plainTextToken;

        return response()->json([
            'data' => [
                'token' => $token,
                'user' => new UserResource($user),
                'trust_token' => $trustToken,
                'device_trust_token' => $trustToken,
            ],
        ]);
    }

    public function resendChallenge(
        Request $request,
        EmailOtpService $otpService,
    ): JsonResponse {
        $validated = $request->validate([
            'challenge_id' => ['required', 'string'],
        ]);

        /** @var EmailOneTimeCode|null $record */
        $record = EmailOneTimeCode::query()
            ->where('challenge_id', $validated['challenge_id'])
            ->where('purpose', EmailOneTimeCode::PURPOSE_LOGIN)
            ->first();

        if (! $record) {
            return response()->json([
                'message' => 'The verification challenge was not found or has expired.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        /** @var User|null $user */
        $user = $record->user;

        if (! $user || ! $user->is_active || $user->suspended_at !== null || ! $user->hasVerifiedEmail()) {
            return response()->json([
                'message' => 'This account is not eligible for verification.',
            ], Response::HTTP_FORBIDDEN);
        }

        $result = $otpService->resendCode(
            user: $user,
            purpose: EmailOneTimeCode::PURPOSE_LOGIN,
            challengeId: $validated['challenge_id'],
            ip: $request->ip(),
        );

        return response()->json([
            'message' => 'A new verification code has been sent to your email.',
            'challenge_id' => $result['challenge_id'],
            'expires_in_seconds' => 300,
            'cooldown_seconds' => 45,
        ]);
    }

    private function legacyEmailLoginIsEnabled(): bool
    {
        $until = config('auth.legacy_email_login_until');

        return is_string($until)
            && CarbonImmutable::now()->lessThanOrEqualTo(CarbonImmutable::parse($until)->endOfDay());
    }

    public function logout(Request $request, DeviceTrustService $trustService): JsonResponse
    {
        $user = $request->user();

        if ($user !== null) {
            // If requested, also forget device trust
            $forgetDevice = $request->boolean('forget_device') || $request->hasHeader('X-Forget-Device');
            if ($forgetDevice) {
                $trustToken = $request->input('device_trust_token') ?? $request->header('X-Device-Trust');
                if (is_string($trustToken) && $trustToken !== '') {
                    $trustService->revokeByToken($user, $trustToken);
                }
            }

            $user->currentAccessToken()->delete();
        }

        return response()->json([
            'message' => 'Successfully logged out and revoked device token.',
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json([
            'data' => new UserResource($user),
        ]);
    }
}
