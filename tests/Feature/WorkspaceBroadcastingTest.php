<?php

use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Workspace\Events\WorkspaceUpdated;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);

    config([
        'broadcasting.default' => 'reverb',
        'broadcasting.connections.reverb' => [
            'driver' => 'reverb',
            'key' => 'test-key',
            'secret' => 'test-secret',
            'app_id' => 'test-app',
            'options' => [
                'host' => '127.0.0.1',
                'port' => 8080,
                'scheme' => 'http',
                'useTLS' => false,
            ],
        ],
    ]);

    require base_path('routes/channels.php');
});

test('workspace updated event broadcasts on private operations workspace channel', function () {
    Event::fake();

    WorkspaceUpdated::dispatch('dispatch', 'updated');

    Event::assertDispatched(WorkspaceUpdated::class, function ($event) {
        return $event->resourceType === 'dispatch'
            && $event->action === 'updated'
            && count($event->broadcastOn()) === 1
            && $event->broadcastOn()[0]->name === 'private-operations.workspace';
    });
});

test('workspace updated event returns correct broadcast payload', function () {
    $event = new WorkspaceUpdated('asset', 'created', '2026-07-31T12:00:00Z');

    expect($event->broadcastAs())->toBe('WorkspaceUpdated');
    expect($event->broadcastWith())->toBe([
        'resource_type' => 'asset',
        'action' => 'created',
        'timestamp' => '2026-07-31T12:00:00Z',
    ]);
});

test('active verified operational users can authenticate the private workspace channel', function () {
    $user = User::factory()->create();
    $user->syncRoles([RoleName::OperationsManager->value]);

    $this->actingAs($user)
        ->post('/broadcasting/auth', [
            'socket_id' => '1234.5678',
            'channel_name' => 'private-operations.workspace',
        ])
        ->assertOk()
        ->assertJsonStructure(['auth']);
});

test('workspace channel authentication rejects users outside the workspace access boundary', function (array $attributes) {
    $user = User::factory()->create($attributes);
    $user->syncRoles([RoleName::OperationsManager->value]);

    $this->actingAs($user)
        ->post('/broadcasting/auth', [
            'socket_id' => '1234.5678',
            'channel_name' => 'private-operations.workspace',
        ])
        ->assertForbidden();
})->with([
    'inactive user' => [['is_active' => false]],
    'suspended user' => [['suspended_at' => now()]],
    'unverified user' => [['email_verified_at' => null]],
]);

test('workspace channel authentication rejects unauthenticated users', function () {
    $this->post('/broadcasting/auth', [
        'socket_id' => '1234.5678',
        'channel_name' => 'private-operations.workspace',
    ])->assertForbidden();
});

test('workspace channel authentication rejects users without an operational role', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post('/broadcasting/auth', [
            'socket_id' => '1234.5678',
            'channel_name' => 'private-operations.workspace',
        ])
        ->assertForbidden();
});
