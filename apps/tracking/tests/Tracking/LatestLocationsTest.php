<?php

use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tracking\Models\LatestLocation;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $now = CarbonImmutable::now();

    // User 1 on Asset 10 on Job 100 (fresh)
    LatestLocation::create([
        'user_id' => 1,
        'operational_asset_id' => 10,
        'dispatch_job_id' => 100,
        'latitude' => 14.5995,
        'longitude' => 120.9842,
        'sharing_enabled' => true,
        'captured_at' => $now->subSeconds(60),
        'received_at' => $now->subSeconds(60),
    ]);

    // User 2 on Asset 20 on Job 200 (delayed)
    LatestLocation::create([
        'user_id' => 2,
        'operational_asset_id' => 20,
        'dispatch_job_id' => 200,
        'latitude' => 14.6100,
        'longitude' => 120.9900,
        'sharing_enabled' => true,
        'captured_at' => $now->subMinutes(5),
        'received_at' => $now->subMinutes(5),
    ]);

    // User 3 on Asset 30 on Job 100 (stale)
    LatestLocation::create([
        'user_id' => 3,
        'operational_asset_id' => 30,
        'dispatch_job_id' => 100,
        'latitude' => 14.6200,
        'longitude' => 121.0000,
        'sharing_enabled' => true,
        'captured_at' => $now->subMinutes(20),
        'received_at' => $now->subMinutes(20),
    ]);

    // User 4 (offline - sharing disabled)
    LatestLocation::create([
        'user_id' => 4,
        'operational_asset_id' => 40,
        'latitude' => 14.6300,
        'longitude' => 121.0100,
        'sharing_enabled' => false,
        'captured_at' => $now->subSeconds(10),
        'received_at' => $now->subSeconds(10),
    ]);

    // User 5 (offline - old timestamp)
    LatestLocation::create([
        'user_id' => 5,
        'operational_asset_id' => 50,
        'latitude' => 14.6400,
        'longitude' => 121.0200,
        'sharing_enabled' => true,
        'captured_at' => $now->subHours(2),
        'received_at' => $now->subHours(2),
    ]);
});

it('retrieves all latest positions with correct freshness status', function (): void {
    $response = $this->getJson('/internal/v1/locations/latest');

    $response->assertStatus(200)
        ->assertJsonCount(5, 'data');

    $data = collect($response->json('data'));

    $user1 = $data->firstWhere('user_id', 1);
    expect($user1['freshness_status'])->toBe('fresh');

    $user2 = $data->firstWhere('user_id', 2);
    expect($user2['freshness_status'])->toBe('delayed');

    $user3 = $data->firstWhere('user_id', 3);
    expect($user3['freshness_status'])->toBe('stale');

    $user4 = $data->firstWhere('user_id', 4);
    expect($user4['freshness_status'])->toBe('offline');

    $user5 = $data->firstWhere('user_id', 5);
    expect($user5['freshness_status'])->toBe('offline');
});

it('filters latest positions by user_id', function (): void {
    $response = $this->getJson('/internal/v1/locations/latest?user_id=1');

    $response->assertStatus(200)
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.user_id', 1)
        ->assertJsonPath('data.0.operational_asset_id', 10);
});

it('filters latest positions by operational_asset_id and asset_id alias', function (): void {
    $res1 = $this->getJson('/internal/v1/locations/latest?operational_asset_id=20');
    $res1->assertStatus(200)
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.operational_asset_id', 20);

    $res2 = $this->getJson('/internal/v1/locations/latest?asset_id=20');
    $res2->assertStatus(200)
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.operational_asset_id', 20);
});

it('filters latest positions by dispatch_job_id and job_id alias', function (): void {
    $res1 = $this->getJson('/internal/v1/locations/latest?dispatch_job_id=100');
    $res1->assertStatus(200)
        ->assertJsonCount(2, 'data');

    $res2 = $this->getJson('/internal/v1/locations/latest?job_id=100');
    $res2->assertStatus(200)
        ->assertJsonCount(2, 'data');
});

it('returns empty array when no matching latest positions exist', function (): void {
    $response = $this->getJson('/internal/v1/locations/latest?user_id=9999');

    $response->assertStatus(200)
        ->assertJsonCount(0, 'data');
});
