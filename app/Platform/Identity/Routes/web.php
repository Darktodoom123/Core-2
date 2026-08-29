<?php

use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Platform\Identity\Http\Controllers\Auth\EmailVerificationController;
use App\Platform\Identity\Http\Controllers\Auth\NewPasswordController;
use App\Platform\Identity\Http\Controllers\Auth\PasswordResetLinkController;
use App\Platform\Identity\Http\Controllers\PersonnelController;
use App\Platform\Identity\Http\Controllers\UserManagementController;
use App\Platform\Identity\Models\User;
use App\Platform\Workspace\Http\Controllers\OperationsWorkspaceController;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;

Route::middleware('guest')->group(function (): void {
    Route::get('/login', [AuthenticatedSessionController::class, 'create'])->name('login');
    Route::post('/login', [AuthenticatedSessionController::class, 'store']);
    Route::get('/forgot-password', [PasswordResetLinkController::class, 'create'])->name('password.request');
    Route::post('/forgot-password', [PasswordResetLinkController::class, 'store'])->middleware('throttle:5,1')->name('password.email');
    Route::get('/reset-password/{token}', [NewPasswordController::class, 'create'])->name('password.reset');
    Route::post('/reset-password', [NewPasswordController::class, 'store'])->name('password.store');
});

Route::middleware(['auth', 'active'])->group(function (): void {
    Route::post('/logout', [AuthenticatedSessionController::class, 'destroy'])->name('logout');
    Route::get('/verify-email', [EmailVerificationController::class, 'notice'])->name('verification.notice');
    Route::get('/verify-email/{id}/{hash}', [EmailVerificationController::class, 'verify'])
        ->middleware(['signed', 'throttle:6,1'])->name('verification.verify');
    Route::post('/email/verification-notification', [EmailVerificationController::class, 'resend'])
        ->middleware('throttle:6,1')->name('verification.send');
    Route::get('/', OperationsWorkspaceController::class)->middleware('verified')->name('home');
    Route::get('/operations', OperationsWorkspaceController::class)->middleware('verified')->name('operations');
});

Route::middleware(['auth', 'active', 'verified', 'throttle:120,1'])->prefix('operations')->group(function (): void {
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
                    'so.morales@core2.ph',
                    'foreman.delacruz@core2.ph',
                    'operator@example.com',
                ])
                ->role([
                    RoleName::SystemAdministrator->value,
                    RoleName::OperationsManager->value,
                    RoleName::SafetyOfficer->value,
                    RoleName::FieldForeman->value,
                    RoleName::CraneOperator->value,
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
                'so.morales@core2.ph',
                'foreman.delacruz@core2.ph',
                'operator@example.com',
            ], true)
            && $user->hasAnyRole([
                RoleName::SystemAdministrator->value,
                RoleName::OperationsManager->value,
                RoleName::SafetyOfficer->value,
                RoleName::FieldForeman->value,
                RoleName::CraneOperator->value,
            ]),
            404,
        );

        Auth::login($user);
        request()->session()->regenerate();

        return redirect()->route('home');
    })->whereNumber('user');
}
