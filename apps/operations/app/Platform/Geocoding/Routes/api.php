<?php

use App\Platform\Geocoding\Http\Controllers\PlaceLookupController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->name('api.v1.')->group(function () {
    Route::middleware(['auth:sanctum', 'active', 'api-token', 'throttle:geocoding'])->group(function () {
        Route::get('/places/reverse', [PlaceLookupController::class, 'show'])->name('places.reverse');
    });
});
