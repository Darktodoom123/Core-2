<?php

use App\Platform\Safety\Http\Controllers\Api\V1\SafetyGovernanceApiController;
use App\Platform\Safety\Http\Controllers\Api\V1\SosIncidentController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->name('api.v1.')->middleware(['auth:sanctum', 'active', 'api-token'])->group(function (): void {
    Route::middleware(['throttle:sos'])->group(function (): void {
        Route::post('/sos-incidents', [SosIncidentController::class, 'store'])->name('sos-incidents.store');
        Route::get('/sos-incidents/active', [SosIncidentController::class, 'active'])->name('sos-incidents.active');
        Route::patch('/sos-incidents/{sosIncident}/classification', [SosIncidentController::class, 'classify'])->name('sos-incidents.classification');
        Route::patch('/sos-incidents/{sosIncident}/location', [SosIncidentController::class, 'location'])->name('sos-incidents.location');
        Route::post('/sos-incidents/{sosIncident}/cancel', [SosIncidentController::class, 'cancel'])->name('sos-incidents.cancel');
        Route::get('/sos-configuration', [SosIncidentController::class, 'configuration'])->name('sos.configuration');
    });

    Route::prefix('safety')->name('safety.')->group(function (): void {
        Route::get('/metrics', [SafetyGovernanceApiController::class, 'metrics'])->name('metrics');
        Route::get('/hazards', [SafetyGovernanceApiController::class, 'indexHazards'])->name('hazards.index');
        Route::get('/lift-plans', [SafetyGovernanceApiController::class, 'indexCriticalLiftPlans'])->name('lift-plans.index');
        Route::get('/toolbox-meetings', [SafetyGovernanceApiController::class, 'indexToolboxMeetings'])->name('tbm.index');
        Route::get('/work-stoppages', [SafetyGovernanceApiController::class, 'indexWorkStoppages'])->name('work-stoppages.index');
        Route::post('/toolbox-meetings', [SafetyGovernanceApiController::class, 'storeToolboxMeeting'])->name('tbm.store');
        Route::post('/toolbox-meetings/{meeting}/cosign', [SafetyGovernanceApiController::class, 'coSignToolboxMeeting'])->name('tbm.cosign');
        Route::post('/lift-plans', [SafetyGovernanceApiController::class, 'storeCriticalLiftPlan'])->name('lift-plans.store');
        Route::post('/lift-plans/{plan}/authorize', [SafetyGovernanceApiController::class, 'authorizeCriticalLiftPlan'])->name('lift-plans.authorize');
        Route::post('/hazards', [SafetyGovernanceApiController::class, 'storeHazardTicket'])->name('hazards.store');
        Route::post('/hazards/{ticket}/rectify', [SafetyGovernanceApiController::class, 'rectifyHazardTicket'])->name('hazards.rectify');
        Route::post('/work-stoppages', [SafetyGovernanceApiController::class, 'storeWorkStoppage'])->name('work-stoppages.store');
        Route::post('/work-stoppages/{notice}/lift', [SafetyGovernanceApiController::class, 'liftWorkStoppage'])->name('work-stoppages.lift');
    });
});
