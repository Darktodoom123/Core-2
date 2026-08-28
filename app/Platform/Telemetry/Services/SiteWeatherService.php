<?php

declare(strict_types=1);

namespace App\Platform\Telemetry\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

final class SiteWeatherService
{
    /**
     * @return array{
     *     latitude: float,
     *     longitude: float,
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
    public function getSiteWeather(float $latitude, float $longitude): array
    {
        $roundedLat = round($latitude, 3);
        $roundedLon = round($longitude, 3);
        $cacheKey = "site_weather_{$roundedLat}_{$roundedLon}";

        /** @var array{latitude: float, longitude: float, temperature_celsius: float, wind_speed_kmh: float, wind_gusts_kmh: float, rain_intensity_mmh: float, humidity_percent: int, weather_description: string, safety_level: 'safe_normal'|'warning_caution'|'critical_stop_work', safety_message: string, source: string, fetched_at: string} */
        return Cache::remember($cacheKey, now()->addMinutes(15), function () use ($roundedLat, $roundedLon): array {
            return $this->fetchFromTomorrowIo($roundedLat, $roundedLon)
                ?? $this->fetchFromOpenMeteo($roundedLat, $roundedLon)
                ?? $this->fallbackDefaults($roundedLat, $roundedLon);
        });
    }

    /**
     * @return array{latitude: float, longitude: float, temperature_celsius: float, wind_speed_kmh: float, wind_gusts_kmh: float, rain_intensity_mmh: float, humidity_percent: int, weather_description: string, safety_level: 'safe_normal'|'warning_caution'|'critical_stop_work', safety_message: string, source: string, fetched_at: string}|null
     */
    private function fetchFromTomorrowIo(float $latitude, float $longitude): ?array
    {
        $apiKey = config('services.tomorrow_io.key');
        if (! is_string($apiKey) || trim($apiKey) === '') {
            return null;
        }

        try {
            $response = Http::withOptions(['verify' => ! app()->environment('local', 'testing')])
                ->timeout(6)
                ->get('https://api.tomorrow.io/v4/weather/realtime', [
                    'location' => "{$latitude},{$longitude}",
                    'apikey' => $apiKey,
                ]);

            if (! $response->successful()) {
                Log::warning('Tomorrow.io API returned non-success response', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return null;
            }

            /** @var array{data?: array{values?: array<string, mixed>}} $json */
            $json = $response->json() ?? [];
            $values = $json['data']['values'] ?? [];

            if (empty($values)) {
                return null;
            }

            // Tomorrow.io returns wind speed and gust in m/s; convert to km/h (1 m/s = 3.6 km/h)
            $windSpeedMs = (float) ($values['windSpeed'] ?? 0.0);
            $windGustMs = (float) ($values['windGust'] ?? $windSpeedMs);
            $windSpeedKmh = round($windSpeedMs * 3.6, 1);
            $windGustsKmh = round($windGustMs * 3.6, 1);

            $temperature = round((float) ($values['temperature'] ?? 28.0), 1);
            $rainIntensity = round((float) ($values['rainIntensity'] ?? 0.0), 2);
            $humidity = (int) ($values['humidity'] ?? 75);
            $weatherCode = (int) ($values['weatherCode'] ?? 1000);

            $safety = $this->evaluateSafety($windSpeedKmh, $windGustsKmh, $rainIntensity);

            return [
                'latitude' => $latitude,
                'longitude' => $longitude,
                'temperature_celsius' => $temperature,
                'wind_speed_kmh' => $windSpeedKmh,
                'wind_gusts_kmh' => $windGustsKmh,
                'rain_intensity_mmh' => $rainIntensity,
                'humidity_percent' => $humidity,
                'weather_description' => $this->mapTomorrowCode($weatherCode),
                'safety_level' => $safety['level'],
                'safety_message' => $safety['message'],
                'source' => 'tomorrow_io',
                'fetched_at' => now()->toIso8601String(),
            ];
        } catch (\Throwable $e) {
            Log::warning('Tomorrow.io fetch failed, falling back', ['error' => $e->getMessage()]);

            return null;
        }
    }

    /**
     * @return array{latitude: float, longitude: float, temperature_celsius: float, wind_speed_kmh: float, wind_gusts_kmh: float, rain_intensity_mmh: float, humidity_percent: int, weather_description: string, safety_level: 'safe_normal'|'warning_caution'|'critical_stop_work', safety_message: string, source: string, fetched_at: string}|null
     */
    private function fetchFromOpenMeteo(float $latitude, float $longitude): ?array
    {
        try {
            $response = Http::withOptions(['verify' => ! app()->environment('local', 'testing')])
                ->timeout(6)
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
            Log::warning('Open-Meteo fetch failed', ['error' => $e->getMessage()]);

            return null;
        }
    }

    /**
     * @return array{level: 'safe_normal'|'warning_caution'|'critical_stop_work', message: string}
     */
    private function evaluateSafety(float $windSpeedKmh, float $windGustsKmh, float $rainMm): array
    {
        $maxWind = max($windSpeedKmh, $windGustsKmh);

        if ($maxWind >= 45.0) {
            return [
                'level' => 'critical_stop_work',
                'message' => 'Mandatory Stop Work: Wind speed exceeds DOLE 45 km/h safety limit. Engage free-slew (weather-vane) mode immediately.',
            ];
        }

        if ($maxWind >= 36.0 || $rainMm >= 10.0) {
            return [
                'level' => 'warning_caution',
                'message' => 'High Wind Caution (36-44 km/h): Restrict large surface area loads (formwork/cladding). Maintain double taglines.',
            ];
        }

        return [
            'level' => 'safe_normal',
            'message' => 'Normal Conditions: Wind speed within safe operating limits (< 36 km/h). Standard hoisting permitted.',
        ];
    }

    private function mapTomorrowCode(int $code): string
    {
        return match ($code) {
            1000 => 'Clear',
            1100 => 'Mostly Clear',
            1101 => 'Partly Cloudy',
            1102 => 'Mostly Cloudy',
            1001 => 'Cloudy',
            2000, 2100 => 'Fog',
            4000 => 'Drizzle',
            4001 => 'Rain',
            4200 => 'Light Rain',
            4201 => 'Heavy Rain',
            8000 => 'Thunderstorm',
            default => 'Normal',
        };
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
            default => 'Normal',
        };
    }

    /**
     * @return array{latitude: float, longitude: float, temperature_celsius: float, wind_speed_kmh: float, wind_gusts_kmh: float, rain_intensity_mmh: float, humidity_percent: int, weather_description: string, safety_level: 'safe_normal', safety_message: string, source: string, fetched_at: string}
     */
    private function fallbackDefaults(float $latitude, float $longitude): array
    {
        return [
            'latitude' => $latitude,
            'longitude' => $longitude,
            'temperature_celsius' => 28.0,
            'wind_speed_kmh' => 12.0,
            'wind_gusts_kmh' => 18.0,
            'rain_intensity_mmh' => 0.0,
            'humidity_percent' => 75,
            'weather_description' => 'Fair (Station Baseline)',
            'safety_level' => 'safe_normal',
            'safety_message' => 'Normal Conditions (Default baseline). Verify with cab physical anemometer.',
            'source' => 'default_fallback',
            'fetched_at' => now()->toIso8601String(),
        ];
    }
}
