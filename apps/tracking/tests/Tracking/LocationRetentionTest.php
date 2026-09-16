<?php

use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tracking\Models\LatestLocation;
use Tracking\Models\LocationSample;

uses(RefreshDatabase::class);

it('prunes precise coordinates older than 30 days while preserving audit records', function (): void {
    $now = CarbonImmutable::now();

    // 1. Recent sample (10 days old)
    $recent = LocationSample::create([
        'user_id' => 10,
        'operational_asset_id' => 100,
        'dispatch_job_id' => 500,
        'latitude' => 14.5995,
        'longitude' => 120.9842,
        'accuracy_metres' => 5.0,
        'source' => 'mobile',
        'sharing_enabled' => true,
        'captured_at' => $now->subDays(10),
        'received_at' => $now->subDays(10),
    ]);

    // 2. Old sample (35 days old)
    $old = LocationSample::create([
        'user_id' => 20,
        'operational_asset_id' => 200,
        'dispatch_job_id' => 600,
        'latitude' => 14.6010,
        'longitude' => 120.9850,
        'accuracy_metres' => 8.0,
        'source' => 'mobile',
        'sharing_enabled' => true,
        'captured_at' => $now->subDays(35),
        'received_at' => $now->subDays(35),
    ]);

    // 3. Old projection (35 days old)
    $oldProjection = LatestLocation::create([
        'user_id' => 20,
        'operational_asset_id' => 200,
        'latitude' => 14.6010,
        'longitude' => 120.9850,
        'sharing_enabled' => true,
        'captured_at' => $now->subDays(35),
        'received_at' => $now->subDays(35),
    ]);

    // Run pruning command
    $this->artisan('location:prune')
        ->expectsOutputToContain('Pruned coordinates for 1 location samples older than 30 days')
        ->assertSuccessful();

    $recent->refresh();
    $old->refresh();
    $oldProjection->refresh();

    // Recent coordinates remain intact
    expect((float) $recent->latitude)->toBe(14.5995)
        ->and((float) $recent->longitude)->toBe(120.9842);

    // Old coordinates and accuracy metrics are pruned (set to null)
    expect($old->latitude)->toBeNull()
        ->and($old->longitude)->toBeNull()
        ->and($old->accuracy_metres)->toBeNull();

    // Old projection coordinates are also pruned
    expect($oldProjection->latitude)->toBeNull()
        ->and($oldProjection->longitude)->toBeNull();

    // Audit metadata is preserved
    expect($old->user_id)->toBe(20)
        ->and($old->operational_asset_id)->toBe(200)
        ->and($old->dispatch_job_id)->toBe(600)
        ->and($old->source)->toBe('mobile')
        ->and($old->sharing_enabled)->toBeTrue()
        ->and($old->captured_at->toIso8601String())->toBe($now->subDays(35)->toIso8601String());
});

it('redacts coordinates upon ingestion for delayed offline samples older than 30 days while preserving audit metadata', function (): void {
    $now = CarbonImmutable::now();
    $delayedCapturedAt = $now->subDays(35);

    $response = $this->postJson('/internal/v1/locations', [
        'command_id' => '00000000-0000-0000-0000-000000000035',
        'user_id' => 88,
        'operational_asset_id' => 99,
        'dispatch_job_id' => 111,
        'latitude' => 14.5995,
        'longitude' => 120.9842,
        'accuracy_metres' => 6.0,
        'speed' => 15.0,
        'source' => 'mobile',
        'sharing_enabled' => true,
        'captured_at' => $delayedCapturedAt->toIso8601String(),
    ]);

    $response->assertStatus(201);

    // Coordinates in response projection must be null (redacted)
    $response->assertJsonPath('data.latitude', null)
        ->assertJsonPath('data.longitude', null)
        ->assertJsonPath('data.accuracy_metres', null)
        ->assertJsonPath('data.user_id', 88);

    // Assert sample persisted with coordinates redacted
    $sample = LocationSample::query()->where('command_id', '00000000-0000-0000-0000-000000000035')->firstOrFail();
    expect($sample->latitude)->toBeNull()
        ->and($sample->longitude)->toBeNull()
        ->and($sample->accuracy_metres)->toBeNull()
        ->and($sample->user_id)->toBe(88)
        ->and($sample->operational_asset_id)->toBe(99)
        ->and($sample->dispatch_job_id)->toBe(111)
        ->and($sample->captured_at->toIso8601String())->toBe($delayedCapturedAt->toIso8601String());

    // Assert latest location projection also has null coordinates
    $latest = LatestLocation::query()->where('user_id', 88)->firstOrFail();
    expect($latest->latitude)->toBeNull()
        ->and($latest->longitude)->toBeNull()
        ->and($latest->user_id)->toBe(88);
});
