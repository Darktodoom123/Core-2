<?php

use App\Modules\CraneEquipment\Http\Controllers\AssetCatalogController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'active', 'verified', 'throttle:120,1'])->prefix('operations/equipment')->name('equipment.')->group(function (): void {
    Route::get('/assets', [AssetCatalogController::class, 'index'])->name('assets.index');
    Route::get('/assets/{operationalAsset}', [AssetCatalogController::class, 'show'])->name('assets.show');
});
