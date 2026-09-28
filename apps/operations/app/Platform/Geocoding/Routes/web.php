<?php

use App\Platform\Geocoding\Http\Controllers\PlaceLookupController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'active', 'verified', 'throttle:geocoding'])->prefix('operations')->group(function (): void {
    Route::get('/places/reverse', [PlaceLookupController::class, 'show'])->name('operations.places.reverse');
    Route::get('/places/search', [PlaceLookupController::class, 'search'])->name('operations.places.search');
});
