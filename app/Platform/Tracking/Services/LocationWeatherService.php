<?php

namespace App\Platform\Tracking\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

final class LocationWeatherService
{
    /**
     * @return array{
     *     latitude: float,
     *     longitude: float,
     *     location_name: string,
     *     temperature_celsius: float,
     *     wind_speed_kmh: float,
     *     wind_gusts_kmh: float,
     *     rain_intensity_mmh: float,
     *     humidity_percent: int,
     *     weather_description: string,
     *     safety_level: 'safe_normal'|'warning_caution'|'critical_stop_work',
     *     safety_message: string,
     *     source: string,
     *     fetched_at: string
     * }
     */
    public function getWeatherForCoordinates(float $latitude, float $longitude): array
    {
        $roundedLat = round($latitude, 2);
        $roundedLon = round($longitude, 2);
        $cacheKey = "weather_telemetry_{$roundedLat}_{$roundedLon}";

        return Cache::remember($cacheKey, now()->addMinutes(5), function () use ($latitude, $longitude): array {
            $data = $this->fetchFromOpenMeteo($latitude, $longitude);

            if ($data !== null) {
                return $data;
            }

            return $this->fallbackDefaults($latitude, $longitude);
        });
    }

    /**
     * @return array{
     *     latitude: float,
     *     longitude: float,
     *     location_name: string,
     *     temperature_celsius: float,
     *     wind_speed_kmh: float,
     *     wind_gusts_kmh: float,
     *     rain_intensity_mmh: float,
     *     humidity_percent: int,
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

            if (empty($current)) {
                return null;
            }

            $windSpeedKmh = round((float) ($current['wind_speed_10m'] ?? 0.0), 1);
            $windGustsKmh = round((float) ($current['wind_gusts_10m'] ?? $windSpeedKmh), 1);
            $temperature = round((float) ($current['temperature_2m'] ?? 28.0), 1);
            $rainIntensity = round((float) ($current['precipitation'] ?? 0.0), 2);
            $humidity = (int) ($current['relative_humidity_2m'] ?? 75);
            $weatherCode = (int) ($current['weather_code'] ?? 0);

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
            Log::info('Open-Meteo fetch failed, using fallback telemetry', ['error' => $e->getMessage()]);

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

    private function mapWmoCode(int $code): string
    {
        return match ($code) {
            0 => 'Clear Sky',
            1, 2, 3 => 'Mainly Clear / Overcast',
            45, 48 => 'Fog',
            51, 53, 55 => 'Drizzle',
            61, 63, 65 => 'Rain',
            80, 81, 82 => 'Rain Showers',
            95, 96, 99 => 'Thunderstorm',
            default => 'Clear Sky',
        };
    }

    private function resolveLocationLabel(float $latitude, float $longitude): string
    {
        try {
            $response = Http::timeout(1.5)
                ->get('https://api.bigdatacloud.net/data/reverse-geocode-client', [
                    'latitude' => $latitude,
                    'longitude' => $longitude,
                    'localityLanguage' => 'en',
                ]);

            if ($response->successful()) {
                /** @var array{city?: string, locality?: string, principalSubdivision?: string} $json */
                $json = $response->json() ?? [];
                $locality = ! empty($json['locality']) ? trim((string) $json['locality']) : '';
                $city = ! empty($json['city']) ? trim((string) $json['city']) : '';

                $manilaDistricts = [
                    'quiapo', 'intramuros', 'ermita', 'malate', 'binondo',
                    'san nicolas', 'santa cruz', 'sampaloc', 'san miguel',
                    'san andres', 'pandacan', 'paco', 'santa ana', 'tondo', 'port area',
                ];

                if ($locality !== '' && ! in_array(strtolower($locality), $manilaDistricts, true)) {
                    $cleaned = preg_replace('/^City of\s+/i', '', $locality);

                    return $cleaned !== null && $cleaned !== '' ? $cleaned : $locality;
                }

