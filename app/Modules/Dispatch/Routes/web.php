<?php

use App\Modules\Dispatch\Http\Controllers\ApprovalRequestController;
use App\Modules\Dispatch\Http\Controllers\ClientController;
use App\Modules\Dispatch\Http\Controllers\DispatchJobController;
use App\Modules\Dispatch\Http\Controllers\DispatchWorkflowController;
use App\Modules\Dispatch\Http\Controllers\ServiceRequestController;
use App\Modules\Dispatch\Planning\Http\ProjectPlanningController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'active', 'verified', 'throttle:120,1'])->prefix('operations')->group(function (): void {
    $planning = ProjectPlanningController::class;
    Route::post('/project-plans', [$planning, 'store']);
    Route::post('/project-plans/{projectPlan}/phases/{phase?}', [$planning, 'phase']);
    Route::post('/project-plans/{projectPlan}/phases/{phase}/allocations/{allocation?}', [$planning, 'allocation']);
    Route::get('/project-plans/{projectPlan}/phases/{phase}/allocation-preview/{allocation?}', [$planning, 'preview']);
    Route::post('/project-plans/{projectPlan}/submit', [$planning, 'submit']);
    Route::post('/project-plans/{projectPlan}/decision', [$planning, 'decision']);
    Route::post('/project-plans/{projectPlan}/phases/{phase}/shifts', [$planning, 'shifts']);
    Route::post('/project-plans/{projectPlan}/shifts/{shift}/roster', [$planning, 'roster']);
    Route::post('/project-plans/{projectPlan}/shifts/{shift}/decision', [$planning, 'shiftDecision']);
    Route::get('/project-plans/{projectPlan}/shifts/{shift}/candidates', [$planning, 'candidates']);
    Route::get('/clients', [ClientController::class, 'index']);
    Route::post('/clients', [ClientController::class, 'store']);
    Route::get('/service-requests', [ServiceRequestController::class, 'index']);
    Route::post('/service-requests', [ServiceRequestController::class, 'store']);
    Route::get('/dispatch-jobs', [DispatchJobController::class, 'index']);
    Route::post('/dispatch-jobs', [DispatchJobController::class, 'store']);
    Route::get('/dispatch-jobs/{dispatchJob}', [DispatchJobController::class, 'show'])->name('dispatch-jobs.show');
    Route::patch('/dispatch-jobs/{dispatchJob}/site-coordinates', [DispatchJobController::class, 'updateSiteCoordinates'])->name('dispatch-jobs.site-coordinates');
    Route::patch('/dispatch-jobs/{dispatchJob}/crane-slots', [DispatchJobController::class, 'updatePlannedCraneSlots'])->name('dispatch-jobs.crane-slots');
    Route::patch('/dispatch-jobs/{dispatchJob}/assets/{assetAssignment}/site-coordinates', [DispatchJobController::class, 'updateAssetSiteCoordinates'])->name('dispatch-jobs.assets.site-coordinates');
    Route::post('/dispatch-jobs/{dispatchJob}/activate', [DispatchWorkflowController::class, 'activate']);
    Route::post('/dispatch-jobs/{dispatchJob}/cancel', [DispatchWorkflowController::class, 'cancel']);
    Route::post('/dispatch-jobs/{dispatchJob}/reopen', [DispatchWorkflowController::class, 'reopen']);
    Route::post('/dispatch-jobs/{dispatchJob}/archive', [DispatchWorkflowController::class, 'archive']);
    Route::post('/dispatch-jobs/{dispatchJob}/restore', [DispatchWorkflowController::class, 'restore']);
    Route::post('/dispatch-jobs/{dispatchJob}/status', [DispatchWorkflowController::class, 'transition']);
    Route::post('/approval-requests/{approvalRequest}/decision', [ApprovalRequestController::class, 'decide']);
});
