<?php

namespace App\Platform\Identity\Http\Middleware;

use App\Platform\Identity\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class ValidateActiveSession
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user('web');

        if ($user && $request->hasSession()) {
            $sessionId = $request->session()->getId();
            $trackedSessionId = $request->session()->get('active_session_id');

            if ($trackedSessionId) {
                // Check if this previously tracked session was revoked from the database
                $exists = DB::table('sessions')
                    ->where('id', $trackedSessionId)
                    ->where('user_id', $user->id)
                    ->exists();

                if (! $exists) {
                    Auth::guard('web')->logout();
                    $request->session()->invalidate();
                    $request->session()->regenerateToken();

                    if ($request->expectsJson()) {
                        return response()->json([
                            'message' => 'Your session has ended or was revoked from another device.',
                            'error' => 'session_revoked',
                        ], 401);
                    }

                    return redirect()->route('login')->with('flash', [
                        'tone' => 'warning',
                        'message' => 'Your session has ended or was revoked from another device. Please sign in again.',
                    ]);
                }

                // If session ID was rotated, align database record and session
                if ($sessionId !== $trackedSessionId) {
                    DB::table('sessions')
                        ->where('id', $trackedSessionId)
                        ->update(['id' => $sessionId]);
                    $request->session()->put('active_session_id', $sessionId);
                }

                // Refresh last_activity every 30 seconds
                DB::table('sessions')
                    ->where('id', $sessionId)
                    ->where('last_activity', '<', time() - 30)
                    ->update([
                        'ip_address' => $request->ip(),
                        'user_agent' => $request->userAgent(),
                        'last_activity' => time(),
                    ]);
            } else {
                // First request for this session -> track it
                static::track($user, $request);
            }
        }

        return $next($request);
    }

    /**
     * Ensure session is tracked in the database upon authentication.
     */
    public static function track(User $user, Request $request): void
    {
        if (! $request->hasSession()) {
            return;
        }

        $sessionId = $request->session()->getId();

        DB::table('sessions')->updateOrInsert(
            ['id' => $sessionId],
            [
                'user_id' => $user->id,
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'payload' => '',
                'last_activity' => time(),
            ]
        );

        $request->session()->put('active_session_id', $sessionId);
    }

    /**
     * Remove session from tracking upon logout.
     */
    public static function forget(Request $request): void
    {
        if (! $request->hasSession()) {
            return;
        }

        $sessionId = $request->session()->getId();
        DB::table('sessions')->where('id', $sessionId)->delete();
        $request->session()->forget('active_session_id');
    }
}
