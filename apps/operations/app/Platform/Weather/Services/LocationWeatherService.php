<?php

namespace App\Platform\Weather\Services;

use App\Platform\Geocoding\Services\PlaceNameResolver;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class LocationWeatherService
{
    /**
     * @return array{
     *     latitude: float,
     *     longitude: float,
     *     location_name: string|null,
     *     temperature_celsius: float|null,
     *     wind_speed_kmh: float,
     *     wind_gusts_kmh: float,
     *     rain_intensity_mmh: float,
     *     humidity_percent: int|null,
     *     weather_description: string,
     *     safety_level: 'safe_normal'|'warning_caution'|'critical_stop_work',
     *     safety_message: string,
     *     source: string,
     *     fetched_at: string
     * }|null  Null when live weather cannot be fetched.
     */
    public function getWeatherForCoordinates(float $latitude, float $longitude): ?array
    {
        $roundedLat = round($latitude, 2);
        $roundedLon = round($longitude, 2);
        $cacheKey = "weather_telemetry_{$roundedLat}_{$roundedLon}";

        $cached = Cache::get($cacheKey);

        if (is_array($cached)) {
            /** @var array{
             *     latitude: float,
             *     longitude: float,
             *     location_name: string|null,
             *     temperature_celsius: float|null,
             *     wind_speed_kmh: float,
             *     wind_gusts_kmh: float,
             *     rain_intensity_mmh: float,
             *     humidity_percent: int|null,
             *     weather_description: string,
             *     safety_level: 'safe_normal'|'warning_caution'|'critical_stop_work',
             *     safety_message: string,
             *     source: string,
             *     fetched_at: string
             * } $cached
             */
            return $cached;
        }

        // No fallback values: when the provider is unreachable the caller must
        // say weather is unknown, never report invented "safe" conditions.
        $data = $this->fetchFromOpenMeteo($latitude, $longitude);

        if ($data !== null) {
            Cache::put($cacheKey, $data, now()->addMinutes(5));
        }

        return $data;
    }

    /**
     * @return array{
     *     latitude: float,
     *     longitude: float,
     *     location_name: string|null,
     *     temperature_celsius: float|null,
     *     wind_speed_kmh: float,
     *     wind_gusts_kmh: float,
     *     rain_intensity_mmh: float,
     *     humidity_percent: int|null,
     *     weather_description: string,
     *     safety_level: 'safe_normal'|'warning_caution'|'critical_stop_work',
     *     safety_message: string,
     *     source: string,
     *     fetched_at: string
     * }|null
     */
    private function fetchFromOpenMeteo(float $latitude, float $longitude): ?array
    {
        try {
            $response = Http::withOptions(['verify' => ! app()->environment('local', 'testing')])
                ->timeout(3)
                ->get('https://api.open-meteo.com/v1/forecast', [
                    'latitude' => $latitude,
                    'longitude' => $longitude,
                    'current' => 'temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m',
                    'wind_speed_unit' => 'kmh',
                ]);

            if (! $response->successful()) {
                return null;
            }

            /** @var array{current?: array<string, mixed>} $json */
            $json = $response->json() ?? [];
            $current = $json['current'] ?? [];

            if (empty($current) || ! isset($current['wind_speed_10m'])) {
                return null;
            }

            $windSpeedKmh = round((float) $current['wind_speed_10m'], 1);
            $windGustsKmh = round((float) ($current['wind_gusts_10m'] ?? $windSpeedKmh), 1);
            $temperature = isset($current['temperature_2m']) ? round((float) $current['temperature_2m'], 1) : null;
            $rainIntensity = round((float) ($current['precipitation'] ?? 0.0), 2);
            $humidity = isset($current['relative_humidity_2m']) ? (int) $current['relative_humidity_2m'] : null;
            $weatherCode = isset($current['weather_code']) ? (int) $current['weather_code'] : null;

            $safety = $this->evaluateSafety($windSpeedKmh, $windGustsKmh, $rainIntensity);

            return [
                'latitude' => $latitude,
                'longitude' => $longitude,
                'location_name' => $this->resolveLocationLabel($latitude, $longitude),
                'temperature_celsius' => $temperature,
                'wind_speed_kmh' => $windSpeedKmh,
                'wind_gusts_kmh' => $windGustsKmh,
                'rain_intensity_mmh' => $rainIntensity,
                'humidity_percent' => $humidity,
                'weather_description' => $this->mapWmoCode($weatherCode),
                'safety_level' => $safety['level'],
                'safety_message' => $safety['message'],
                'source' => 'open_meteo',
                'fetched_at' => now()->toIso8601String(),
            ];
        } catch (\Throwable $e) {
            Log::info('Open-Meteo fetch failed; weather reported as unavailable', ['error' => $e->getMessage()]);

            return null;
        }
    }

    /**
     * @return array{level: 'safe_normal'|'warning_caution'|'critical_stop_work', message: string}
     */
    public function evaluateSafety(float $windSpeedKmh, float $windGustsKmh, float $rainMm): array
    {
        $maxWind = max($windSpeedKmh, $windGustsKmh);

        if ($maxWind >= 45.0) {
            return [
                'level' => 'critical_stop_work',
                'message' => 'Mandatory Stop Work: Wind exceeds DOLE 45 km/h limit. Engage free-slew immediately.',
            ];
        }

        if ($maxWind >= 36.0 || $rainMm >= 10.0) {
            return [
                'level' => 'warning_caution',
                'message' => 'High Wind Caution: Restrict large surface area loads (36-44 km/h). Maintain taglines.',
            ];
        }

        return [
            'level' => 'safe_normal',
            'message' => 'Normal Wind: Standard hoisting permitted (< 36 km/h).',
        ];
    }

    private function mapWmoCode(?int $code): string
    {
        return match ($code) {
            null => 'Conditions not reported',
            0 => 'Clear Sky',
            1, 2, 3 => 'Mainly Clear / Overcast',
            45, 48 => 'Fog',
            51, 53, 55 => 'Drizzle',
            61, 63, 65 => 'Rain',
            80, 81, 82 => 'Rain Showers',
            56, 57, 66, 67 => 'Freezing Rain',
            71, 73, 75, 77, 85, 86 => 'Snow',
            95, 96, 99 => 'Thunderstorm',
            default => 'Conditions not reported',
        };
    }

    /**
     * Nearest mapped address from the shared geocoding service (Stadia, then
     * Photon, then BigDataCloud). Null when no provider can name the point.
     */
    private function resolveLocationLabel(float $latitude, float $longitude): ?string
    {
        $place = app(PlaceNameResolver::class)->resolveNow($latitude, $longitude);

        if ($place['status'] !== 'resolved' || $place['primary'] === null) {
            return null;
        }

        $area = $place['secondary'] !== null ? explode(', ', $place['secondary'])[0] : null;

        return $area !== null ? "{$place['primary']}, {$area}" : $place['primary'];
    }
}
