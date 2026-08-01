<?php

use App\Modules\Fuel\Http\Controllers\Api\V1\FuelRequestController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->name('api.v1.')->middleware(['auth:sanctum', 'active', 'api-token', 'throttle:120,1'])->group(function (): void {
    Route::get('/fuel-requests', [FuelRequestController::class, 'index'])->name('fuel-requests.index');
    Route::get('/fuel-requests/{fuelRequest}', [FuelRequestController::class, 'show'])->name('fuel-requests.show');
});
