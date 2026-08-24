<?php

use App\Platform\Safety\Http\Controllers\Api\V1\SosIncidentController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->name('api.v1.')->middleware(['auth:sanctum', 'active', 'api-token', 'throttle:sos'])->group(function (): void {
    Route::post('/sos-incidents', [SosIncidentController::class, 'store'])->name('sos-incidents.store');
    Route::get('/sos-incidents/active', [SosIncidentController::class, 'active'])->name('sos-incidents.active');
    Route::patch('/sos-incidents/{sosIncident}/classification', [SosIncidentController::class, 'classify'])->name('sos-incidents.classification');
    Route::patch('/sos-incidents/{sosIncident}/location', [SosIncidentController::class, 'location'])->name('sos-incidents.location');
    Route::post('/sos-incidents/{sosIncident}/cancel', [SosIncidentController::class, 'cancel'])->name('sos-incidents.cancel');
    Route::get('/sos-configuration', [SosIncidentController::class, 'configuration'])->name('sos.configuration');
});
