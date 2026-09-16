<?php

use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Tracking\Contracts\TrackingClientInterface;
use App\Platform\Tracking\Data\LocationSampleDto;
use App\Platform\Tracking\Exceptions\TrackingServiceUnavailableException;
use App\Platform\Tracking\Services\RedisStreamTrackingClient;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('publishes location sample to Redis stream with canonical HMAC signature and returns HTTP 202 Accepted', function (): void {
    /** @var User $worker */
    $worker = User::factory()->create(['is_active' => true]);
    $worker->syncRoles([RoleName::CraneOperator->value]);
    $token = $worker->createToken('Mobile Token')->plainTextToken;

    /** @var DispatchJob $job */
    $job = DispatchJob::query()->create([
        'reference' => 'DISP-STREAM-001',
        'client' => 'Stream Corp',
        'title' => 'Async Stream Test',
        'site' => 'Site A',
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

    // Mock Redis xadd command
    Redis::shouldReceive('connection')
        ->andReturnSelf();

    Redis::shouldReceive('xadd')
        ->once()
        ->withArgs(function ($stream, $id, $fields, $maxLen, $approximate) use ($commandId, $worker, $job): bool {
            expect($stream)->toBe('telemetry.gps.v1')
                ->and($id)->toBe('*')
                ->and($maxLen)->toBe(100000)
                ->and($approximate)->toBeTrue()
                ->and($fields['command_id'])->toBe($commandId)
                ->and($fields['user_id'])->toBe((string) $worker->id)
                ->and($fields['service'])->toBe('operations')
                ->and($fields['signature'])->toBeString()->not->toBeEmpty()
                ->and($fields['timestamp'])->toBeString()->not->toBeEmpty()
                ->and($fields['digest'])->toBeString()->not->toBeEmpty();

            $payload = json_decode((string) $fields['payload'], true);
            expect($payload['latitude'])->toBe(14.5995)
                ->and($payload['longitude'])->toBe(120.9842)
                ->and($payload['dispatch_job_id'])->toBe($job->id);

            return true;
        })
        ->andReturn('1726500000000-0');

    // Bind RedisStreamTrackingClient as TrackingClientInterface
    app()->singleton(TrackingClientInterface::class, fn () => new RedisStreamTrackingClient(
        streamKey: 'telemetry.gps.v1',
        maxLen: 100000,
        secret: 'test-tracking-service-secret',
    ));

    $response = $this->withToken($token)
        ->withHeader('Idempotency-Key', $commandId)
        ->postJson('/api/v1/locations', [
            'dispatch_job_id' => $job->id,
            'latitude' => 14.5995,
            'longitude' => 120.9842,
            'accuracy_metres' => 5.0,
            'sharing_enabled' => true,
            'captured_at' => now()->toIso8601String(),
        ]);

    $response->assertStatus(202)
        ->assertJsonPath('message', 'Telemetry sample queued for ingestion.')
        ->assertJsonPath('data.latitude', 14.5995)
        ->assertJsonPath('data.longitude', 120.9842)
        ->assertJsonPath('data.dispatch_job_id', $job->id)
        ->assertJsonPath('data.status', 'queued')
        ->assertJsonPath('data.stream_id', '1726500000000-0');
});

it('returns HTTP 503 Service Unavailable when Redis is unreachable to allow mobile client to retain sample in SQLite outbox', function (): void {
    /** @var User $worker */
    $worker = User::factory()->create(['is_active' => true]);
    $worker->syncRoles([RoleName::CraneOperator->value]);
    $token = $worker->createToken('Mobile Token')->plainTextToken;

    /** @var DispatchJob $job */
    $job = DispatchJob::query()->create([
        'reference' => 'DISP-STREAM-503',
        'client' => 'Offline Client',
        'title' => 'Redis Failure Test',
        'site' => 'Site B',
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

    // Mock Redis failure
    Redis::shouldReceive('connection')
        ->andReturnSelf();

    Redis::shouldReceive('xadd')
        ->andThrow(new RuntimeException('Connection refused to redis:6379'));

    Redis::shouldReceive('command')
        ->andThrow(new RuntimeException('Connection refused to redis:6379'));

    app()->singleton(TrackingClientInterface::class, fn () => new RedisStreamTrackingClient(
        streamKey: 'telemetry.gps.v1',
        maxLen: 100000,
        secret: 'test-tracking-service-secret',
    ));

    $response = $this->withToken($token)
        ->withHeader('Idempotency-Key', $commandId)
        ->postJson('/api/v1/locations', [
            'dispatch_job_id' => $job->id,
            'latitude' => 14.5995,
            'longitude' => 120.9842,
            'accuracy_metres' => 5.0,
            'sharing_enabled' => true,
            'captured_at' => now()->toIso8601String(),
        ]);

    $response->assertStatus(503)
        ->assertJsonPath('error', 'service_unavailable')
        ->assertJsonPath('message', 'Telemetry streaming service unavailable. Sample retained in outbox.');
});

it('replays identical 202 Accepted response on idempotent re-submission of same command_id', function (): void {
    /** @var User $worker */
    $worker = User::factory()->create(['is_active' => true]);
    $worker->syncRoles([RoleName::CraneOperator->value]);
    $token = $worker->createToken('Mobile Token')->plainTextToken;

    /** @var DispatchJob $job */
    $job = DispatchJob::query()->create([
        'reference' => 'DISP-STREAM-REPLAY',
        'client' => 'Replay Client',
        'title' => 'Replay Test',
        'site' => 'Site C',
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

    Redis::shouldReceive('connection')->andReturnSelf();
    Redis::shouldReceive('xadd')->once()->andReturn('1726500000001-0');

    app()->singleton(TrackingClientInterface::class, fn () => new RedisStreamTrackingClient(
        streamKey: 'telemetry.gps.v1',
        maxLen: 100000,
        secret: 'test-tracking-service-secret',
    ));

    $payload = [
        'dispatch_job_id' => $job->id,
        'latitude' => 14.5995,
        'longitude' => 120.9842,
        'accuracy_metres' => 5.0,
        'sharing_enabled' => true,
        'captured_at' => now()->toIso8601String(),
    ];

    $firstResponse = $this->withToken($token)
        ->withHeader('Idempotency-Key', $commandId)
        ->postJson('/api/v1/locations', $payload);

    $firstResponse->assertStatus(202)
        ->assertJsonPath('data.stream_id', '1726500000001-0');

    // Second request with same command_id and same payload - should NOT call Redis again
    $secondResponse = $this->withToken($token)
        ->withHeader('Idempotency-Key', $commandId)
        ->postJson('/api/v1/locations', $payload);

    $secondResponse->assertStatus(202)
        ->assertJsonPath('data.stream_id', '1726500000001-0');
});

it('strictly rejects Redis stream publishing from inside a database transaction to protect the network boundary', function (): void {
    $client = new RedisStreamTrackingClient(
        streamKey: 'telemetry.gps.v1',
        maxLen: 100000,
        secret: 'test-tracking-service-secret',
    );

    $sample = LocationSampleDto::fromArray([
        'command_id' => (string) Str::uuid(),
        'user_id' => 1,
        'latitude' => 14.5995,
        'longitude' => 120.9842,
        'sharing_enabled' => true,
        'captured_at' => now(),
        'received_at' => now(),
    ]);

    DB::transaction(function () use ($client, $sample): void {
        expect(fn () => $client->publish($sample))
            ->toThrow(LogicException::class, 'Redis stream publishing must occur outside database transactions.');
    });
});

it('rejects short or placeholder secrets in production environments', function (): void {
    $originalEnv = app()->environment();
    try {
        app()->detectEnvironment(fn () => 'production');

        $client = new RedisStreamTrackingClient(
            streamKey: 'telemetry.gps.v1',
            maxLen: 100000,
            secret: 'short',
        );

        $sample = LocationSampleDto::fromArray([
            'command_id' => (string) Str::uuid(),
            'user_id' => 1,
            'latitude' => 14.5995,
            'longitude' => 120.9842,
            'sharing_enabled' => true,
            'captured_at' => now(),
            'received_at' => now(),
        ]);

        expect(fn () => $client->publish($sample))
            ->toThrow(RuntimeException::class, 'Insecure tracking service secret configured for production.');
    } finally {
        app()->detectEnvironment(fn () => $originalEnv);
    }
});

it('throws TrackingServiceUnavailableException when Redis XADD returns empty or false stream ID', function (): void {
    $client = new RedisStreamTrackingClient(
        streamKey: 'telemetry.gps.v1',
        maxLen: 100000,
        secret: 'test-tracking-service-secret',
    );

    $sample = LocationSampleDto::fromArray([
        'command_id' => (string) Str::uuid(),
        'user_id' => 1,
        'latitude' => 14.5995,
        'longitude' => 120.9842,
        'sharing_enabled' => true,
        'captured_at' => now(),
        'received_at' => now(),
    ]);

    Redis::shouldReceive('connection')->andReturnSelf();
    Redis::shouldReceive('xadd')->once()->andReturn(false);

    expect(fn () => $client->publish($sample))
        ->toThrow(TrackingServiceUnavailableException::class);
});
