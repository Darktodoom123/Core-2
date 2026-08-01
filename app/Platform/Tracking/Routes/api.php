<?php

use App\Platform\Tracking\Http\Controllers\Api\V1\LocationController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->name('api.v1.')->group(function () {
    Route::middleware(['auth:sanctum', 'active', 'api-token', 'throttle:120,1'])->group(function () {
        Route::post('/locations', [LocationController::class, 'store'])->name('locations.store');
    });
});
