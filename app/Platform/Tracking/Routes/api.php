<?php

use App\Platform\Telemetry\Http\Controllers\Api\V1\WeatherController;
use App\Platform\Tracking\Http\Controllers\Api\V1\LocationController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->name('api.v1.')->group(function () {
    Route::middleware(['auth:sanctum', 'active', 'api-token', 'throttle:location'])->group(function () {
        Route::post('/locations', [LocationController::class, 'store'])->name('locations.store');
        Route::get('/dispatch/jobs/{id}/weather', [WeatherController::class, 'show'])->name('dispatch.jobs.weather');
        Route::post('/dispatch/jobs/{id}/weather-standby', [WeatherController::class, 'reportStandby'])->name('dispatch.jobs.weather-standby');
    });
});
