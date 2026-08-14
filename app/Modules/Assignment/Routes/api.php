<?php

use App\Modules\Assignment\Http\Controllers\Api\V1\AssignmentResponseController;
use App\Modules\Assignment\Http\Controllers\Api\V2\AssignmentOfferV2Controller;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->name('api.v1.')->middleware(['auth:sanctum', 'active', 'api-token', 'throttle:120,1'])->group(function (): void {
    Route::post('/dispatch-jobs/{dispatchJob}/assignments/{assignment}/response', [AssignmentResponseController::class, 'store'])
        ->name('dispatch-jobs.assignments.response');
});

Route::prefix('v2')->name('api.v2.')->middleware(['auth:sanctum', 'active', 'api-token', 'throttle:120,1'])->group(function (): void {
    Route::post('/dispatch-jobs/{dispatchJob}/offers', [AssignmentOfferV2Controller::class, 'propose'])
        ->name('dispatch-jobs.offers.propose');
    Route::post('/dispatch-jobs/{dispatchJob}/offers/{offer}/accept', [AssignmentOfferV2Controller::class, 'accept'])
        ->name('dispatch-jobs.offers.accept');
    Route::post('/dispatch-jobs/{dispatchJob}/offers/{offer}/reject', [AssignmentOfferV2Controller::class, 'reject'])
        ->name('dispatch-jobs.offers.reject');
    Route::post('/dispatch-jobs/{dispatchJob}/offers/{offer}/withdraw', [AssignmentOfferV2Controller::class, 'withdraw'])
        ->name('dispatch-jobs.offers.withdraw');
    Route::post('/dispatch-jobs/{dispatchJob}/offers/{offer}/expire', [AssignmentOfferV2Controller::class, 'expire'])
        ->name('dispatch-jobs.offers.expire');
    Route::post('/dispatch-jobs/{dispatchJob}/lead', [AssignmentOfferV2Controller::class, 'designateLead'])
        ->name('dispatch-jobs.lead.designate');
});
