<?php

use App\Platform\Identity\Http\Controllers\Api\V1\AccountApiController;
use App\Platform\Identity\Http\Controllers\Api\V1\AccountSecurityApiController;
use App\Platform\Identity\Http\Controllers\Api\V1\AuthController;
use App\Platform\Identity\Http\Controllers\Api\V1\DeviceTokenController;
use App\Platform\Identity\Http\Controllers\Api\V1\PersonnelCredentialController;
use App\Platform\Identity\Http\Resources\V1\UserResource;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return response()->json(['data' => new UserResource($request->user())]);
})->middleware(['auth:sanctum', 'active', 'throttle:120,1']);

Route::prefix('v1')->name('api.v1.')->group(function () {
    Route::post('/auth/login', [AuthController::class, 'login'])
        ->middleware('throttle:login')
        ->name('auth.login');

    Route::post('/auth/challenge/verify', [AuthController::class, 'verifyChallenge'])
        ->middleware('throttle:login')
        ->name('auth.challenge.verify');

    Route::post('/auth/challenge/resend', [AuthController::class, 'resendChallenge'])
        ->middleware('throttle:login')
        ->name('auth.challenge.resend');

    Route::middleware(['auth:sanctum', 'active', 'api-token', 'throttle:120,1'])->group(function () {
        Route::post('/auth/logout', [AuthController::class, 'logout'])->name('auth.logout');
        Route::get('/auth/me', [AuthController::class, 'me'])->name('auth.me');
        Route::get('/auth/user', [AuthController::class, 'me'])->name('auth.user');
        Route::get('/user', [AuthController::class, 'me'])->name('user');
        Route::post('/auth/device-tokens', [DeviceTokenController::class, 'register'])->name('auth.device-tokens.register');
        Route::delete('/auth/device-tokens', [DeviceTokenController::class, 'revoke'])->name('auth.device-tokens.revoke');
        Route::post('/push-deliveries/opened', [DeviceTokenController::class, 'recordOpened'])->name('push-deliveries.opened');

        Route::get('/personnel/credentials', [PersonnelCredentialController::class, 'index'])->name('personnel.credentials.index');
        Route::get('/personnel/credentials/{credential}/download', [PersonnelCredentialController::class, 'download'])->name('personnel.credentials.download');

        Route::prefix('account')->name('account.')->group(function () {
            Route::get('/', [AccountApiController::class, 'show'])->name('show');
            Route::patch('/profile', [AccountApiController::class, 'updateProfile'])->name('profile.update');
            Route::post('/email/request', [AccountApiController::class, 'requestEmailChange'])
                ->middleware('throttle:5,1')
                ->name('email.request');
            Route::post('/email/verify', [AccountApiController::class, 'verifyEmailChange'])
                ->middleware('throttle:10,1')
                ->name('email.verify');
            Route::post('/password', [AccountApiController::class, 'updatePassword'])
                ->middleware('throttle:5,1')
                ->name('password.update');

            Route::post('/security/otp/request-enable', [AccountSecurityApiController::class, 'requestEnableOtp'])
                ->middleware('throttle:5,1')
                ->name('otp.request_enable');
            Route::post('/security/otp/confirm-enable', [AccountSecurityApiController::class, 'confirmEnableOtp'])
                ->middleware('throttle:10,1')
                ->name('otp.confirm_enable');
            Route::post('/security/otp/request-disable', [AccountSecurityApiController::class, 'requestDisableOtp'])
                ->middleware('throttle:5,1')
                ->name('otp.request_disable');
            Route::post('/security/otp/confirm-disable', [AccountSecurityApiController::class, 'confirmDisableOtp'])
                ->middleware('throttle:10,1')
                ->name('otp.confirm_disable');
            Route::post('/security/otp/resend', [AccountSecurityApiController::class, 'resendOtp'])
                ->middleware('throttle:5,1')
                ->name('otp.resend');

            Route::delete('/sessions/{session}', [AccountSecurityApiController::class, 'revokeSession'])
                ->name('sessions.revoke');
            Route::post('/sessions/revoke-others', [AccountSecurityApiController::class, 'revokeOtherSessions'])
                ->middleware('throttle:5,1')
                ->name('sessions.revoke_others');

            Route::delete('/trusted-devices/{deviceId}', [AccountSecurityApiController::class, 'revokeTrustedDevice'])
                ->name('trusted_devices.revoke');
            Route::post('/trusted-devices/revoke-all', [AccountSecurityApiController::class, 'revokeAllTrustedDevices'])
                ->middleware('throttle:5,1')
                ->name('trusted_devices.revoke_all');
            Route::post('/trusted-devices/{deviceId}/lost', [AccountSecurityApiController::class, 'markDeviceLost'])
                ->middleware('throttle:5,1')
                ->name('trusted_devices.mark_lost');

            Route::get('/activity', [AccountSecurityApiController::class, 'activity'])
                ->name('activity');
        });
    });
});
