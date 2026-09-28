<?php

namespace App\Platform\Weather\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Platform\Weather\Services\LocationWeatherService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LocationWeatherController extends Controller
{
    public function show(Request $request, LocationWeatherService $weatherService): JsonResponse
    {
        // Weather is only meaningful for a real position; there is no default
        // location to fall back to.
        $validated = $request->validate([
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
        ]);

        $telemetry = $weatherService->getWeatherForCoordinates(
            (float) $validated['latitude'],
            (float) $validated['longitude'],
        );

        if ($telemetry === null) {
            return response()->json([
                'message' => 'Live weather is unavailable right now. Do not assume lifting conditions are safe; check on site.',
            ], 503);
        }

        return response()->json([
            'data' => $telemetry,
        ]);
    }
}
