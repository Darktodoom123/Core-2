<?php

use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Tracking\Contracts\TrackingClientInterface;
use App\Platform\Tracking\Data\LatestLocationDto;
use App\Platform\Tracking\Data\LocationSampleDto;
use App\Platform\Tracking\Exceptions\TrackingConflictException;
use App\Platform\Tracking\Models\LocationUpdate;
use App\Platform\Tracking\Services\HttpTrackingClient;
use App\Platform\Workspace\Events\WorkspaceUpdated;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('generates valid canonical HMAC-SHA256 signed request headers', function (): void {
    $secret = 'test-tracking-service-secret';
    $client = new HttpTrackingClient(
        baseUrl: 'http://localhost:8001',
        secret: $secret
    );

    $method = 'POST';
    $path = '/internal/v1/locations';
    $rawBody = '{"user_id":101,"latitude":14.5995}';

    $headers = $client->buildSignedHeaders($method, $path, $rawBody);

    expect($headers)->toHaveKey('X-Service-Name', 'operations')
        ->and($headers)->toHaveKey('X-Timestamp')
        ->and($headers)->toHaveKey('X-Payload-Digest')
        ->and($headers)->toHaveKey('X-Signature');

    $timestamp = $headers['X-Timestamp'];
    $digest = $headers['X-Payload-Digest'];
    $signature = $headers['X-Signature'];

    expect((int) $timestamp)->toBeGreaterThan(time() - 5)
        ->and($digest)->toBe(hash('sha256', $rawBody));

    $expectedSignature = hash_hmac('sha256', "POST\n/internal/v1/locations\n{$timestamp}\n{$digest}", $secret);
    expect($signature)->toBe($expectedSignature);
});

it('sends signed HTTP request to Tracking service and parses returned LatestLocationDto', function (): void {
    $secret = 'test-tracking-service-secret';
    $client = new HttpTrackingClient(
        baseUrl: 'http://localhost:8001',
        secret: $secret
    );

    Http::fake([
        'http://localhost:8001/internal/v1/locations' => Http::response([
            'data' => [
                'id' => 99,
                'user_id' => 101,
                'operational_asset_id' => 202,
                'dispatch_job_id' => 303,
                'latitude' => 14.5995,
                'longitude' => 120.9842,
                'accuracy_metres' => 5.0,
                'speed' => 10.0,
                'remarks' => 'En route',
                'source' => 'field-mobile',
                'sharing_enabled' => true,
                'captured_at' => '2026-09-09T10:00:00Z',
                'received_at' => '2026-09-09T10:00:01Z',
                'freshness_status' => 'fresh',
            ],
        ], 201),
    ]);

    $sample = LocationSampleDto::fromArray([
        'user_id' => 101,
        'operational_asset_id' => 202,
        'dispatch_job_id' => 303,
        'latitude' => 14.5995,
        'longitude' => 120.9842,
        'accuracy_metres' => 5.0,
        'speed' => 10.0,
        'remarks' => 'En route',
        'source' => 'field-mobile',
        'sharing_enabled' => true,
    ]);

    $result = $client->ingestLocation($sample);

    expect($result)->toBeInstanceOf(LatestLocationDto::class)
        ->and($result->id)->toBe(99)
        ->and($result->userId)->toBe(101)
        ->and($result->operationalAssetId)->toBe(202)
        ->and($result->dispatchJobId)->toBe(303)
        ->and($result->latitude)->toBe(14.5995)
        ->and($result->freshnessStatus)->toBe('fresh');

    Http::assertSent(function (Request $request) use ($secret) {
        $headers = $request->headers();

        expect($headers['X-Service-Name'][0])->toBe('operations')
            ->and($headers['X-Payload-Digest'][0])->toBe(hash('sha256', $request->body()))
            ->and($headers)->toHaveKey('X-Signature');

        $timestamp = $headers['X-Timestamp'][0];
        $digest = $headers['X-Payload-Digest'][0];
        $expectedSig = hash_hmac('sha256', "POST\n/internal/v1/locations\n{$timestamp}\n{$digest}", $secret);

        return hash_equals($expectedSig, $headers['X-Signature'][0]);
    });
});

