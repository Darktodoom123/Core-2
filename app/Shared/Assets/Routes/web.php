<?php

use App\Shared\Assets\Http\Controllers\InspectionController;
use App\Shared\Assets\Http\Controllers\MaintenanceWorkOrderController;
use App\Shared\Assets\Http\Controllers\OperationalAssetController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'active', 'verified', 'throttle:120,1'])->prefix('operations')->group(function (): void {
    Route::get('/assets', [OperationalAssetController::class, 'index']);
    Route::post('/assets', [OperationalAssetController::class, 'store']);
    Route::post('/assets/{operationalAsset}/status', [OperationalAssetController::class, 'status']);
    Route::post('/assets/{operationalAsset}/inspections', [InspectionController::class, 'store']);
    Route::post('/assets/{operationalAsset}/maintenance', [MaintenanceWorkOrderController::class, 'store']);
    Route::post('/maintenance/{maintenanceWorkOrder}/release', [MaintenanceWorkOrderController::class, 'release']);
});
