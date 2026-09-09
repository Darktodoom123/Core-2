<?php

use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Weather\Services\LocationWeatherService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('rejects unauthenticated requests to weather telemetry', function (): void {
    $response = $this->getJson('/api/v1/telemetry/weather');

    $response->assertStatus(401);
});

it('returns weather telemetry with lifting safety guidelines for valid GPS coordinates', function (): void {
    /** @var User $worker */
    $worker = User::factory()->create(['is_active' => true]);
    $worker->syncRoles([RoleName::CraneOperator->value]);
    $token = $worker->createToken('Mobile Token')->plainTextToken;

    $response = $this->withToken($token)
        ->getJson('/api/v1/telemetry/weather?latitude=14.5995&longitude=120.9842');

    $response->assertStatus(200)
        ->assertJsonStructure([
            'data' => [
                'latitude',
                'longitude',
                'location_name',
                'temperature_celsius',
                'wind_speed_kmh',
                'wind_gusts_kmh',
                'rain_intensity_mmh',
                'humidity_percent',
                'weather_description',
                'safety_level',
                'safety_message',
                'source',
                'fetched_at',
            ],
        ]);

    $data = $response->json('data');
    expect($data['latitude'])->toBe(14.5995)
        ->and($data['longitude'])->toBe(120.9842)
        ->and($data['safety_level'])->toBeIn(['safe_normal', 'warning_caution', 'critical_stop_work']);
});

it('validates coordinate boundaries for weather telemetry', function (): void {
    /** @var User $worker */
    $worker = User::factory()->create(['is_active' => true]);
    $worker->syncRoles([RoleName::CraneOperator->value]);
    $token = $worker->createToken('Mobile Token')->plainTextToken;

    $response = $this->withToken($token)
        ->getJson('/api/v1/telemetry/weather?latitude=999&longitude=120.9842');

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['latitude']);
});

it('evaluates crane lifting safety wind thresholds accurately according to DOLE regulations', function (): void {
    $service = new LocationWeatherService;

    // Normal safe lifting conditions (< 36 km/h)
    $safe = $service->evaluateSafety(15.0, 22.0, 0.0);
    expect($safe['level'])->toBe('safe_normal');

    // High wind caution (36 - 44 km/h)
    $caution = $service->evaluateSafety(38.0, 42.0, 0.0);
    expect($caution['level'])->toBe('warning_caution');

    // Mandatory stop work (>= 45 km/h)
    $critical = $service->evaluateSafety(46.0, 52.0, 0.0);
    expect($critical['level'])->toBe('critical_stop_work');
});
