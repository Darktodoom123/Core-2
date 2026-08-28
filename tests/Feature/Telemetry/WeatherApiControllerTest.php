<?php

declare(strict_types=1);

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

test('returns site weather telemetry for an active job', function (): void {
    Http::fake([
        'https://api.tomorrow.io/v4/weather/realtime*' => Http::response([
            'data' => [
                'values' => [
                    'windSpeed' => 7.0, // 25.2 km/h
                    'windGust' => 9.5,  // 34.2 km/h
                    'temperature' => 28.0,
                    'rainIntensity' => 0.0,
                    'humidity' => 80,
                    'weatherCode' => 1000,
                ],
            ],
        ], 200),
    ]);

    /** @var User $operator */
    $operator = User::factory()->create(['is_active' => true]);
    $operator->syncRoles([RoleName::CraneOperator->value]);
    $token = $operator->createToken('Mobile Token')->plainTextToken;

    /** @var DispatchJob $job */
    $job = DispatchJob::query()->create([
        'reference' => 'DISP-TOWER-001',
        'client' => 'Highrise Towers Inc',
        'title' => 'Tower Crane Hoisting Shift',
        'site' => 'BGC Tower Site',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Working,
        'version' => 1,
        'created_by' => $operator->id,
    ]);

    $response = $this->withToken($token)
        ->getJson("/api/v1/dispatch/jobs/{$job->id}/weather?lat=14.5547&lon=121.0494");

    $response->assertStatus(200)
        ->assertJsonPath('data.job_id', $job->id)
        ->assertJsonPath('data.job_reference', 'DISP-TOWER-001')
        ->assertJsonPath('data.wind_speed_kmh', 25.2)
        ->assertJsonPath('data.wind_gusts_kmh', 34.2)
        ->assertJsonPath('data.safety_level', 'safe_normal');
});

test('records high wind weather standby with free slew requirement calculation', function (): void {
    /** @var User $operator */
    $operator = User::factory()->create(['is_active' => true]);
    $operator->syncRoles([RoleName::CraneOperator->value]);
    $token = $operator->createToken('Mobile Token')->plainTextToken;

    /** @var DispatchJob $job */
    $job = DispatchJob::query()->create([
        'reference' => 'DISP-TOWER-002',
        'client' => 'City Center Corp',
        'title' => 'Structural Lift Shift',
        'site' => 'Makati Tower',
        'priority' => DispatchPriority::Priority,
        'status' => DispatchStatus::Working,
        'version' => 1,
        'created_by' => $operator->id,
    ]);

    $response = $this->withToken($token)
        ->postJson("/api/v1/dispatch/jobs/{$job->id}/weather-standby", [
            'anemometer_wind_kmh' => 48.5,
            'reason' => 'high_wind',
            'remarks' => 'Wind gusts exceeded 45 km/h limit. Free-slew engaged.',
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('data.anemometer_wind_kmh', 48.5)
        ->assertJsonPath('data.reason', 'high_wind')
        ->assertJsonPath('data.free_slew_required', true);
});

test('automatically uses pinned site coordinates from dispatch job without requiring query parameters', function (): void {
    Http::fake([
        'https://api.tomorrow.io/v4/weather/realtime*' => Http::response([
            'data' => [
                'values' => [
                    'windSpeed' => 6.0,
                    'windGust' => 8.0,
                    'temperature' => 29.5,
                    'rainIntensity' => 0.0,
                    'humidity' => 75,
                    'weatherCode' => 1000,
                ],
            ],
        ], 200),
    ]);

    /** @var User $operator */
    $operator = User::factory()->create(['is_active' => true]);
    $operator->syncRoles([RoleName::CraneOperator->value]);
    $token = $operator->createToken('Mobile Token')->plainTextToken;

    /** @var DispatchJob $job */
    $job = DispatchJob::query()->create([
        'reference' => 'DISP-TOWER-PINNED',
        'client' => 'Ayala Land',
        'title' => 'Core Wall Pouring',
        'site' => 'Parklinks Tower 1, Pasig',
        'site_latitude' => 14.5821,
        'site_longitude' => 121.0645,
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Working,
        'version' => 1,
        'created_by' => $operator->id,
    ]);

    // Request without query params - backend resolves pinned site coordinates
    $response = $this->withToken($token)
        ->getJson("/api/v1/dispatch/jobs/{$job->id}/weather");

    $response->assertStatus(200)
        ->assertJsonPath('data.job_id', $job->id)
        ->assertJsonPath('data.is_pinned', true)
        ->assertJsonPath('data.site_latitude', 14.5821)
        ->assertJsonPath('data.site_longitude', 121.0645);
});

test('rejects unauthenticated weather requests with 401', function (): void {
    $response = $this->getJson('/api/v1/dispatch/jobs/999/weather');
    $response->assertStatus(401);
});
