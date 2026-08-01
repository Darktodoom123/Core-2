<?php

use App\Platform\Identity\Models\User;
use App\Platform\Tracking\Models\LocationUpdate;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('prunes precise coordinates older than 30 days while preserving non-coordinate audit metadata', function () {
    $user = User::factory()->create();

    // Recent update (10 days old)
    $recent = LocationUpdate::query()->create([
        'user_id' => $user->id,
        'latitude' => 14.5995,
        'longitude' => 120.9842,
        'accuracy_metres' => 5,
        'source' => 'mobile',
        'sharing_enabled' => true,
        'captured_at' => now()->subDays(10),
        'received_at' => now()->subDays(10),
    ]);

    // Old update (35 days old)
    $old = LocationUpdate::query()->create([
        'user_id' => $user->id,
        'latitude' => 14.6010,
        'longitude' => 120.9850,
        'accuracy_metres' => 8,
        'source' => 'mobile',
        'sharing_enabled' => true,
        'captured_at' => now()->subDays(35),
        'received_at' => now()->subDays(35),
    ]);

    // Run pruning command
    $this->artisan('location:prune')->assertSuccessful();

    $recent->refresh();
    $old->refresh();

    // Recent coordinates are intact
    expect((float) $recent->latitude)->toBe(14.5995)
        ->and((float) $recent->longitude)->toBe(120.9842);

    // Old coordinates are pruned (set to null)
    expect($old->latitude)->toBeNull()
        ->and($old->longitude)->toBeNull();

    // Non-coordinate audit facts are preserved
    expect($old->user_id)->toBe($user->id)
        ->and($old->source)->toBe('mobile')
        ->and($old->sharing_enabled)->toBeTrue()
        ->and($old->captured_at->toIso8601String())->toBe(now()->subDays(35)->toIso8601String());
});
