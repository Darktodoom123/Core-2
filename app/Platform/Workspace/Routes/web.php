<?php

use App\Platform\Workspace\Http\Controllers\AdminOverrideController;
use App\Platform\Workspace\Http\Controllers\SystemHealthController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'active', 'verified', 'throttle:120,1'])->prefix('operations/admin')->group(function (): void {
    Route::post('/dispatch-jobs/{dispatchJob}/emergency-abort', [AdminOverrideController::class, 'emergencyAbortDispatch']);
    Route::post('/assets/{asset}/safety-lockdown', [AdminOverrideController::class, 'safetyLockdownAsset']);
    Route::get('/health', SystemHealthController::class);
});
