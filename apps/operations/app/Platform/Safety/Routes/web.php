<?php

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
});
