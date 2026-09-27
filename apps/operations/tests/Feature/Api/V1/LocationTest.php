<?php

use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Tracking\Contracts\TrackingClientInterface;
use App\Platform\Tracking\Data\LatestLocationDto;
use App\Platform\Tracking\Data\LocationSampleDto;
use App\Platform\Tracking\Exceptions\TrackingServiceUnavailableException;
use App\Platform\Tracking\Models\LocationUpdate;
use App\Platform\Tracking\Testing\FakeTrackingClient;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Broadcasting\Broadcasters\NullBroadcaster;
use Illuminate\Broadcasting\BroadcastException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('allows field workers with tracking permission to share location', function (): void {
    /** @var User $worker */
    $worker = User::factory()->create(['is_active' => true]);
    $worker->syncRoles([RoleName::CraneOperator->value]);
    $token = $worker->createToken('Mobile Token')->plainTextToken;

    /** @var DispatchJob $job */
    $job = DispatchJob::query()->create([
        'reference' => 'DISP-LOC-001',
        'client' => 'Track Corp',
        'title' => 'Location Job',
        'site' => 'Site L',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::EnRoute,
        'version' => 1,
        'created_by' => $worker->id,
    ]);

    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $worker->id,
        'assignment_type' => 'driver',
        'assigned_by' => $worker->id,
        'created_at' => now(),
    ]);

    $commandId = (string) Str::uuid();

    $response = $this->withToken($token)
        ->withHeader('Idempotency-Key', $commandId)
        ->postJson('/api/v1/locations', [
            'dispatch_job_id' => $job->id,
            'latitude' => 37.7749,
            'longitude' => -122.4194,
            'accuracy_metres' => 10.5,
            'sharing_enabled' => true,
            'captured_at' => now()->toIso8601String(),
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('data.latitude', 37.7749)
        ->assertJsonPath('data.longitude', -122.4194)
        ->assertJsonPath('data.dispatch_job_id', $job->id);

    $this->assertDatabaseHas('location_updates', [
        'user_id' => $worker->id,
        'dispatch_job_id' => $job->id,
        'source' => 'field-mobile',
    ]);
});

it('denies location sharing if user lacks tracking permission', function (): void {
    /** @var User $worker */
    $worker = User::factory()->create(['is_active' => true]);
    // Assign role without tracking.share_own permission
    $worker->revokePermissionTo(PermissionName::TrackingShareOwn->value);
    $token = $worker->createToken('Mobile Token')->plainTextToken;

    $response = $this->withToken($token)
        ->withHeader('Idempotency-Key', (string) Str::uuid())
        ->postJson('/api/v1/locations', [
            'latitude' => 37.7749,
            'longitude' => -122.4194,
            'sharing_enabled' => true,
            'captured_at' => now()->toIso8601String(),
        ]);

    $response->assertStatus(403);
});

it('accepts a ping resent under the same command id once tracking is back up', function (): void {
    /** @var User $worker */
    $worker = User::factory()->create(['is_active' => true]);
    $worker->syncRoles([RoleName::CraneOperator->value]);
    $token = $worker->createToken('Mobile Token')->plainTextToken;
    $tracking = new class extends FakeTrackingClient
    {
        public bool $down = true;

        public function ingestLocation(LocationSampleDto $sample): LatestLocationDto
        {
            if ($this->down) {
                throw new TrackingServiceUnavailableException;
            }

            return parent::ingestLocation($sample);
        }
    };
    app()->instance(TrackingClientInterface::class, $tracking);
    /** @var DispatchJob $job */
    $job = DispatchJob::query()->create([
        'reference' => 'DISP-LOC-RETRY',
        'client' => 'Track Corp',
        'title' => 'Location Job',
        'site' => 'Site L',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::EnRoute,
        'version' => 1,
        'created_by' => $worker->id,
    ]);
    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $worker->id,
        'assignment_type' => 'driver',
        'assigned_by' => $worker->id,
    ]);
    $commandId = (string) Str::uuid();
    $ping = [
        'dispatch_job_id' => $job->id,
        'latitude' => 14.5995,
        'longitude' => 120.9842,
        'sharing_enabled' => true,
        'captured_at' => now()->toIso8601String(),
    ];

    $this->withToken($token)
        ->withHeader('X-Command-Id', $commandId)
        ->postJson('/api/v1/locations', $ping)
        ->assertStatus(503);

    $tracking->down = false;

    // A "try again" answer is not kept, so the retry runs instead of replaying it.
    $this->withToken($token)
        ->withHeader('X-Command-Id', $commandId)
        ->postJson('/api/v1/locations', $ping)
        ->assertStatus(201);

    // Once accepted, the same command id is answered from the record.
    $this->withToken($token)
        ->withHeader('X-Command-Id', $commandId)
        ->postJson('/api/v1/locations', $ping)
        ->assertStatus(201);

    expect(LocationUpdate::query()->where('user_id', $worker->id)->count())->toBe(1);
});

it('keeps an accepted ping when the live dashboard update cannot be sent', function (): void {
    Broadcast::extend('failing', fn () => new class extends NullBroadcaster
    {
        public function broadcast(array $channels, $event, array $payload = []): void
        {
            throw new BroadcastException('Reverb is down.');
        }
    });
    config([
        'broadcasting.default' => 'failing',
        'broadcasting.connections.failing' => ['driver' => 'failing'],
    ]);
    /** @var User $worker */
    $worker = User::factory()->create(['is_active' => true]);
    $worker->syncRoles([RoleName::CraneOperator->value]);
    /** @var DispatchJob $job */
    $job = DispatchJob::query()->create([
        'reference' => 'DISP-LOC-NOWS',
        'client' => 'Track Corp',
        'title' => 'Location Job',
        'site' => 'Site L',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::EnRoute,
        'version' => 1,
        'created_by' => $worker->id,
    ]);
    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $worker->id,
        'assignment_type' => 'driver',
        'assigned_by' => $worker->id,
    ]);

    $this->withToken($worker->createToken('Mobile Token')->plainTextToken)
        ->withHeader('X-Command-Id', (string) Str::uuid())
        ->postJson('/api/v1/locations', [
            'dispatch_job_id' => $job->id,
            'latitude' => 14.5995,
            'longitude' => 120.9842,
            'sharing_enabled' => true,
            'captured_at' => now()->toIso8601String(),
        ])
        ->assertStatus(201);

    expect(LocationUpdate::query()->where('user_id', $worker->id)->count())->toBe(1);
});
