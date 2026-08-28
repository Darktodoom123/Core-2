<?php

declare(strict_types=1);

use App\Platform\Telemetry\Services\SiteWeatherService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Cache::flush();
    Config::set('services.tomorrow_io.key', 'test-api-key');
});

test('fetches and normalizes weather from Tomorrow.io with metric conversion', function () {
    Http::fake([
        'https://api.tomorrow.io/v4/weather/realtime*' => Http::response([
            'data' => [
                'values' => [
                    'windSpeed' => 6.5, // 6.5 * 3.6 = 23.4 km/h
                    'windGust' => 8.0,  // 8.0 * 3.6 = 28.8 km/h
                    'temperature' => 29.5,
                    'rainIntensity' => 0.0,
                    'humidity' => 80,
                    'weatherCode' => 1000,
                ],
            ],
        ], 200),
    ]);

    $service = new SiteWeatherService;
    $weather = $service->getSiteWeather(14.5995, 120.9842);

    expect($weather['source'])->toBe('tomorrow_io')
        ->and($weather['wind_speed_kmh'])->toBe(23.4)
        ->and($weather['wind_gusts_kmh'])->toBe(28.8)
        ->and($weather['temperature_celsius'])->toBe(29.5)
        ->and($weather['safety_level'])->toBe('safe_normal')
        ->and($weather['weather_description'])->toBe('Clear');
});

test('evaluates DOLE safety levels correctly for high wind and critical stop work', function () {
    // Test Caution zone (36 - 44 km/h) -> 10.5 m/s = 37.8 km/h
    Http::fake([
        'https://api.tomorrow.io/v4/weather/realtime*' => Http::sequence()
            ->push([
                'data' => [
                    'values' => [
                        'windSpeed' => 10.5,
                        'windGust' => 11.0,
                        'temperature' => 27.0,
                        'rainIntensity' => 2.0,
                        'humidity' => 85,
                        'weatherCode' => 4001,
                    ],
                ],
            ], 200)
            ->push([
                'data' => [
                    'values' => [
                        'windSpeed' => 13.0, // 46.8 km/h -> critical_stop_work
                        'windGust' => 16.0,
                        'temperature' => 24.0,
                        'rainIntensity' => 15.0,
                        'humidity' => 95,
                        'weatherCode' => 8000,
                    ],
                ],
            ], 200),
    ]);

    $service = new SiteWeatherService;
    $cautionWeather = $service->getSiteWeather(14.600, 121.000);

    expect($cautionWeather['safety_level'])->toBe('warning_caution')
        ->and($cautionWeather['safety_message'])->toContain('High Wind Caution');

    Cache::flush();

    $criticalWeather = $service->getSiteWeather(14.700, 121.100);

    expect($criticalWeather['safety_level'])->toBe('critical_stop_work')
        ->and($criticalWeather['safety_message'])->toContain('Mandatory Stop Work');
});

test('falls back to Open-Meteo when Tomorrow.io returns 429 rate limit', function () {
    Http::fake([
        'https://api.tomorrow.io/v4/weather/realtime*' => Http::response(['message' => 'Rate limit exceeded'], 429),
        'https://api.open-meteo.com/v1/forecast*' => Http::response([
            'current' => [
                'temperature_2m' => 28.2,
                'relative_humidity_2m' => 78,
                'precipitation' => 0.0,
                'weather_code' => 1,
                'wind_speed_10m' => 18.5,
                'wind_gusts_10m' => 24.0,
            ],
        ], 200),
    ]);

    $service = new SiteWeatherService;
    $weather = $service->getSiteWeather(14.5995, 120.9842);

    expect($weather['source'])->toBe('open_meteo')
        ->and($weather['wind_speed_kmh'])->toBe(18.5)
        ->and($weather['wind_gusts_kmh'])->toBe(24.0)
        ->and($weather['safety_level'])->toBe('safe_normal');
});

test('caches weather responses to preserve rate limits', function () {
    Http::fake([
        'https://api.tomorrow.io/v4/weather/realtime*' => Http::response([
            'data' => [
                'values' => [
                    'windSpeed' => 5.0,
                    'windGust' => 7.0,
                    'temperature' => 30.0,
                    'rainIntensity' => 0.0,
                    'humidity' => 70,
                    'weatherCode' => 1000,
                ],
            ],
        ], 200),
    ]);

    $service = new SiteWeatherService;
    $service->getSiteWeather(14.500, 121.000);
    $service->getSiteWeather(14.500, 121.000);

    // Only one external HTTP request made because second call hits cache
    Http::assertSentCount(1);
});

test('falls back to Open-Meteo when Tomorrow.io has 500 server error or connection failure', function () {
    Http::fake([
        'https://api.tomorrow.io/v4/weather/realtime*' => Http::response(['message' => 'Internal server error'], 500),
        'https://api.open-meteo.com/v1/forecast*' => Http::response([
            'current' => [
                'temperature_2m' => 31.0,
                'relative_humidity_2m' => 70,
                'precipitation' => 0.0,
                'weather_code' => 0,
                'wind_speed_10m' => 14.0,
                'wind_gusts_10m' => 20.0,
            ],
        ], 200),
    ]);

    $service = new SiteWeatherService;
    $weather = $service->getSiteWeather(14.800, 121.200);

    expect($weather['source'])->toBe('open_meteo')
        ->and($weather['temperature_celsius'])->toBe(31.0)
        ->and($weather['wind_speed_kmh'])->toBe(14.0);
});
