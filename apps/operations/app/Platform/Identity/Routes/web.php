<?php

use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Http\Controllers\AccountSecurityController;
use App\Platform\Identity\Http\Controllers\AccountSettingsController;
use App\Platform\Identity\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Platform\Identity\Http\Controllers\Auth\EmailVerificationController;
use App\Platform\Identity\Http\Controllers\Auth\NewPasswordController;
use App\Platform\Identity\Http\Controllers\Auth\PasswordResetLinkController;
use App\Platform\Identity\Http\Controllers\Auth\TwoFactorChallengeController;
use App\Platform\Identity\Http\Controllers\PersonnelController;
use App\Platform\Identity\Http\Controllers\UserManagementController;
use App\Platform\Identity\Http\Middleware\ValidateActiveSession;
use App\Platform\Identity\Models\EmailOneTimeCode;
use App\Platform\Identity\Models\User;
use App\Platform\Identity\Services\EmailOtpService;
use App\Platform\Workspace\Http\Controllers\OperationsWorkspaceController;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;

Route::middleware('guest')->group(function (): void {
    Route::get('/login', [AuthenticatedSessionController::class, 'create'])->name('login');
    Route::post('/login', [AuthenticatedSessionController::class, 'store'])->middleware('throttle:login');
    Route::get('/login/challenge', [TwoFactorChallengeController::class, 'create'])->name('login.challenge');
    Route::post('/login/challenge', [TwoFactorChallengeController::class, 'store'])->middleware('throttle:10,1');
    Route::post('/login/challenge/resend', [TwoFactorChallengeController::class, 'resend'])
        ->middleware('throttle:5,1')
        ->name('login.challenge.resend');

    Route::get('/forgot-password', [PasswordResetLinkController::class, 'create'])->name('password.request');
    Route::post('/forgot-password', [PasswordResetLinkController::class, 'store'])->middleware('throttle:password-reset')->name('password.email');
    Route::get('/reset-password/{token}', [NewPasswordController::class, 'create'])->name('password.reset');
    Route::post('/reset-password', [NewPasswordController::class, 'store'])->middleware('throttle:password-reset')->name('password.store');
});

Route::middleware(['auth', 'active', ValidateActiveSession::class])->group(function (): void {
    Route::post('/logout', [AuthenticatedSessionController::class, 'destroy'])->name('logout');
    Route::get('/verify-email', [EmailVerificationController::class, 'notice'])->name('verification.notice');
    Route::get('/verify-email/{id}/{hash}', [EmailVerificationController::class, 'verify'])
        ->middleware(['signed', 'throttle:6,1'])->name('verification.verify');
    Route::post('/email/verification-notification', [EmailVerificationController::class, 'resend'])
        ->middleware('throttle:6,1')->name('verification.send');
    Route::get('/', OperationsWorkspaceController::class)->middleware('verified')->name('home');
    Route::get('/operations', OperationsWorkspaceController::class)->middleware('verified')->name('operations');

    // Account settings
    Route::get('/account', [AccountSettingsController::class, 'index'])->name('account.settings');
    Route::get('/settings', [AccountSettingsController::class, 'index'])->name('settings');
    Route::patch('/account/profile', [AccountSettingsController::class, 'updateProfile'])->name('account.profile.update');
    Route::post('/account/email/request', [AccountSettingsController::class, 'requestEmailChange'])
        ->middleware('throttle:5,1')
        ->name('account.email.request');
    Route::post('/account/email/verify', [AccountSettingsController::class, 'verifyEmailChange'])
        ->middleware('throttle:10,1')
        ->name('account.email.verify');
    Route::post('/account/password', [AccountSettingsController::class, 'updatePassword'])
        ->middleware('throttle:5,1')
        ->name('account.password.update');

    // Security & OTP settings
    Route::post('/account/security/otp/request-enable', [AccountSecurityController::class, 'requestEnableOtp'])
        ->middleware('throttle:5,1')
        ->name('account.otp.request_enable');
    Route::post('/account/security/otp/confirm-enable', [AccountSecurityController::class, 'confirmEnableOtp'])
        ->middleware('throttle:10,1')
        ->name('account.otp.confirm_enable');
    Route::post('/account/security/otp/request-disable', [AccountSecurityController::class, 'requestDisableOtp'])
        ->middleware('throttle:5,1')
        ->name('account.otp.request_disable');
    Route::post('/account/security/otp/confirm-disable', [AccountSecurityController::class, 'confirmDisableOtp'])
        ->middleware('throttle:10,1')
        ->name('account.otp.confirm_disable');
    Route::post('/account/security/otp/resend', [AccountSecurityController::class, 'resendOtp'])
        ->middleware('throttle:5,1')
        ->name('account.otp.resend');

    // Sign-in activity & sessions
    Route::delete('/account/sessions/{session}', [AccountSecurityController::class, 'revokeSession'])
        ->name('account.sessions.revoke');
    Route::post('/account/sessions/revoke-others', [AccountSecurityController::class, 'revokeOtherSessions'])
        ->middleware('throttle:5,1')
        ->name('account.sessions.revoke_others');

    // Trusted devices
    Route::delete('/account/trusted-devices/{deviceId}', [AccountSecurityController::class, 'revokeTrustedDevice'])
        ->name('account.trusted_devices.revoke');
    Route::post('/account/trusted-devices/revoke-all', [AccountSecurityController::class, 'revokeAllTrustedDevices'])
        ->middleware('throttle:5,1')
        ->name('account.trusted_devices.revoke_all');
    Route::post('/account/trusted-devices/{deviceId}/lost', [AccountSecurityController::class, 'markDeviceLost'])
        ->middleware('throttle:5,1')
        ->name('account.trusted_devices.mark_lost');
});

