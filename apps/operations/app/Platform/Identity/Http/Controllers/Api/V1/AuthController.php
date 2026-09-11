<?php

namespace App\Platform\Identity\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Platform\Identity\Http\Resources\V1\UserResource;
use App\Platform\Identity\Models\User;
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
    public function login(Request $request): JsonResponse
    {
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

        $deviceName = ! empty($validated['device_name'])
            ? (string) $validated['device_name']
            : 'React Native Field Mobile';

        $token = $user->createToken($deviceName)->plainTextToken;

        return response()->json([
            'data' => [
                'token' => $token,
                'user' => new UserResource($user),
            ],
        ]);
    }

    private function legacyEmailLoginIsEnabled(): bool
    {
        $until = config('auth.legacy_email_login_until');

        return is_string($until)
            && CarbonImmutable::now()->lessThanOrEqualTo(CarbonImmutable::parse($until)->endOfDay());
    }

    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user !== null) {
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
