<?php

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
    });
});
