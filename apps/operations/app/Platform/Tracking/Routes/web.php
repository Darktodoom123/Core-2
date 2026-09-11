<?php

use App\Platform\Tracking\Http\Controllers\LocationUpdateController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'active', 'verified', 'throttle:120,1'])->prefix('operations')->group(function (): void {
    Route::get('/locations', [LocationUpdateController::class, 'index']);
    Route::post('/locations', [LocationUpdateController::class, 'store']);
});
