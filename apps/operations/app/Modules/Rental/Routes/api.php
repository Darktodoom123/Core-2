<?php

use App\Modules\Rental\Http\Controllers\Api\V1\RentalHandoverApiController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->name('api.v1.')->group(function () {
    Route::middleware(['auth:sanctum', 'active', 'api-token', 'throttle:120,1'])->group(function () {
        Route::post('/rentals/{rentalReservation}/handover', [RentalHandoverApiController::class, 'submit'])->name('rentals.handover');
        Route::post('/rentals/{rentalReservation}/checkout', [RentalHandoverApiController::class, 'checkout'])->name('rentals.checkout');
        Route::post('/rentals/{rentalReservation}/return', [RentalHandoverApiController::class, 'returnReservation'])->name('rentals.return');
    });
});
