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

    // Old coordinates are pruned (set to null)
    expect($old->latitude)->toBeNull()
        ->and($old->longitude)->toBeNull();

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
