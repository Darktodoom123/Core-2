<?php

use App\Modules\Fuel\Http\Controllers\Api\V1\FuelRequestController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->name('api.v1.')->middleware(['auth:sanctum', 'active', 'api-token', 'throttle:120,1'])->group(function (): void {
    Route::get('/fuel-requests', [FuelRequestController::class, 'index'])->name('fuel-requests.index');
    Route::get('/fuel-options', [FuelRequestController::class, 'options'])->name('fuel.options');
    Route::post('/fuel-requests', [FuelRequestController::class, 'store'])->middleware('throttle:30,1')->name('fuel-requests.store');
    Route::post('/fuel-requests/{fuelRequest}/logs', [FuelRequestController::class, 'record'])->middleware('throttle:30,1')->name('fuel-requests.logs.store');
    Route::get('/fuel-requests/{fuelRequest}', [FuelRequestController::class, 'show'])->name('fuel-requests.show');
});
