<?php

use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tracking\Models\LatestLocation;
use Tracking\Models\LocationSample;
use Tracking\Models\TrackingCommandReceipt;

uses(RefreshDatabase::class);

it('ingests a valid location sample and creates projection and sample record', function (): void {
    $payload = [
        'command_id' => '00000000-0000-0000-0000-000000000001',
        'user_id' => 101,
        'operational_asset_id' => 202,
        'dispatch_job_id' => 303,
        'latitude' => 14.5995123,
        'longitude' => 120.9842456,
        'accuracy_metres' => 4.5,
        'speed' => 12.8,
        'remarks' => 'En route to site',
        'source' => 'mobile',
        'sharing_enabled' => true,
        'captured_at' => CarbonImmutable::now()->subSeconds(30)->toIso8601String(),
    ];

    $response = $this->postJson('/internal/v1/locations', $payload);

    $response->assertStatus(201)
        ->assertJsonPath('data.user_id', 101)
        ->assertJsonPath('data.operational_asset_id', 202)
        ->assertJsonPath('data.dispatch_job_id', 303)
        ->assertJsonPath('data.sharing_enabled', true)
        ->assertJsonPath('data.freshness_status', 'fresh');

    // Verify location_samples record
    expect(LocationSample::count())->toBe(1);
    $sample = LocationSample::first();
    expect($sample->user_id)->toBe(101)
        ->and($sample->operational_asset_id)->toBe(202)
        ->and($sample->dispatch_job_id)->toBe(303)
        ->and(round((float) $sample->latitude, 5))->toBe(14.59951)
        ->and(round((float) $sample->longitude, 5))->toBe(120.98425)
        ->and($sample->command_id)->toBe('00000000-0000-0000-0000-000000000001');

    // Verify latest_locations projection record
    expect(LatestLocation::count())->toBe(1);
    $latest = LatestLocation::first();
    expect($latest->user_id)->toBe(101)
        ->and($latest->location_sample_id)->toBe($sample->id)
        ->and(round((float) $latest->latitude, 5))->toBe(14.59951);

    // Verify idempotency receipt
    expect(TrackingCommandReceipt::count())->toBe(1);
    $receipt = TrackingCommandReceipt::first();
    expect($receipt->command_id)->toBe('00000000-0000-0000-0000-000000000001')
        ->and($receipt->location_sample_id)->toBe($sample->id)
        ->and($receipt->payload_hash)->not->toBeNull();
});

it('enforces idempotency on duplicate command ID in request body', function (): void {
    $payload = [
        'command_id' => '00000000-0000-0000-0000-000000000002',
        'user_id' => 102,
        'operational_asset_id' => 203,
        'latitude' => 14.6000,
        'longitude' => 120.9900,
        'accuracy_metres' => 5.0,
        'source' => 'mobile',
        'sharing_enabled' => true,
    ];

    $response1 = $this->postJson('/internal/v1/locations', $payload);
    $response1->assertStatus(201);
    $id1 = $response1->json('data.id');

    // Replay exact same request
    $response2 = $this->postJson('/internal/v1/locations', $payload);
    $response2->assertStatus(201);
    $id2 = $response2->json('data.id');

    expect($id1)->toBe($id2)
        ->and(LocationSample::count())->toBe(1)
        ->and(LatestLocation::count())->toBe(1)
        ->and(TrackingCommandReceipt::count())->toBe(1);
});

it('returns 409 conflict when duplicate command ID is sent with differing payload', function (): void {
    $commandId = '00000000-0000-0000-0000-000000000099';

    $payload1 = [
        'command_id' => $commandId,
        'user_id' => 102,
        'latitude' => 14.6000,
        'longitude' => 120.9900,
        'sharing_enabled' => true,
    ];

    $this->postJson('/internal/v1/locations', $payload1)->assertStatus(201);

    // Replay same command_id with completely different coordinates
    $payload2 = [
        'command_id' => $commandId,
        'user_id' => 102,
        'latitude' => 14.8000,
        'longitude' => 121.2000,
        'sharing_enabled' => true,
    ];

    $this->postJson('/internal/v1/locations', $payload2)
        ->assertStatus(409)
        ->assertJsonPath('error', 'conflict');

    // Sample count remains 1
    expect(LocationSample::count())->toBe(1);
});

