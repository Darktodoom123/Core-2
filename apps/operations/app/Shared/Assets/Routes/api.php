<?php

use App\Shared\Assets\Http\Controllers\Api\V1\AssetDocumentApiController;
use App\Shared\Assets\Http\Controllers\InspectionController;
use App\Shared\Assets\Http\Controllers\MaintenanceWorkOrderController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->name('api.v1.')->middleware(['auth:sanctum', 'active', 'api-token', 'throttle:120,1'])->group(function (): void {
    Route::post('/assets/{operationalAsset}/inspections', [InspectionController::class, 'store']);
    Route::post('/assets/{operationalAsset}/maintenance', [MaintenanceWorkOrderController::class, 'store']);
    Route::post('/maintenance/{maintenanceWorkOrder}/complete', [MaintenanceWorkOrderController::class, 'complete']);
    Route::post('/maintenance/{maintenanceWorkOrder}/release', [MaintenanceWorkOrderController::class, 'release']);

    Route::get('/fleet/assets/{code}/permits', [AssetDocumentApiController::class, 'index'])->name('fleet.assets.permits.index');
    Route::get('/fleet/assets/{operationalAsset}/permits/{document}/download', [AssetDocumentApiController::class, 'download'])->name('fleet.assets.permits.download');
});
