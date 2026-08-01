<?php

use App\Modules\Fuel\Http\Controllers\FuelRequestController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'active', 'verified', 'throttle:120,1'])->prefix('operations')->group(function (): void {
    Route::get('/fuel-requests', [FuelRequestController::class, 'index']);
    Route::post('/fuel-requests', [FuelRequestController::class, 'store']);
    Route::post('/fuel-requests/{fuelRequest}/status', [FuelRequestController::class, 'transition']);
});
