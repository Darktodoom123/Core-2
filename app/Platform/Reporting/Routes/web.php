<?php

use App\Platform\Reporting\Http\Controllers\JobReportController;
use App\Platform\Reporting\Http\Controllers\OperationsSummaryController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'active', 'verified', 'throttle:120,1'])->prefix('operations')->group(function (): void {
    Route::get('/job-reports', [JobReportController::class, 'index']);
    Route::post('/job-reports', [JobReportController::class, 'store']);
    Route::get('/job-reports/{jobReport}', [JobReportController::class, 'show']);
    Route::post('/job-reports/{jobReport}/review', [JobReportController::class, 'review']);
    Route::get('/reports/daily-summary', [OperationsSummaryController::class, 'dailySummary']);
});
