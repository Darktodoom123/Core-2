<?php

namespace App\Platform\Tracking\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Platform\Tracking\Services\LocationWeatherService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class LocationWeatherController extends Controller
{
    public function show(Request $request, LocationWeatherService $weatherService): JsonResponse
    {
        $validated = $request->validate([
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
        ]);

        $latitude = isset($validated['latitude']) ? (float) $validated['latitude'] : 14.5995;
        $longitude = isset($validated['longitude']) ? (float) $validated['longitude'] : 120.9842;

        $telemetry = $weatherService->getWeatherForCoordinates($latitude, $longitude);

        return response()->json([
            'data' => $telemetry,
        ]);
    }
}
