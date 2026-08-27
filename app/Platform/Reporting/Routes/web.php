<?php

use App\Platform\Reporting\Http\Controllers\JobReportController;
use App\Platform\Reporting\Http\Controllers\OperationsSummaryController;
use App\Platform\Reporting\Http\Controllers\ReportExportController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'active', 'verified', 'throttle:120,1'])->prefix('operations')->group(function (): void {
    Route::get('/job-reports', [JobReportController::class, 'index']);
    Route::post('/job-reports', [JobReportController::class, 'store']);
    Route::get('/job-reports/{jobReport}', [JobReportController::class, 'show']);
    Route::post('/job-reports/{jobReport}/resubmit', [JobReportController::class, 'resubmit']);
    Route::put('/job-reports/{jobReport}', [JobReportController::class, 'resubmit']);
    Route::post('/job-reports/{jobReport}/review', [JobReportController::class, 'review']);
    Route::get('/reports/daily-summary', [OperationsSummaryController::class, 'dailySummary']);
    Route::get('/reports/weekly-fuel-summary', [OperationsSummaryController::class, 'weeklyFuelSummary']);

    Route::middleware('throttle:exports')->group(function (): void {
        Route::post('/reports/exports', [ReportExportController::class, 'store']);
        Route::get('/reports/exports/{export}/download', [ReportExportController::class, 'download'])
            ->name('operations.exports.download')
            ->middleware('signed');
        Route::post('/reports/exports/{export}/retry', [ReportExportController::class, 'retry']);
    });
});
