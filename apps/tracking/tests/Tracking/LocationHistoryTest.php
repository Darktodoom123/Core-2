<?php

use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tracking\Models\LocationSample;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $base = CarbonImmutable::parse('2026-09-01T08:00:00Z');

    // Create 10 historical samples across 2 users and 2 assets
    for ($i = 0; $i < 10; $i++) {
        LocationSample::create([
            'user_id' => ($i % 2 === 0) ? 10 : 20,
            'operational_asset_id' => ($i % 2 === 0) ? 100 : 200,
            'dispatch_job_id' => ($i < 5) ? 500 : 600,
            'latitude' => 14.5000 + ($i * 0.01),
            'longitude' => 120.9000 + ($i * 0.01),
            'accuracy_metres' => 5.0,
            'source' => 'mobile',
            'sharing_enabled' => true,
            'captured_at' => $base->addHours($i),
            'received_at' => $base->addHours($i)->addSeconds(5),
        ]);
    }
});

it('retrieves location history with default pagination and ordering', function (): void {
    $response = $this->getJson('/internal/v1/locations');

    $response->assertStatus(200)
        ->assertJsonCount(10, 'data');

    // Default order is captured_at descending
    $first = $response->json('data.0');
    $last = $response->json('data.9');
    expect($first['captured_at'])->toBeGreaterThan($last['captured_at']);
});

it('filters history by user_id', function (): void {
    $response = $this->getJson('/internal/v1/locations?user_id=10');

    $response->assertStatus(200)
        ->assertJsonCount(5, 'data');

    foreach ($response->json('data') as $sample) {
        expect($sample['user_id'])->toBe(10);
    }
});

it('filters history by operational_asset_id', function (): void {
    $response = $this->getJson('/internal/v1/locations?operational_asset_id=200');

    $response->assertStatus(200)
        ->assertJsonCount(5, 'data');

    foreach ($response->json('data') as $sample) {
        expect($sample['operational_asset_id'])->toBe(200);
    }
});

it('filters history by dispatch_job_id', function (): void {
    $response = $this->getJson('/internal/v1/locations?dispatch_job_id=500');

    $response->assertStatus(200)
        ->assertJsonCount(5, 'data');

    foreach ($response->json('data') as $sample) {
        expect($sample['dispatch_job_id'])->toBe(500);
    }
});

it('filters history by date_from and date_to range', function (): void {
    // Range from T+2h to T+4h (3 samples: 2h, 3h, 4h)
    $from = CarbonImmutable::parse('2026-09-01T10:00:00Z')->toIso8601String();
    $to = CarbonImmutable::parse('2026-09-01T12:00:00Z')->toIso8601String();

    $fromParam = urlencode($from);
    $toParam = urlencode($to);
    $response = $this->getJson("/internal/v1/locations?date_from={$fromParam}&date_to={$toParam}");

    $response->assertStatus(200)
        ->assertJsonCount(3, 'data');
});

it('sorts history in ascending order by captured_at', function (): void {
    $response = $this->getJson('/internal/v1/locations?order_by=captured_at&order_direction=asc');

    $response->assertStatus(200);
    $data = $response->json('data');

    expect($data[0]['captured_at'])->toBeLessThan($data[9]['captured_at']);
});

it('limits history results with limit parameter', function (): void {
    $response = $this->getJson('/internal/v1/locations?limit=3');

    $response->assertStatus(200)
        ->assertJsonCount(3, 'data');
});

it('safely handles invalid date format in date filters without crashing', function (): void {
    $response = $this->getJson('/internal/v1/locations?date_from=invalid-date&date_to=not-a-date');

    $response->assertStatus(200)
        ->assertJsonCount(10, 'data');
});

it('paginates location history with limit and page parameters', function (): void {
    $page1 = $this->getJson('/internal/v1/locations?limit=4&page=1');
    $page1->assertStatus(200)->assertJsonCount(4, 'data');

    $page2 = $this->getJson('/internal/v1/locations?limit=4&page=2');
    $page2->assertStatus(200)->assertJsonCount(4, 'data');

    $page3 = $this->getJson('/internal/v1/locations?limit=4&page=3');
    $page3->assertStatus(200)->assertJsonCount(2, 'data');

    // Page 1 and Page 2 must not overlap
    $page1Ids = collect($page1->json('data'))->pluck('id')->all();
    $page2Ids = collect($page2->json('data'))->pluck('id')->all();
    expect(array_intersect($page1Ids, $page2Ids))->toBeEmpty();
});

it('supports explicit offset parameter for slicing history', function (): void {
    $response = $this->getJson('/internal/v1/locations?limit=3&offset=8');
    $response->assertStatus(200)
        ->assertJsonCount(2, 'data'); // Total 10, offset 8 returns remaining 2
});
