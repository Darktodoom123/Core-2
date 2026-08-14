<?php

use App\Modules\Dispatch\Http\Controllers\Api\V1\FieldDispatchJobController;
use App\Modules\Dispatch\Http\Controllers\Api\V2\DispatchJobV2Controller;
use App\Modules\Dispatch\Http\Controllers\Api\V2\DispatchPlanApprovalV2Controller;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->name('api.v1.')->group(function () {
    Route::middleware(['auth:sanctum', 'active', 'api-token', 'throttle:120,1'])->group(function () {
        Route::get('/dispatch-jobs', [FieldDispatchJobController::class, 'index'])->name('dispatch-jobs.index');
        Route::get('/dispatch-jobs/{dispatchJob}', [FieldDispatchJobController::class, 'show'])->name('dispatch-jobs.show');
        Route::post('/dispatch-jobs/{dispatchJob}/status', [FieldDispatchJobController::class, 'transitionStatus'])->name('dispatch-jobs.status');
    });
});

Route::prefix('v2')->name('api.v2.')->group(function () {
    Route::middleware(['auth:sanctum', 'active', 'api-token', 'throttle:120,1'])->group(function () {
        Route::get('/dispatch-jobs', [DispatchJobV2Controller::class, 'index'])->name('dispatch-jobs.index');
        Route::get('/dispatch-jobs/{dispatchJob}', [DispatchJobV2Controller::class, 'show'])->name('dispatch-jobs.show');
        Route::get('/dispatch-jobs/{dispatchJob}/readiness', [DispatchJobV2Controller::class, 'readiness'])->name('dispatch-jobs.readiness');
        Route::post('/dispatch-jobs/{dispatchJob}/dispatch', [DispatchJobV2Controller::class, 'dispatch'])->name('dispatch-jobs.dispatch');
        Route::post('/dispatch-jobs/{dispatchJob}/progress', [DispatchJobV2Controller::class, 'progress'])->name('dispatch-jobs.progress');
        Route::post('/dispatch-jobs/{dispatchJob}/cancel', [DispatchJobV2Controller::class, 'cancel'])->name('dispatch-jobs.cancel');
        Route::post('/dispatch-jobs/{dispatchJob}/reopen', [DispatchJobV2Controller::class, 'reopen'])->name('dispatch-jobs.reopen');
        Route::post('/dispatch-jobs/{dispatchJob}/archive', [DispatchJobV2Controller::class, 'archive'])->name('dispatch-jobs.archive');

        Route::post('/dispatch-jobs/{dispatchJob}/plan/submit', [DispatchPlanApprovalV2Controller::class, 'submitPlan'])->name('dispatch-jobs.plan.submit');
        Route::post('/dispatch-jobs/{dispatchJob}/plan/approve', [DispatchPlanApprovalV2Controller::class, 'approvePlan'])->name('dispatch-jobs.plan.approve');
        Route::post('/dispatch-jobs/{dispatchJob}/plan/reject', [DispatchPlanApprovalV2Controller::class, 'rejectPlan'])->name('dispatch-jobs.plan.reject');
        Route::post('/dispatch-jobs/{dispatchJob}/emergency-override/propose', [DispatchPlanApprovalV2Controller::class, 'proposeEmergencyOverride'])->name('dispatch-jobs.override.propose');
        Route::post('/dispatch-jobs/{dispatchJob}/emergency-override/{override}/decision', [DispatchPlanApprovalV2Controller::class, 'decideEmergencyOverride'])->name('dispatch-jobs.override.decision');
    });
});
