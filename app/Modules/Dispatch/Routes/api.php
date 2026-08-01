<?php

use App\Modules\Dispatch\Http\Controllers\Api\V1\FieldDispatchJobController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->name('api.v1.')->group(function () {
    Route::middleware(['auth:sanctum', 'active', 'api-token', 'throttle:120,1'])->group(function () {
        Route::get('/dispatch-jobs', [FieldDispatchJobController::class, 'index'])->name('dispatch-jobs.index');
        Route::get('/dispatch-jobs/{dispatchJob}', [FieldDispatchJobController::class, 'show'])->name('dispatch-jobs.show');
        Route::post('/dispatch-jobs/{dispatchJob}/status', [FieldDispatchJobController::class, 'transitionStatus'])->name('dispatch-jobs.status');
    });
});
