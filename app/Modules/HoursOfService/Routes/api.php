<?php

use App\Modules\HoursOfService\Http\Controllers\Api\V1\HosShiftController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1/hos')->name('api.v1.hos.')->middleware(['auth:sanctum', 'active', 'api-token', 'throttle:60,1'])->group(function (): void {
    Route::get('/current-shift', [HosShiftController::class, 'currentShift'])->name('current-shift');
    Route::post('/shifts/start', [HosShiftController::class, 'startShift'])->name('shifts.start');
    Route::post('/duty-status', [HosShiftController::class, 'changeDutyStatus'])->name('duty-status');
    Route::post('/shifts/certify', [HosShiftController::class, 'certifyShift'])->name('shifts.certify');
    Route::get('/cycle-history', [HosShiftController::class, 'cycleHistory'])->name('cycle-history');
});
