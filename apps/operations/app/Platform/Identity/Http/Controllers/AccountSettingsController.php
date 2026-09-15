<?php

namespace App\Platform\Identity\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Http\Middleware\ValidateActiveSession;
use App\Platform\Identity\Models\EmailOneTimeCode;
use App\Platform\Identity\Models\User;
use App\Platform\Identity\Services\DeviceTrustService;
use App\Platform\Identity\Services\EmailOtpService;
use App\Platform\Identity\Support\IpLocationResolver;
use App\Platform\Identity\Support\UserAgentParser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

final class AccountSettingsController extends Controller
{
    public function index(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();
        $role = $user->operationalRole();
        $permissions = $user->getAllPermissions()->pluck('name')->sort()->values()->all();

        // Query active web sessions for this user
        $currentSessionId = $request->session()->getId();
        $sessions = DB::table('sessions')
            ->where('user_id', $user->id)
            ->orderByDesc('last_activity')
            ->get();

        $sessionsData = $sessions->map(function ($s) use ($currentSessionId): array {
            $parsed = UserAgentParser::parse($s->user_agent);

            return [
                'id' => (string) $s->id,
                'is_current' => $s->id === $currentSessionId,
                'ip_address' => $s->ip_address ?: 'Unknown IP',
                'browser' => $parsed['browser'],
                'platform' => $parsed['platform'],
                'device_type' => $parsed['device_type'],
                'device_label' => $parsed['label'],
                'location' => IpLocationResolver::resolve($s->ip_address),
                'last_active_at' => Carbon::createFromTimestamp($s->last_activity)->toIso8601String(),
                'last_active_human' => Carbon::createFromTimestamp($s->last_activity)->diffForHumans(),
            ];
        })->values()->all();

        // Query active trusted devices for this user
        $currentTrustCookie = $request->cookie(DeviceTrustService::COOKIE_NAME);
        $currentTrustCookieStr = is_string($currentTrustCookie) && $currentTrustCookie !== '' ? $currentTrustCookie : null;
        $currentTrustHash = $currentTrustCookieStr !== null ? hash('sha256', $currentTrustCookieStr) : null;
        $trustedDevicesData = $user->trustedDevices()
            ->active()
            ->orderByDesc('last_used_at')
            ->get()
            ->map(function ($d) use ($currentTrustHash): array {
                return [
                    'id' => $d->device_id,
                    'device_label' => $d->device_label,
                    'platform' => $d->platform,
                    'ip_address' => $d->ip_address ?: 'Unknown IP',
                    'location' => IpLocationResolver::resolve($d->ip_address),
                    'is_current' => $currentTrustHash !== null && hash_equals($d->device_key_hash, $currentTrustHash),
                    'last_used_at' => $d->last_used_at?->toIso8601String(),
                    'last_used_human' => $d->last_used_at?->diffForHumans() ?? 'Never',
                    'expires_at' => $d->expires_at->toIso8601String(),
                    'expires_human' => $d->expires_at->diffForHumans(),
                ];
            })->values()->all();

        // Paginated security events from immutable audit_events
        $recentActivity = AuditEvent::query()
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
            ])
            ->orderByDesc('occurred_at')
            ->orderByDesc('id')
            ->paginate(10)
            ->through(function (AuditEvent $event): array {
                /** @var array<string, mixed> $after */
                $after = is_array($event->after) ? $event->after : [];
                $actionLabels = [
                    'user.login' => 'Signed in',
                    'user.logout' => 'Signed out',
                    'user.password_changed' => 'Password changed',
                    'user.email_otp_enabled' => 'Email code sign-in enabled',
                    'user.email_otp_disabled' => 'Email code sign-in disabled',
                    'user.session_revoked' => 'Web session revoked',
                    'user.other_sessions_revoked' => 'Other web sessions revoked',
                    'user.email_updated' => 'Email address updated',
                    'user.profile_updated' => 'Contact details updated',
                ];

                $outcome = isset($after['outcome']) && is_string($after['outcome']) ? $after['outcome'] : 'success';
                $device = isset($after['device']) && is_string($after['device']) ? $after['device'] : null;
                $userAgent = isset($after['user_agent']) && is_string($after['user_agent']) ? $after['user_agent'] : null;
                $deviceLabel = $device ?? ($userAgent !== null ? UserAgentParser::parse($userAgent)['label'] : 'Web Browser');

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

        return Inertia::render('account', [
            'profile' => [
                'name' => $user->name,
                'username' => $user->username,
                'email' => $user->email,
                'email_verified' => $user->hasVerifiedEmail(),
                'phone' => $user->phone,
                'role' => $role?->value,
                'role_label' => $role?->label() ?? 'No Role Assigned',
                'account_status' => $user->suspended_at !== null ? 'suspended' : ($user->is_active ? 'active' : 'inactive'),
                'account_status_label' => $user->suspended_at !== null ? 'Suspended' : ($user->is_active ? 'Active' : 'Inactive'),
                'permissions' => $permissions,
            ],
            'security' => [
                'email_otp_enabled' => (bool) $user->email_otp_enabled,
                'has_verified_email' => $user->hasVerifiedEmail(),
            ],
            'trusted_devices' => $trustedDevicesData,
            'sessions' => $sessionsData,
            'recent_activity' => $recentActivity,
            'current_tab' => $request->query('tab', 'profile'),
            'status' => session('status'),
            'challenge_id' => session('challenge_id'),
            'otp_challenge_id' => session('otp_challenge_id'),
            'otp_action' => session('otp_action'),
        ]);
    }

    public function updateProfile(Request $request, RecordAuditEvent $audit): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'phone' => ['nullable', 'string', 'max:32'],
        ]);

        $beforePhone = $user->phone;
        $user->update([
            'phone' => $validated['phone'] ?? null,
        ]);

        $audit->handle($user, $user, 'user.profile_updated', ['phone' => $beforePhone], [
            'phone' => $user->phone,
            'outcome' => 'success',
        ]);

        return back()->with('status', 'Profile contact details updated successfully.');
    }

    public function requestEmailChange(Request $request, EmailOtpService $otpService): JsonResponse|RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'current_password' => ['required', 'string', 'current_password:web'],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
        ]);

        $newEmail = Str::lower(trim($validated['email']));
        if ($newEmail === $user->email) {
            throw ValidationException::withMessages([
                'email' => 'The new email address must be different from your current email address.',
            ]);
        }

        $result = $otpService->generateCode(
            user: $user,
            purpose: EmailOneTimeCode::PURPOSE_EMAIL_CHANGE,
            destinationEmail: $newEmail,
            metadata: ['new_email' => $newEmail],
            ip: $request->ip(),
        );

        if ($request->wantsJson()) {
            return response()->json([
                'message' => 'A verification code has been sent to your new email address.',
                'challenge_id' => $result['challenge_id'],
                'cooldown_seconds' => $result['cooldown_seconds'],
            ]);
        }

        return back()->with([
            'status' => 'A verification code has been sent to your new email address.',
            'challenge_id' => $result['challenge_id'],
        ]);
    }

    public function verifyEmailChange(
        Request $request,
        EmailOtpService $otpService,
        RecordAuditEvent $audit,
    ): RedirectResponse|JsonResponse {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'challenge_id' => ['required', 'string'],
            'code' => ['required', 'string', 'digits:6'],
        ]);

        $codeRecord = $otpService->verifyCode(
            user: $user,
            purpose: EmailOneTimeCode::PURPOSE_EMAIL_CHANGE,
            challengeId: $validated['challenge_id'],
            code: $validated['code'],
            ip: $request->ip(),
        );

        $newEmail = $codeRecord->metadata['new_email'] ?? null;
        if (! is_string($newEmail) || ! filter_var($newEmail, FILTER_VALIDATE_EMAIL)) {
            throw ValidationException::withMessages([
                'code' => 'Invalid email update payload. Please restart email change.',
            ]);
        }

        if (User::query()->where('email', $newEmail)->where('id', '!=', $user->id)->exists()) {
            throw ValidationException::withMessages([
                'email' => 'The email address has already been taken by another user.',
            ]);
        }

        $oldEmail = $user->email;
        $user->update([
            'email' => $newEmail,
            'email_verified_at' => now(),
        ]);

        // Invalidate affected trust and pending challenges
        $user->trustedDevices()->delete();
        EmailOneTimeCode::query()->where('user_id', $user->id)->delete();

        // Notify the old email address
        try {
            Mail::raw(
                "Your Core-2 account email address was changed to {$newEmail}. If you did not make this change, please contact an administrator immediately.",
                fn ($m) => $m->to($oldEmail)->subject('Core-2 Security Notice: Account Email Updated')
            );
        } catch (\Throwable) {
            // Log delivery failure gracefully
        }

        $deviceInfo = UserAgentParser::parse($request->userAgent());
        $audit->handle($user, $user, 'user.email_updated', ['email' => $oldEmail], [
            'email' => $newEmail,
            'device' => $deviceInfo['label'],
            'user_agent' => $request->userAgent(),
            'outcome' => 'success',
        ]);

        if ($request->wantsJson()) {
            return response()->json([
                'message' => 'Your email address has been updated and verified successfully.',
            ]);
        }

        return back()->with('status', 'Your email address has been updated and verified successfully.');
    }

    public function updatePassword(Request $request, RecordAuditEvent $audit): JsonResponse|RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'current_password' => ['required', 'string', 'max:255', 'current_password:web'],
            'password' => ['required', 'string', 'max:255', 'confirmed', Password::defaults(), 'different:current_password'],
        ]);

        // Rotate current session and track new session ID atomically with revocations
        $request->session()->regenerate();
        $newSessionId = $request->session()->getId();

        DB::transaction(function () use ($user, $validated, $request, $newSessionId): void {
            $user->forceFill([
                'password' => Hash::make($validated['password']),
                'remember_token' => null,
            ])->save();

            // Revoke device trust
            $user->trustedDevices()->delete();

            // Revoke pending OTP challenges
            EmailOneTimeCode::query()->where('user_id', $user->id)->delete();

            // Track active session and revoke all other web sessions and remember-me access
            ValidateActiveSession::track($user, $request);

            DB::table('sessions')
                ->where('user_id', $user->id)
                ->where('id', '!=', $newSessionId)
                ->delete();
        });

        // Note: Existing mobile and API personal access tokens remain active
        // to prevent operational disruptions for field crane and dispatch workers.
        $deviceInfo = UserAgentParser::parse($request->userAgent());
        $audit->handle($user, $user, 'user.password_changed', null, [
            'sessions_revoked' => true,
            'mobile_tokens_preserved' => true,
            'trust_revoked' => true,
            'device' => $deviceInfo['label'],
            'user_agent' => $request->userAgent(),
            'outcome' => 'success',
        ]);

        if ($request->wantsJson()) {
            return response()->json([
                'message' => 'Your password has been changed. All other sessions and device trust have been revoked.',
            ])->withoutCookie(DeviceTrustService::COOKIE_NAME);
        }

        return back()
            ->with('status', 'Your password has been changed. All other sessions and device trust have been revoked.')
            ->withoutCookie(DeviceTrustService::COOKIE_NAME);
    }
}
