<?php

declare(strict_types=1);

namespace App\Platform\Telemetry\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Telemetry\Services\SiteWeatherService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class WeatherController extends Controller
{
    public function __construct(
        private readonly SiteWeatherService $weatherService
    ) {}

    public function show(Request $request, int $id): JsonResponse
    {
        $job = DispatchJob::findOrFail($id);

        $assetAssignment = null;
        if ($request->filled('assignment_id')) {
            $assetAssignment = $job->assetAssignments()->where('id', $request->query('assignment_id'))->first();
        } elseif ($request->filled('asset_id')) {
            $assetAssignment = $job->assetAssignments()->where('operational_asset_id', $request->query('asset_id'))->first();
        }

        // Prioritize pinned asset coordinates, then job site coordinates, then query params / default
        $lat = ($assetAssignment !== null && $assetAssignment->site_latitude !== null)
            ? (float) $assetAssignment->site_latitude
            : ($job->site_latitude !== null ? (float) $job->site_latitude : (float) ($request->query('lat') ?? 14.5995));

        $lon = ($assetAssignment !== null && $assetAssignment->site_longitude !== null)
            ? (float) $assetAssignment->site_longitude
            : ($job->site_longitude !== null ? (float) $job->site_longitude : (float) ($request->query('lon') ?? 120.9842));

        $isPinned = ($assetAssignment !== null && $assetAssignment->site_latitude !== null && $assetAssignment->site_longitude !== null)
            || ($job->site_latitude !== null && $job->site_longitude !== null);

        $weather = $this->weatherService->getSiteWeather($lat, $lon);

        return response()->json([
            'data' => array_merge($weather, [
                'job_id' => $job->id,
                'job_reference' => $job->reference,
                'site_name' => $job->site,
                'site_latitude' => $lat,
                'site_longitude' => $lon,
                'asset_id' => $assetAssignment?->operational_asset_id,
                'assignment_id' => $assetAssignment?->id,
                'is_pinned' => $isPinned,
            ]),
        ]);
    }

    public function reportStandby(Request $request, int $id): JsonResponse
    {
        $job = DispatchJob::findOrFail($id);

        $validated = $request->validate([
            'anemometer_wind_kmh' => ['required', 'numeric', 'min:0', 'max:200'],
            'reason' => ['required', 'string', 'in:high_wind,thunderstorm,heavy_rain,typhoon_signal,other_weather'],
            'remarks' => ['nullable', 'string', 'max:500'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
        ]);

        $windKmh = (float) $validated['anemometer_wind_kmh'];
        $isCritical = $windKmh >= 45.0;

        return response()->json([
            'message' => 'Weather standby recorded successfully.',
            'data' => [
                'job_id' => $job->id,
                'job_reference' => $job->reference,
                'anemometer_wind_kmh' => $windKmh,
                'reason' => $validated['reason'],
                'remarks' => $validated['remarks'] ?? null,
                'free_slew_required' => $isCritical,
                'logged_at' => now()->toIso8601String(),
            ],
        ], 201);
    }
}