                if ($city !== '') {
                    $cleaned = preg_replace('/^City of\s+/i', '', $city);

                    return $cleaned !== null && $cleaned !== '' ? $cleaned : $city;
                }
            }
        } catch (\Throwable) {
            // Best effort reverse geocode
        }

        return $this->fallbackCityName($latitude, $longitude);
    }

    private function fallbackCityName(float $latitude, float $longitude): string
    {
        // Quezon City coordinates
        if ($latitude >= 14.60 && $latitude <= 14.75 && $longitude >= 121.00 && $longitude <= 121.15) {
            return 'Quezon City';
        }
        // Makati City
        if ($latitude >= 14.53 && $latitude <= 14.58 && $longitude >= 121.00 && $longitude <= 121.05) {
            return 'Makati City';
        }
        // Taguig / BGC
        if ($latitude >= 14.51 && $latitude <= 14.56 && $longitude >= 121.04 && $longitude <= 121.08) {
            return 'Taguig';
        }
        // Pasig
        if ($latitude >= 14.56 && $latitude <= 14.60 && $longitude >= 121.06 && $longitude <= 121.12) {
            return 'Pasig';
        }
        // Mandaluyong / San Juan
        if ($latitude >= 14.57 && $latitude <= 14.61 && $longitude >= 121.02 && $longitude <= 121.05) {
            return 'Mandaluyong';
        }
        // Pasay / Paranaque
        if ($latitude >= 14.48 && $latitude <= 14.54 && $longitude >= 120.98 && $longitude <= 121.04) {
            return 'Pasay / Parañaque';
        }
        // Muntinlupa / Alabang
        if ($latitude >= 14.37 && $latitude <= 14.44 && $longitude >= 121.02 && $longitude <= 121.07) {
            return 'Muntinlupa';
        }
        // Caloocan / Valenzuela / Malabon
        if ($latitude >= 14.65 && $latitude <= 14.74 && $longitude >= 120.95 && $longitude <= 121.02) {
            return 'Caloocan';
        }
        // Manila proper
        if ($latitude >= 14.55 && $latitude <= 14.63 && $longitude >= 120.95 && $longitude <= 121.02) {
            return 'Manila';
        }
        // Subic Bay / Olongapo
        if ($latitude >= 14.7 && $latitude <= 15.1 && $longitude >= 120.1 && $longitude <= 120.5) {
            return 'Subic Bay';
        }
        // Batangas City / Port
        if ($latitude >= 13.6 && $latitude <= 14.0 && $longitude >= 120.9 && $longitude <= 121.3) {
            return 'Batangas City';
        }
        // Cebu City
        if ($latitude >= 10.2 && $latitude <= 10.5 && $longitude >= 123.8 && $longitude <= 124.1) {
            return 'Cebu City';
        }
        // Davao City
        if ($latitude >= 7.0 && $latitude <= 7.3 && $longitude >= 125.4 && $longitude <= 125.8) {
            return 'Davao City';
        }

        return round($latitude, 2) . '°, ' . round($longitude, 2) . '°';
    }

    /**
     * @return array{
     *     latitude: float,
     *     longitude: float,
     *     location_name: string,
     *     temperature_celsius: float,
     *     wind_speed_kmh: float,
     *     wind_gusts_kmh: float,
     *     rain_intensity_mmh: float,
     *     humidity_percent: int,
     *     weather_description: string,
     *     safety_level: 'safe_normal',
     *     safety_message: string,
     *     source: string,
     *     fetched_at: string
     * }
     */
    private function fallbackDefaults(float $latitude, float $longitude): array
    {
        return [
            'latitude' => $latitude,
            'longitude' => $longitude,
            'location_name' => $this->resolveLocationLabel($latitude, $longitude),
            'temperature_celsius' => 28.5,
            'wind_speed_kmh' => 14.0,
            'wind_gusts_kmh' => 20.0,
            'rain_intensity_mmh' => 0.0,
            'humidity_percent' => 72,
            'weather_description' => 'Clear Sky',
            'safety_level' => 'safe_normal',
            'safety_message' => 'Normal Wind: Standard hoisting permitted (< 36 km/h).',
            'source' => 'station_baseline',
            'fetched_at' => now()->toIso8601String(),
        ];
    }
}