Route::middleware(['auth', 'active', ValidateActiveSession::class, 'verified', 'throttle:120,1'])->prefix('operations')->group(function (): void {
    Route::get('/users', [UserManagementController::class, 'index']);
    Route::post('/users', [UserManagementController::class, 'store']);
    Route::patch('/users/{user}', [UserManagementController::class, 'update']);
    Route::post('/users/{user}/reset-password', [UserManagementController::class, 'resetPassword']);
    Route::patch('/users/{user}/personnel-profile', [PersonnelController::class, 'updateProfile']);
    Route::post('/users/{user}/credentials', [PersonnelController::class, 'storeCredential']);
    Route::delete('/users/{user}/credentials/{credential}', [PersonnelController::class, 'destroyCredential']);
});

if (app()->environment(['local', 'testing'])) {
    Route::get('/dev/users', function () {
        return response()->json(
            User::query()
                ->whereIn('email', [
                    'admin@example.com',
                    'manager@example.com',
                ])
                ->role([
                    RoleName::SystemAdministrator->value,
                    RoleName::OperationsManager->value,
                ])
                ->with('roles')
                ->select('id', 'name', 'email')
                ->where('is_active', true)
                ->whereNull('suspended_at')
                ->whereNotNull('email_verified_at')
                ->orderBy('name')
                ->get()
                ->map(static fn (User $user): array => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role_label' => $user->operationalRole()?->label(),
                ])
                ->values(),
        );
    });

    Route::post('/dev/login/{user}', function (User $user) {
        abort_unless(
            $user->is_active
            && $user->suspended_at === null
            && $user->hasVerifiedEmail()
            && in_array($user->email, [
                'admin@example.com',
                'manager@example.com',
            ], true)
            && $user->hasAnyRole([
                RoleName::SystemAdministrator->value,
                RoleName::OperationsManager->value,
            ]),
            404,
        );

        if ($user->email_otp_enabled) {
            $otpService = app(EmailOtpService::class);
            $result = $otpService->generateCode(
                user: $user,
                purpose: EmailOneTimeCode::PURPOSE_LOGIN,
            );

            request()->session()->put('login.two_factor', [
                'user_id' => $user->id,
                'challenge_id' => $result['challenge_id'],
                'remember' => false,
                'expires_at' => now()->addMinutes(5)->timestamp,
            ]);

            return redirect()->route('login.challenge');
        }

        Auth::login($user);
        request()->session()->regenerate();
        ValidateActiveSession::track($user, request());

        return redirect()->route('home');
    })->whereNumber('user');
}
