<?php

use App\Platform\Reporting\Http\Controllers\JobReportController;
use Illuminate\Support\Facades\Route;

if (! class_exists(App\Platform\Reporting\Http\Controllers\Api\V1\JobReportController::class)) {
    class_alias(JobReportController::class, App\Platform\Reporting\Http\Controllers\Api\V1\JobReportController::class);
}

Route::prefix('v1')->name('api.v1.')->middleware(['auth:sanctum', 'active', 'api-token', 'throttle:120,1'])->group(function (): void {
    Route::post('/job-reports', [App\Platform\Reporting\Http\Controllers\Api\V1\JobReportController::class, 'store'])->name('job-reports.store');
    Route::get('/job-reports', [App\Platform\Reporting\Http\Controllers\Api\V1\JobReportController::class, 'index'])->name('job-reports.index');
    Route::get('/job-reports/{jobReport}', [App\Platform\Reporting\Http\Controllers\Api\V1\JobReportController::class, 'show'])->name('job-reports.show');
});
