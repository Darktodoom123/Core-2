<?php

use App\Modules\Sales\Http\Controllers\Api\V1\SalesDeliveryApiController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->name('api.v1.')->group(function () {
    Route::middleware(['auth:sanctum', 'active', 'api-token', 'throttle:120,1'])->group(function () {
        Route::post('/sales-orders/{salesOrder}/delivery', [SalesDeliveryApiController::class, 'submit'])->name('sales-orders.delivery');
    });
});
