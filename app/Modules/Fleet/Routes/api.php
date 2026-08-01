<?php

use App\Modules\Fleet\Http\Controllers\AssetCatalogController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1/fleet')->name('api.v1.fleet.')->middleware(['auth:sanctum', 'active', 'api-token', 'throttle:120,1'])->group(function (): void {
    Route::get('/assets', [AssetCatalogController::class, 'index'])->name('assets.index');
    Route::get('/assets/{operationalAsset}', [AssetCatalogController::class, 'show'])->name('assets.show');
});