it('queries latest locations and historical telemetry with signed GET requests', function (): void {
    $client = new HttpTrackingClient(baseUrl: 'http://localhost:8001');

    Http::fake([
        'http://localhost:8001/internal/v1/locations/latest*' => Http::response([
            'data' => [
                [
                    'id' => 1,
                    'user_id' => 101,
                    'operational_asset_id' => 201,
                    'dispatch_job_id' => 301,
                    'latitude' => 14.5995,
                    'longitude' => 120.9842,
                    'sharing_enabled' => true,
                    'freshness_status' => 'fresh',
                ],
            ],
        ], 200),
        'http://localhost:8001/internal/v1/locations*' => Http::response([
            'data' => [
                [
                    'id' => 1,
                    'user_id' => 101,
                    'operational_asset_id' => 201,
                    'dispatch_job_id' => 301,
                    'latitude' => 14.5995,
                    'longitude' => 120.9842,
                    'captured_at' => '2026-09-09T10:00:00Z',
                ],
            ],
        ], 200),
    ]);

    $latest = $client->getLatestLocations();
    expect($latest)->toHaveCount(1)
        ->and($latest->first()->userId)->toBe(101);

    $forUser = $client->getLatestLocationForUser(101);
    expect($forUser)->not->toBeNull()
        ->and($forUser->userId)->toBe(101);

    $forAsset = $client->getLatestLocationForAsset(201);
    expect($forAsset)->not->toBeNull()
        ->and($forAsset->operationalAssetId)->toBe(201);

    $forJob = $client->getLatestLocationForJob(301);
    expect($forJob)->not->toBeNull()
        ->and($forJob->dispatchJobId)->toBe(301);

    $history = $client->queryLocationHistory(['user_id' => 101]);
    expect($history)->toHaveCount(1)
        ->and($history->first()->userId)->toBe(101);
});

it('throws TrackingConflictException when Tracking returns HTTP 409 Conflict', function (): void {
    $client = new HttpTrackingClient(baseUrl: 'http://localhost:8001');

    Http::fake([
        'http://localhost:8001/internal/v1/locations' => Http::response([
            'message' => 'This command ID was already used for a different command payload.',
            'error' => 'conflict',
        ], 409),
    ]);

    $sample = LocationSampleDto::fromArray([
        'command_id' => '00000000-0000-0000-0000-000000000099',
        'user_id' => 101,
        'latitude' => 14.5995,
        'longitude' => 120.9842,
    ]);

    expect(fn () => $client->ingestLocation($sample))
        ->toThrow(TrackingConflictException::class, 'This command ID was already used for a different command payload.');
});

it('falls back gracefully to local database client without crashing when Tracking microservice is down', function (): void {
    $client = new HttpTrackingClient(baseUrl: 'http://localhost:8001');

    $user = User::factory()->create(['name' => 'Fallback User']);

    // Fake connection timeout / 503 error from Tracking microservice
    Http::fake([
        'http://localhost:8001/*' => Http::response(['message' => 'Service Unavailable'], 503),
    ]);

    $sample = LocationSampleDto::fromArray([
        'user_id' => $user->id,
        'latitude' => 14.6100,
        'longitude' => 120.9900,
        'sharing_enabled' => true,
    ]);

    // Should not throw, but fall back to local DatabaseTrackingClient
    $result = $client->ingestLocation($sample);

    expect($result)->toBeInstanceOf(LatestLocationDto::class)
        ->and($result->userId)->toBe($user->id)
        ->and(LocationUpdate::query()->where('user_id', $user->id)->count())->toBe(1);
});

