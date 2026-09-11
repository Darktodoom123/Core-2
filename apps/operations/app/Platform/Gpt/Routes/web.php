<?php

use App\Platform\Gpt\Http\Controllers\GptRecommendationController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'active', 'verified', 'throttle:gpt'])->prefix('operations')->group(function (): void {
    Route::post('/gpt-recommendations', [GptRecommendationController::class, 'store']);
    Route::post('/gpt-recommendations/{recommendation}/accept', [GptRecommendationController::class, 'accept']);
    Route::post('/gpt-recommendations/{recommendation}/reject', [GptRecommendationController::class, 'reject']);
    Route::post('/gpt-recommendations/{recommendation}/retry', [GptRecommendationController::class, 'retry']);
    Route::post('/gpt-circuit-breaker/toggle', [GptRecommendationController::class, 'toggleCircuitBreaker']);
    Route::get('/gpt-governance/telemetry', [GptRecommendationController::class, 'governanceTelemetry']);
});
