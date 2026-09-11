<?php

use App\Platform\Safety\Http\Controllers\Api\V1\SafetyGovernanceApiController;
use App\Platform\Safety\Http\Controllers\SosConfigurationController;
use App\Platform\Safety\Http\Controllers\SosResponderController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'active', 'verified', 'throttle:120,1'])->prefix('operations')->group(function (): void {
    Route::get('/sos-incidents', [SosResponderController::class, 'index'])->name('sos-incidents.index');
    Route::get('/sos-incidents/{sosIncident}', [SosResponderController::class, 'show'])->name('sos-incidents.show');
    Route::post('/sos-incidents/{sosIncident}/acknowledge', [SosResponderController::class, 'acknowledge'])->name('sos-incidents.acknowledge');
    Route::post('/sos-incidents/{sosIncident}/resolve', [SosResponderController::class, 'resolve'])->name('sos-incidents.resolve');
    Route::post('/sos-incidents/{sosIncident}/cancel', [SosResponderController::class, 'cancel'])->name('sos-incidents.cancel');

    Route::get('/sos-configuration/contacts', [SosConfigurationController::class, 'index'])->name('sos-configuration.contacts.index');
    Route::post('/sos-configuration/contacts', [SosConfigurationController::class, 'store'])->name('sos-configuration.contacts.store');
    Route::put('/sos-configuration/contacts/{sosEmergencyContact}', [SosConfigurationController::class, 'update'])->name('sos-configuration.contacts.update');
    Route::delete('/sos-configuration/contacts/{sosEmergencyContact}', [SosConfigurationController::class, 'deactivate'])->name('sos-configuration.contacts.deactivate');

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
