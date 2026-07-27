<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

final class EnsurePersonalAccessToken
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->user()?->currentAccessToken() instanceof PersonalAccessToken) {
            return response()->json([
                'message' => 'A bearer device token is required for this API.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        return $next($request);
    }
}
