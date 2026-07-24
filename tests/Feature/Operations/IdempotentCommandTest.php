<?php

use App\Enums\RoleName;
use App\Models\CommandLog;
use App\Models\LocationUpdate;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('replays cached responses for duplicate command submissions with identical command_id', function () {
    $driver = User::factory()->create();
    $driver->syncRoles([RoleName::Driver->value]);

    $commandId = (string) Str::uuid();

    // First command submission
    $response1 = $this->actingAs($driver)
        ->withHeader('Idempotency-Key', $commandId)
        ->post('/operations/locations', [
            'latitude' => 14.5995,
            'longitude' => 120.9842,
            'accuracy_metres' => 5,
            'sharing_enabled' => true,
            'captured_at' => now()->toIso8601String(),
        ]);

    $response1->assertRedirect('/');

    expect(LocationUpdate::query()->where('user_id', $driver->id)->count())->toBe(1);
    expect(CommandLog::query()->where('command_id', $commandId)->count())->toBe(1);

    // Duplicate command submission with same commandId
    $response2 = $this->actingAs($driver)
        ->withHeader('Idempotency-Key', $commandId)
        ->post('/operations/locations', [
            'latitude' => 14.5995,
            'longitude' => 120.9842,
            'accuracy_metres' => 5,
            'sharing_enabled' => true,
            'captured_at' => now()->toIso8601String(),
        ]);

    // Replayed response returns cached result without creating a duplicate LocationUpdate row
    expect(LocationUpdate::query()->where('user_id', $driver->id)->count())->toBe(1);
    expect(CommandLog::query()->where('command_id', $commandId)->count())->toBe(1);
});

it('logs command details in command_logs table', function () {
    $driver = User::factory()->create();
    $driver->syncRoles([RoleName::Driver->value]);

    $commandId = (string) Str::uuid();

    $this->actingAs($driver)->post('/operations/locations', [
        'command_id' => $commandId,
        'latitude' => 14.5995,
        'longitude' => 120.9842,
        'sharing_enabled' => true,
        'captured_at' => now()->toIso8601String(),
    ]);

    $log = CommandLog::query()->where('command_id', $commandId)->sole();
    expect($log->user_id)->toBe($driver->id)
        ->and($log->action_name)->toBe('location.store')
        ->and($log->status)->toBe('completed');
});