it('executes full end-to-end telemetry flow: Mobile -> Operations BFF -> HTTP signed request -> Tracking 201 -> Reverb broadcast dispatched', function (): void {
    Event::fake([WorkspaceUpdated::class]);

    $operator = User::factory()->create(['is_active' => true]);
    $operator->syncRoles([RoleName::CraneOperator->value]);
    $token = $operator->createToken('Mobile Token')->plainTextToken;

    $job = DispatchJob::query()->create([
        'reference' => 'DISP-E2E-001',
        'client' => 'E2E Client',
        'title' => 'E2E Dispatch Job',
        'site' => 'Site E2E',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::EnRoute,
        'version' => 1,
        'created_by' => $operator->id,
    ]);

    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $operator->id,
        'assignment_type' => 'driver',
        'assigned_by' => $operator->id,
        'created_at' => now(),
    ]);

    $commandId = (string) Str::uuid();

    Http::fake([
        'http://localhost:8001/internal/v1/locations' => Http::response([
            'data' => [
                'id' => 77,
                'user_id' => $operator->id,
                'dispatch_job_id' => $job->id,
                'operational_asset_id' => null,
                'latitude' => 14.5995,
                'longitude' => 120.9842,
                'accuracy_metres' => 5.0,
                'speed' => 12.0,
                'remarks' => 'En route to site',
                'source' => 'field-mobile',
                'sharing_enabled' => true,
                'captured_at' => now()->toIso8601String(),
                'received_at' => now()->toIso8601String(),
                'freshness_status' => 'fresh',
            ],
        ], 201),
    ]);

    // Bind HttpTrackingClient as TrackingClientInterface
    app()->singleton(TrackingClientInterface::class, fn () => new HttpTrackingClient(baseUrl: 'http://localhost:8001'));

    $response = $this->withToken($token)
        ->withHeader('Idempotency-Key', $commandId)
        ->postJson('/api/v1/locations', [
            'dispatch_job_id' => $job->id,
            'latitude' => 14.5995,
            'longitude' => 120.9842,
            'accuracy_metres' => 5.0,
            'speed' => 12.0,
            'remarks' => 'En route to site',
            'sharing_enabled' => true,
            'captured_at' => now()->toIso8601String(),
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('data.id', 77)
        ->assertJsonPath('data.user_id', $operator->id)
        ->assertJsonPath('data.dispatch_job_id', $job->id);

    // Assert that Operations database did NOT persist a location_updates row (workload isolated to microservice)
    expect(LocationUpdate::count())->toBe(0);

    // Verify HTTP signed request sent to Tracking microservice
    Http::assertSent(function (Request $request) use ($operator, $job, $commandId) {
        $headers = $request->headers();

        expect($request->url())->toBe('http://localhost:8001/internal/v1/locations')
            ->and($headers['X-Service-Name'][0])->toBe('operations')
            ->and($headers)->toHaveKey('X-Signature')
            ->and($headers)->toHaveKey('X-Timestamp')
            ->and($headers)->toHaveKey('X-Payload-Digest')
            ->and($headers['X-Command-Id'][0])->toBe($commandId);

        $data = $request->data();
        expect($data['user_id'])->toBe($operator->id)
            ->and($data['dispatch_job_id'])->toBe($job->id)
            ->and($data['command_id'])->toBe($commandId);

        return true;
    });

    // Verify Reverb broadcast event was dispatched
    Event::assertDispatched(WorkspaceUpdated::class, function (WorkspaceUpdated $event) {
        return $event->resourceType === 'tracking' && $event->action === 'updated';
    });
});