it('enforces idempotency when command ID is sent via X-Command-Id header', function (): void {
    $payload = [
        'user_id' => 103,
        'latitude' => 14.6100,
        'longitude' => 120.9950,
        'accuracy_metres' => 3.0,
        'source' => 'mobile',
        'sharing_enabled' => true,
    ];

    $response1 = $this->withHeader('X-Command-Id', '00000000-0000-0000-0000-000000000003')
        ->postJson('/internal/v1/locations', $payload);
    $response1->assertStatus(201);

    // Replay with identical header
    $response2 = $this->withHeader('X-Command-Id', '00000000-0000-0000-0000-000000000003')
        ->postJson('/internal/v1/locations', $payload);
    $response2->assertStatus(201);

    expect(LocationSample::count())->toBe(1)
        ->and(LatestLocation::count())->toBe(1)
        ->and(TrackingCommandReceipt::count())->toBe(1);
});

it('rejects conflicting idempotency headers or body with 422 validation error', function (): void {
    // Differing Idempotency-Key and X-Command-Id
    $this->withHeaders([
        'Idempotency-Key' => '00000000-0000-0000-0000-000000000004',
        'X-Command-Id' => '00000000-0000-0000-0000-000000000005',
    ])->postJson('/internal/v1/locations', [
        'user_id' => 103,
        'latitude' => 14.6100,
        'longitude' => 120.9950,
    ])->assertStatus(422)
        ->assertJsonValidationErrors(['command_id']);

    // Differing header and body command_id
    $this->withHeader('X-Command-Id', '00000000-0000-0000-0000-000000000006')
        ->postJson('/internal/v1/locations', [
            'command_id' => '00000000-0000-0000-0000-000000000007',
            'user_id' => 103,
            'latitude' => 14.6100,
            'longitude' => 120.9950,
        ])->assertStatus(422)
        ->assertJsonValidationErrors(['command_id']);
});

it('validates required fields and coordinate boundaries', function (): void {
    // Missing required user_id, latitude, longitude
    $this->postJson('/internal/v1/locations', [])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['user_id', 'latitude', 'longitude']);

    // Invalid latitude (> 90)
    $this->postJson('/internal/v1/locations', [
        'user_id' => 104,
        'latitude' => 95.0,
        'longitude' => 120.0,
    ])->assertStatus(422)
        ->assertJsonValidationErrors(['latitude']);

    // Invalid longitude (< -180)
    $this->postJson('/internal/v1/locations', [
        'user_id' => 104,
        'latitude' => 14.0,
        'longitude' => -185.0,
    ])->assertStatus(422)
        ->assertJsonValidationErrors(['longitude']);
});

it('protects against out-of-order GPS samples from overwriting newer latest position projection', function (): void {
    $now = CarbonImmutable::now();

    // 1. Ingest newer sample captured at T = now
    $this->postJson('/internal/v1/locations', [
        'user_id' => 105,
        'latitude' => 14.7000,
        'longitude' => 121.0000,
        'captured_at' => $now->toIso8601String(),
    ])->assertStatus(201);

    $latest1 = LatestLocation::where('user_id', 105)->first();
    expect((float) $latest1->latitude)->toBe(14.7);

    // 2. Ingest delayed sample captured at T = now - 10 minutes
    $this->postJson('/internal/v1/locations', [
        'user_id' => 105,
        'latitude' => 14.6500,
        'longitude' => 120.9500,
        'captured_at' => $now->subMinutes(10)->toIso8601String(),
    ])->assertStatus(201);

    // Both samples are saved in history
    expect(LocationSample::where('user_id', 105)->count())->toBe(2);

    // But latest_locations read projection preserves the newer coordinate (14.7, 121.0)
    $latest2 = LatestLocation::where('user_id', 105)->first();
    expect((float) $latest2->latitude)->toBe(14.7)
        ->and((float) $latest2->longitude)->toBe(121.0);
});

it('clears coordinates and updates projection to offline when sharing_enabled is false', function (): void {
    // 1. Active sharing first
    $this->postJson('/internal/v1/locations', [
        'user_id' => 106,
        'latitude' => 14.5000,
        'longitude' => 120.9000,
        'sharing_enabled' => true,
        'captured_at' => now()->subMinutes(5)->toIso8601String(),
    ])->assertStatus(201);

    $latest = LatestLocation::where('user_id', 106)->first();
    expect($latest->sharing_enabled)->toBeTrue()
        ->and((float) $latest->latitude)->toBe(14.5);

    // 2. Turn off sharing (coordinates omitted/nullable)
    $this->postJson('/internal/v1/locations', [
        'user_id' => 106,
        'sharing_enabled' => false,
        'captured_at' => now()->toIso8601String(),
    ])->assertStatus(201)
        ->assertJsonPath('data.sharing_enabled', false)
        ->assertJsonPath('data.latitude', null)
        ->assertJsonPath('data.longitude', null)
        ->assertJsonPath('data.freshness_status', 'offline');

    $latest->refresh();
    expect($latest->sharing_enabled)->toBeFalse()
        ->and($latest->latitude)->toBeNull()
        ->and($latest->longitude)->toBeNull();
});

