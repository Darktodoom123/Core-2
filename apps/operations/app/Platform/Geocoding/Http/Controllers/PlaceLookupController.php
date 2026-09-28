<?php

namespace App\Platform\Geocoding\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Platform\Geocoding\Services\PlaceNameResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Nearest address for one coordinate. Serves both the web session and the
 * mobile API token, so browsers and devices never call providers directly.
 */
final class PlaceLookupController extends Controller
{
    public function show(Request $request, PlaceNameResolver $resolver): JsonResponse
    {
        $validated = $request->validate([
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
        ]);

        return response()->json([
            'data' => $resolver->resolveNow((float) $validated['latitude'], (float) $validated['longitude']),
        ]);
    }

    /** Coordinates for a typed site address. 404 when nothing matches. */
    public function search(Request $request, PlaceNameResolver $resolver): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['required', 'string', 'min:3', 'max:200'],
        ]);

        $result = $resolver->search($validated['q']);

        if ($result === null) {
            return response()->json(['message' => 'No matching address was found.'], 404);
        }

        return response()->json(['data' => $result]);
    }
}
