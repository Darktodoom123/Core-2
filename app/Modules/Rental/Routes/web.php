<?php

use App\Modules\Rental\Http\Controllers\RentalReservationController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'active', 'verified', 'throttle:120,1'])->prefix('operations')->group(function (): void {
    Route::get('/rental-reservations', [RentalReservationController::class, 'index'])->name('rental.index');
    Route::post('/rental-reservations', [RentalReservationController::class, 'store'])->name('rental.store');
    Route::post('/rental-reservations/{rentalReservation}/approve', [RentalReservationController::class, 'approve'])->name('rental.approve');
    Route::post('/rental-reservations/{rentalReservation}/operators', [RentalReservationController::class, 'assignOperator'])->name('rental.assign-operator');
    Route::post('/rental-reservations/{rentalReservation}/checkout', [RentalReservationController::class, 'checkout'])->name('rental.checkout');
    Route::post('/rental-reservations/{rentalReservation}/return', [RentalReservationController::class, 'returnReservation'])->name('rental.return');
    Route::post('/rental-reservations/{rentalReservation}/operation-authorization', [RentalReservationController::class, 'authorizeOperation'])->name('rental.operation-authorization');
});
