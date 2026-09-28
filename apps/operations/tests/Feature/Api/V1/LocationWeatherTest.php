<?php

use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Weather\Services\LocationWeatherService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('rejects unauthenticated requests to weather telemetry', function (): void {
    $response = $this->getJson('/api/v1/telemetry/weather');

    $response->assertStatus(401);
});

it('returns weather telemetry with lifting safety guidelines for valid GPS coordinates', function (): void {
    Http::fake(['api.open-meteo.com/*' => Http::response(['current' => [
        'temperature_2m' => 30.1, 'relative_humidity_2m' => 70, 'precipitation' => 0,
        'weather_code' => 1, 'wind_speed_10m' => 12.0, 'wind_gusts_10m' => 18.0,
    ]])]);
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

it('requires a real position instead of defaulting to a fixed location', function (): void {
    /** @var User $worker */
    $worker = User::factory()->create(['is_active' => true]);
    $worker->syncRoles([RoleName::CraneOperator->value]);
    $token = $worker->createToken('Mobile Token')->plainTextToken;

    $this->withToken($token)
        ->getJson('/api/v1/telemetry/weather')
        ->assertStatus(422)
        ->assertJsonValidationErrors(['latitude', 'longitude']);
});

it('reports weather as unavailable instead of inventing safe conditions when the provider fails', function (): void {
    Http::fake(['api.open-meteo.com/*' => Http::response([], 500)]);

    /** @var User $worker */
    $worker = User::factory()->create(['is_active' => true]);
    $worker->syncRoles([RoleName::CraneOperator->value]);
    $token = $worker->createToken('Mobile Token')->plainTextToken;

    $this->withToken($token)
        ->getJson('/api/v1/telemetry/weather?latitude=14.7620&longitude=121.0775')
        ->assertStatus(503)
        ->assertJsonMissingPath('data')
        ->assertJsonPath('message', fn (string $message): bool => str_contains($message, 'Do not assume'));
});

it('treats a reading without wind as incomplete rather than calm', function (): void {
    Http::fake(['api.open-meteo.com/*' => Http::response(['current' => ['temperature_2m' => 30.0]])]);

    expect(app(LocationWeatherService::class)->getWeatherForCoordinates(14.7, 121.0))->toBeNull();
});
