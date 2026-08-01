<?php

use App\Modules\Assignment\Http\Controllers\Api\V1\AssignmentResponseController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->name('api.v1.')->middleware(['auth:sanctum', 'active', 'api-token', 'throttle:120,1'])->group(function (): void {
    Route::post('/dispatch-jobs/{dispatchJob}/assignments/{assignment}/response', [AssignmentResponseController::class, 'store'])
        ->name('dispatch-jobs.assignments.response');
});