it('avoids primary key collisions with pre-existing local location_updates when Tracking returns an overlapping ID', function (): void {
    Event::fake([WorkspaceUpdated::class]);

    $operator = User::factory()->create(['is_active' => true]);
    $operator->syncRoles([RoleName::CraneOperator->value]);
    $token = $operator->createToken('Mobile Token')->plainTextToken;

    $otherUser = User::factory()->create(['is_active' => true]);

    // Pre-create an unrelated LocationUpdate with ID 77 in Operations DB
    $existingStaleRecord = LocationUpdate::query()->create([
        'id' => 77,
        'user_id' => $otherUser->id,
        'latitude' => 1.2345,
        'longitude' => 6.7890,
        'sharing_enabled' => true,
        'captured_at' => now()->subMonth(),
        'received_at' => now()->subMonth(),
    ]);

    $job = DispatchJob::query()->create([
        'reference' => 'DISP-E2E-COLLISION',
        'client' => 'Collision Client',
        'title' => 'Collision Job',
        'site' => 'Site Collision',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::EnRoute,
        'version' => 1,
        'created_by' => $operator->id,
    ]);

    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $operator->id,
        'assignment_type' => 'driver',
        'assigned_by' => $operator->id,
        'created_at' => now(),
    ]);

    Http::fake([
        'http://localhost:8001/internal/v1/locations' => Http::response([
            'data' => [
                'id' => 77,
                'user_id' => $operator->id,
                'dispatch_job_id' => $job->id,
                'operational_asset_id' => null,
                'latitude' => 14.5995,
                'longitude' => 120.9842,
                'accuracy_metres' => 5.0,
                'speed' => 12.0,
                'remarks' => 'Fresh telemetry with overlapping ID',
                'source' => 'field-mobile',
                'sharing_enabled' => true,
                'captured_at' => now()->toIso8601String(),
                'received_at' => now()->toIso8601String(),
                'freshness_status' => 'fresh',
            ],
        ], 201),
    ]);

    app()->singleton(TrackingClientInterface::class, fn () => new HttpTrackingClient(baseUrl: 'http://localhost:8001'));

    $response = $this->withToken($token)
        ->withHeader('Idempotency-Key', (string) Str::uuid())
        ->postJson('/api/v1/locations', [
            'dispatch_job_id' => $job->id,
            'latitude' => 14.5995,
            'longitude' => 120.9842,
            'sharing_enabled' => true,
            'captured_at' => now()->toIso8601String(),
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('data.id', 77)
        ->assertJsonPath('data.user_id', $operator->id)
        ->assertJsonPath('data.latitude', 14.5995);

    // Verify the pre-existing record for the other user was not mutated or overwritten
    $freshStaleRecord = $existingStaleRecord->fresh();
    expect($freshStaleRecord->user_id)->toBe($otherUser->id)
        ->and($freshStaleRecord->latitude)->toBe(1.2345);
});

it('propagates HTTP 409 Conflict safely back to client when Tracking detects mismatched payload replay', function (): void {
    Event::fake([WorkspaceUpdated::class]);

    $operator = User::factory()->create(['is_active' => true]);
    $operator->syncRoles([RoleName::CraneOperator->value]);
    $token = $operator->createToken('Mobile Token')->plainTextToken;

    $job = DispatchJob::query()->create([
        'reference' => 'DISP-E2E-002',
        'client' => 'Conflict Client',
        'title' => 'Conflict Job',
        'site' => 'Site C',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::EnRoute,
        'version' => 1,
        'created_by' => $operator->id,
    ]);

    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $operator->id,
        'assignment_type' => 'driver',
        'assigned_by' => $operator->id,
        'created_at' => now(),
    ]);

    $commandId = (string) Str::uuid();

    Http::fake([
        'http://localhost:8001/internal/v1/locations' => Http::response([
            'message' => 'This command ID was already used for a different command payload.',
            'error' => 'conflict',
        ], 409),
    ]);

    app()->singleton(TrackingClientInterface::class, fn () => new HttpTrackingClient(baseUrl: 'http://localhost:8001'));

    $response = $this->withToken($token)
        ->withHeader('Idempotency-Key', $commandId)
        ->postJson('/api/v1/locations', [
            'dispatch_job_id' => $job->id,
            'latitude' => 14.5995,
            'longitude' => 120.9842,
            'sharing_enabled' => true,
            'captured_at' => now()->toIso8601String(),
        ]);

    $response->assertStatus(409)
        ->assertJsonPath('error', 'conflict')
        ->assertJsonPath('message', 'This command ID was already used for a different command payload.');

    // Verify NO Reverb tracking broadcast was dispatched on conflict
    Event::assertNotDispatched(WorkspaceUpdated::class, function (WorkspaceUpdated $event) {
        return $event->resourceType === 'tracking';
    });
});

it('switches to HttpTrackingClient when TRACKING_SERVICE_DRIVER is set to http', function (): void {
    config([
        'services.tracking.driver' => 'http',
        'services.tracking.url' => 'http://localhost:8001',
    ]);

    // Re-resolve
    $client = app(TrackingClientInterface::class);

    expect($client)->toBeInstanceOf(HttpTrackingClient::class);
});
