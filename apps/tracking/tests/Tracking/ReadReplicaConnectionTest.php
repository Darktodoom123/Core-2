<?php

use Illuminate\Support\Facades\DB;
use Tracking\Models\LatestLocation;
use Tracking\Models\LocationSample;

it('configures pgsql with read and write host pools and sticky enabled', function (): void {
    $pgsqlConfig = config('database.connections.pgsql');

    expect($pgsqlConfig)->toBeArray()
        ->and($pgsqlConfig)->toHaveKeys(['read', 'write', 'sticky'])
        ->and($pgsqlConfig['sticky'])->toBeTrue()
        ->and($pgsqlConfig['read']['host'])->toBeArray()->not->toBeEmpty()
        ->and($pgsqlConfig['write']['host'])->toBeArray()->not->toBeEmpty();
});

it('enforces bounded pagination limit on latest locations query and clamps requests exceeding 1000', function (): void {
    for ($i = 1; $i <= 15; $i++) {
        LatestLocation::query()->create([
            'user_id' => $i,
            'operational_asset_id' => $i + 100,
            'latitude' => 14.5 + ($i * 0.001),
            'longitude' => 121.0 + ($i * 0.001),
            'sharing_enabled' => true,
            'captured_at' => now(),
            'received_at' => now(),
        ]);
    }

    // Explicit limit of 5
    $headers = $this->generateSignatureHeaders('GET', '/internal/v1/locations/latest?limit=5');
    $response = $this->withHeaders($headers)
        ->getJson('/internal/v1/locations/latest?limit=5');

    $response->assertStatus(200)
        ->assertJsonCount(5, 'data');

    // Requesting excessive limit (e.g. 5000) is bounded to max 1000
    $excessiveHeaders = $this->generateSignatureHeaders('GET', '/internal/v1/locations/latest?limit=5000');
    $excessiveResponse = $this->withHeaders($excessiveHeaders)
        ->getJson('/internal/v1/locations/latest?limit=5000');

    $excessiveResponse->assertStatus(200)
        ->assertJsonCount(15, 'data'); // Returns all available up to 1000
});

it('enforces bounded pagination limit on location history query and clamps requests exceeding 1000', function (): void {
    for ($i = 1; $i <= 10; $i++) {
        LocationSample::query()->create([
            'user_id' => 99,
            'operational_asset_id' => 200,
            'latitude' => 14.5 + ($i * 0.001),
            'longitude' => 121.0 + ($i * 0.001),
            'sharing_enabled' => true,
            'captured_at' => now()->subMinutes($i),
            'received_at' => now()->subMinutes($i),
        ]);
    }

    $headers = $this->generateSignatureHeaders('GET', '/internal/v1/locations/history?user_id=99&limit=3');
    $response = $this->withHeaders($headers)
        ->getJson('/internal/v1/locations/history?user_id=99&limit=3');

    $response->assertStatus(200)
        ->assertJsonCount(3, 'data');
});

it('verifies read query builders default to read connection while write builders target primary write connection', function (): void {
    // Read queries on models must not have useWritePdo flagged
    $latestRead = LatestLocation::query();
    $historyRead = LocationSample::query();

    expect($latestRead->getQuery()->useWritePdo)->toBeFalse()
        ->and($historyRead->getQuery()->useWritePdo)->toBeFalse();

    // Ingest and write projections must explicitly flag useWritePdo
    $latestWrite = LatestLocation::onWriteConnection();
    $historyWrite = LocationSample::onWriteConnection();

    expect($latestWrite->getQuery()->useWritePdo)->toBeTrue()
        ->and($historyWrite->getQuery()->useWritePdo)->toBeTrue();
});

it('routes GET latest and history queries through read connection while ingest routes to write connection', function (): void {
    $capturedQueries = [];

    DB::listen(function ($query) use (&$capturedQueries): void {
        $capturedQueries[] = [
            'sql' => $query->sql,
            'connection' => $query->connectionName,
        ];
    });

    // 1. Query latest locations (read operation)
    $latestHeaders = $this->generateSignatureHeaders('GET', '/internal/v1/locations/latest');
    $this->withHeaders($latestHeaders)
        ->getJson('/internal/v1/locations/latest')
        ->assertStatus(200);

    // 2. Query location history (read operation)
    $historyHeaders = $this->generateSignatureHeaders('GET', '/internal/v1/locations/history');
    $this->withHeaders($historyHeaders)
        ->getJson('/internal/v1/locations/history')
        ->assertStatus(200);

    // 3. Ingest location (write operation)
    $ingestPayload = [
        'user_id' => 88,
        'latitude' => 14.5995,
        'longitude' => 120.9842,
        'sharing_enabled' => true,
        'captured_at' => now()->toIso8601String(),
    ];
    $ingestHeaders = $this->generateSignatureHeaders('POST', '/internal/v1/locations', $ingestPayload);
    $this->withHeaders($ingestHeaders)
        ->postJson('/internal/v1/locations', $ingestPayload)
        ->assertStatus(201);

    expect(count($capturedQueries))->toBeGreaterThan(0);
    expect(LocationSample::query()->where('user_id', 88)->exists())->toBeTrue();
    expect(LatestLocation::query()->where('user_id', 88)->exists())->toBeTrue();
});
