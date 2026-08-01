<?php

use App\Platform\Identity\Http\Controllers\Api\V1\AuthController;
use App\Platform\Identity\Http\Resources\V1\UserResource;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return response()->json(['data' => new UserResource($request->user())]);
})->middleware(['auth:sanctum', 'active']);

Route::prefix('v1')->name('api.v1.')->group(function () {
    Route::post('/auth/login', [AuthController::class, 'login'])
        ->middleware('throttle:5,1')
        ->name('auth.login');

    Route::middleware(['auth:sanctum', 'active', 'api-token', 'throttle:120,1'])->group(function () {
        Route::post('/auth/logout', [AuthController::class, 'logout'])->name('auth.logout');
        Route::get('/auth/me', [AuthController::class, 'me'])->name('auth.me');
        Route::get('/auth/user', [AuthController::class, 'me'])->name('auth.user');
        Route::get('/user', [AuthController::class, 'me'])->name('user');
    });
});
