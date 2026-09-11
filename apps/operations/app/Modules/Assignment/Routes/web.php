<?php

use App\Modules\Assignment\Http\Controllers\AssignmentController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'active', 'verified', 'throttle:120,1'])->prefix('operations')->group(function (): void {
    Route::post('/dispatch-jobs/{dispatchJob}/assignments', [AssignmentController::class, 'assign']);
    Route::post('/dispatch-jobs/{dispatchJob}/reassign', [AssignmentController::class, 'reassign']);
    Route::post('/dispatch-jobs/{dispatchJob}/assignments/{assignment}/response', [AssignmentController::class, 'respond']);
});
