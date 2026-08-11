<?php

use App\Modules\Sales\Http\Controllers\SalesCatalogController;
use App\Modules\Sales\Http\Controllers\SalesOrderController;
use App\Modules\Sales\Http\Controllers\SalesQuoteController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'active', 'verified', 'throttle:120,1'])->prefix('operations')->group(function (): void {
    Route::get('/sales/catalog', [SalesCatalogController::class, 'index'])->name('sales.catalog.index');
    Route::post('/sales/catalog', [SalesCatalogController::class, 'store'])->name('sales.catalog.store');
    Route::get('/sales/quotes', [SalesQuoteController::class, 'index'])->name('sales.quotes.index');
    Route::post('/sales/quotes', [SalesQuoteController::class, 'store'])->name('sales.quotes.store');
    Route::post('/sales/quotes/{salesQuote}/accept', [SalesQuoteController::class, 'accept'])->name('sales.quotes.accept');
    Route::get('/sales/orders', [SalesOrderController::class, 'index'])->name('sales.orders.index');
    Route::post('/sales/orders/{salesOrder}/fulfill', [SalesOrderController::class, 'fulfill'])->name('sales.orders.fulfill');
    Route::post('/sales/orders/{salesOrder}/transfer-ownership', [SalesOrderController::class, 'transferOwnership'])->name('sales.orders.transfer');
});
