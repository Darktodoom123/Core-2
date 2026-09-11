<?php

use App\Modules\CraneEquipment\Http\Controllers\AssetCatalogController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1/equipment')->name('api.v1.equipment.')->middleware(['auth:sanctum', 'active', 'api-token', 'throttle:120,1'])->group(function (): void {
    Route::get('/assets', [AssetCatalogController::class, 'index'])->name('assets.index');
    Route::get('/assets/{operationalAsset}', [AssetCatalogController::class, 'show'])->name('assets.show');
});
