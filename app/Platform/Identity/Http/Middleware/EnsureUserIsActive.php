<?php

namespace App\Platform\Identity\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

final class EnsureUserIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user !== null && (! $user->is_active || $user->suspended_at !== null)) {
            if ($request->expectsJson() || $request->is('api/*')) {
                return response()->json([
                    'message' => 'This account is suspended. Contact a system administrator.',
                    'error' => 'account_suspended',
                ], Response::HTTP_FORBIDDEN);
            }

            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return redirect()->route('login')->withErrors([
                'email' => 'This account is suspended. Contact a system administrator.',
            ]);
        }

        return $next($request);
    }
}
