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

        // Resolve latitude and longitude from request query or default Metro Manila coordinates (14.5995, 120.9842)
        $lat = (float) ($request->query('lat') ?? 14.5995);
        $lon = (float) ($request->query('lon') ?? 120.9842);

        $weather = $this->weatherService->getSiteWeather($lat, $lon);

        return response()->json([
            'data' => array_merge($weather, [
                'job_id' => $job->id,
                'job_reference' => $job->reference,
                'site_name' => $job->site,
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