it('prevents delayed replayed GPS samples from turning sharing back on after it was disabled', function (): void {
    $now = CarbonImmutable::now();

    // 1. User was sharing at 10:00
    $this->postJson('/internal/v1/locations', [
        'user_id' => 107,
        'latitude' => 14.5000,
        'longitude' => 120.9000,
        'sharing_enabled' => true,
        'captured_at' => $now->subMinutes(10)->toIso8601String(),
    ])->assertStatus(201);

    // 2. User explicitly turns off sharing at 10:05
    $this->postJson('/internal/v1/locations', [
        'user_id' => 107,
        'sharing_enabled' => false,
        'captured_at' => $now->subMinutes(5)->toIso8601String(),
    ])->assertStatus(201);

    $latest = LatestLocation::where('user_id', 107)->first();
    expect($latest->sharing_enabled)->toBeFalse()
        ->and($latest->latitude)->toBeNull();

    // 3. Delayed packet from 10:02 arrives with sharing_enabled = true
    $this->postJson('/internal/v1/locations', [
        'user_id' => 107,
        'latitude' => 14.5100,
        'longitude' => 120.9100,
        'sharing_enabled' => true,
        'captured_at' => $now->subMinutes(8)->toIso8601String(),
    ])->assertStatus(201);

    // Sharing must remain off and coordinates must remain null!
    $latest->refresh();
    expect($latest->sharing_enabled)->toBeFalse()
        ->and($latest->latitude)->toBeNull()
        ->and($latest->longitude)->toBeNull();
});

it('reassigns asset to newer reporting user so asset only appears once in latest projections', function (): void {
    // User 1 reports on Asset 500
    $this->postJson('/internal/v1/locations', [
        'user_id' => 108,
        'operational_asset_id' => 500,
        'latitude' => 14.5000,
        'longitude' => 120.9000,
    ])->assertStatus(201);

    // User 2 now reports on Asset 500
    $this->postJson('/internal/v1/locations', [
        'user_id' => 109,
        'operational_asset_id' => 500,
        'latitude' => 14.5500,
        'longitude' => 120.9500,
    ])->assertStatus(201);

    // Query latest for Asset 500
    $response = $this->getJson('/internal/v1/locations/latest?operational_asset_id=500');
    $response->assertStatus(200)
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.user_id', 109);

    // User 1's projection has asset_id cleared
    $user1Latest = LatestLocation::where('user_id', 108)->first();
    expect($user1Latest->operational_asset_id)->toBeNull();
});

