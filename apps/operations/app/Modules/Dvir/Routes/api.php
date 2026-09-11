<?php

use App\Modules\Dvir\Http\Controllers\Api\V1\DvirInspectionController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1/dvir')->name('api.v1.dvir.')->middleware(['auth:sanctum', 'active', 'api-token', 'throttle:60,1'])->group(function (): void {
    Route::get('/inspections', [DvirInspectionController::class, 'index'])->name('inspections.index');
    Route::post('/inspections', [DvirInspectionController::class, 'store'])->name('inspections.store');
    Route::get('/inspections/{inspection}', [DvirInspectionController::class, 'show'])->whereNumber('inspection')->name('inspections.show');
});
