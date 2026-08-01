<?php

namespace App\Platform\Identity\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Platform\Identity\Http\Resources\V1\UserResource;
use App\Platform\Identity\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

final class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
            'device_name' => ['nullable', 'string', 'max:255'],
        ]);

        $email = Str::lower($validated['email']);
        $throttleKey = Str::transliterate($email.'|'.$request->ip());

        if (RateLimiter::tooManyAttempts($throttleKey, 5)) {
            $seconds = RateLimiter::availableIn($throttleKey);

            return response()->json([
                'message' => "Too many login attempts. Try again in {$seconds} seconds.",
            ], Response::HTTP_TOO_MANY_REQUESTS);
        }

        $user = User::query()->where('email', $email)->first();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            RateLimiter::hit($throttleKey);

            return response()->json([
                'message' => 'The provided credentials are invalid.',
                'errors' => [
                    'email' => ['The provided credentials are invalid.'],
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
