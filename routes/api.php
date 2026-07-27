<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\FieldDispatchJobController;
use App\Http\Controllers\Api\V1\LocationController;
use App\Http\Resources\V1\UserResource;
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

        Route::get('/dispatch-jobs', [FieldDispatchJobController::class, 'index'])->name('dispatch-jobs.index');
        Route::get('/dispatch-jobs/{dispatchJob}', [FieldDispatchJobController::class, 'show'])->name('dispatch-jobs.show');
        Route::post('/dispatch-jobs/{dispatchJob}/assignments/{assignment}/response', [FieldDispatchJobController::class, 'respondAssignment'])->name('dispatch-jobs.assignments.response');
        Route::post('/dispatch-jobs/{dispatchJob}/status', [FieldDispatchJobController::class, 'transitionStatus'])->name('dispatch-jobs.status');

        Route::post('/locations', [LocationController::class, 'store'])->name('locations.store');
    });
});
