<?php

use Illuminate\Support\Facades\Route;
use Tracking\Http\Controllers\Api\Internal\LocationController;
use Tracking\Http\Middleware\ValidateServiceSignature;

Route::prefix('internal/v1')
    ->middleware([ValidateServiceSignature::class])
    ->group(function (): void {
        Route::post('locations', [LocationController::class, 'ingest']);
        Route::get('locations/latest', [LocationController::class, 'latest']);
        Route::get('locations', [LocationController::class, 'index']);
    });

Route::prefix('api/internal/v1')
    ->middleware([ValidateServiceSignature::class])
    ->group(function (): void {
        Route::post('locations', [LocationController::class, 'ingest']);
        Route::get('locations/latest', [LocationController::class, 'latest']);
        Route::get('locations', [LocationController::class, 'index']);
    });