it('rejects future captured_at timestamps exceeding 300-second clock tolerance with 422 validation error', function (): void {
    $futureTime = CarbonImmutable::now()->addMinutes(10);

    $response = $this->postJson('/internal/v1/locations', [
        'user_id' => 110,
        'latitude' => 14.5995,
        'longitude' => 120.9842,
        'sharing_enabled' => true,
        'captured_at' => $futureTime->toIso8601String(),
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['captured_at']);

    expect(LocationSample::query()->where('user_id', 110)->count())->toBe(0);
});

it('maintains strict idempotency and single sample persistence on duplicate command delivery', function (): void {
    $commandId = '00000000-0000-0000-0000-000000000777';
    $payload = [
        'command_id' => $commandId,
        'user_id' => 111,
        'latitude' => 14.5995,
        'longitude' => 120.9842,
        'sharing_enabled' => true,
        'captured_at' => now()->toIso8601String(),
    ];

    // First request
    $r1 = $this->postJson('/internal/v1/locations', $payload);
    $r1->assertStatus(201);

    // Repeated request with same command ID and payload
    $r2 = $this->postJson('/internal/v1/locations', $payload);
    $r2->assertStatus(201)
        ->assertJson($r1->json());

    // Verify exactly ONE sample was created in location_samples table
    expect(LocationSample::query()->where('command_id', $commandId)->count())->toBe(1);
});

it('does not reassign asset when delayed out-of-order sample is received with older timestamp', function (): void {
    $now = CarbonImmutable::now();

    // User 108 reports on Asset 500 at 12:00
    $this->postJson('/internal/v1/locations', [
        'user_id' => 108,
        'operational_asset_id' => 500,
        'latitude' => 14.5000,
        'longitude' => 120.9000,
        'captured_at' => $now->subHours(1)->toIso8601String(),
    ])->assertStatus(201);

    // User 109 now sends an out-of-order sample for Asset 500 from 10:00 (older than User 108's sample)
    $this->postJson('/internal/v1/locations', [
        'user_id' => 109,
        'operational_asset_id' => 500,
        'latitude' => 14.5500,
        'longitude' => 120.9500,
        'captured_at' => $now->subHours(3)->toIso8601String(),
    ])->assertStatus(201);

    // Asset 500 must REMAIN assigned to User 108 (who reported at 12:00)
    $response = $this->getJson('/internal/v1/locations/latest?operational_asset_id=500');
    $response->assertStatus(200)
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.user_id', 108);

    $user1Latest = LatestLocation::where('user_id', 108)->first();
    expect($user1Latest->operational_asset_id)->toBe(500);

    // User 109's latest projection must not have asset 500
    $user2Latest = LatestLocation::where('user_id', 109)->first();
    expect($user2Latest->operational_asset_id)->toBeNull();
});

it('detects 409 conflict when duplicate command ID is sent with differing coordinates even when sharing_enabled is false', function (): void {
    $commandId = '00000000-0000-0000-0000-000000000888';

    $r1 = $this->postJson('/internal/v1/locations', [
        'command_id' => $commandId,
        'user_id' => 112,
        'latitude' => 14.5000,
        'longitude' => 120.9000,
        'sharing_enabled' => false,
    ]);
    $r1->assertStatus(201);

    $r2 = $this->postJson('/internal/v1/locations', [
        'command_id' => $commandId,
        'user_id' => 112,
        'latitude' => 15.0000, // Different latitude
        'longitude' => 120.9000,
        'sharing_enabled' => false,
    ]);
    $r2->assertStatus(409)
        ->assertJsonPath('error', 'conflict');
});

it('handles duplicate command ID with alternate ISO-8601 timestamp formatting as idempotent replay without 409 conflict', function (): void {
    $commandId = '00000000-0000-0000-0000-000000000999';

    // First delivery with 'Z' suffix
    $r1 = $this->postJson('/internal/v1/locations', [
        'command_id' => $commandId,
        'user_id' => 113,
        'latitude' => 14.5995,
        'longitude' => 120.9842,
        'accuracy_metres' => 5.0,
        'sharing_enabled' => true,
        'captured_at' => '2026-09-16T10:00:00Z',
    ]);
    $r1->assertStatus(201);

    // Replay with '+00:00' timezone syntax (semantically identical timestamp)
    $r2 = $this->postJson('/internal/v1/locations', [
        'command_id' => $commandId,
        'user_id' => 113,
        'latitude' => 14.5995,
        'longitude' => 120.9842,
        'accuracy_metres' => 5.0,
        'sharing_enabled' => true,
        'captured_at' => '2026-09-16T10:00:00+00:00',
    ]);

    // Must return HTTP 201 cached receipt, NOT HTTP 409 Conflict
    $r2->assertStatus(201)
        ->assertJson($r1->json());

    expect(LocationSample::query()->where('command_id', $commandId)->count())->toBe(1);
});

it('reliably transfers asset to newer reporting user under ascending ID row locks', function (): void {
    // User 200 (higher ID) acquires Asset 700 first
    $this->postJson('/internal/v1/locations', [
        'user_id' => 200,
        'operational_asset_id' => 700,
        'latitude' => 14.5000,
        'longitude' => 120.9000,
        'captured_at' => now()->subMinutes(10)->toIso8601String(),
    ])->assertStatus(201);

    // User 100 (lower ID) now acquires Asset 700 with a newer timestamp
    $this->postJson('/internal/v1/locations', [
        'user_id' => 100,
        'operational_asset_id' => 700,
        'latitude' => 14.5500,
        'longitude' => 120.9500,
        'captured_at' => now()->toIso8601String(),
    ])->assertStatus(201);

    // Asset 700 must be assigned exclusively to User 100
    $user100Latest = LatestLocation::where('user_id', 100)->first();
    expect($user100Latest->operational_asset_id)->toBe(700);

    $user200Latest = LatestLocation::where('user_id', 200)->first();
    expect($user200Latest->operational_asset_id)->toBeNull();
});
