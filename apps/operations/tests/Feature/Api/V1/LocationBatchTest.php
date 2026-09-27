<?php

use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Idempotency\Models\CommandLog;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Tracking\Contracts\TrackingClientInterface;
use App\Platform\Tracking\Data\LatestLocationDto;
use App\Platform\Tracking\Data\LocationSampleDto;
use App\Platform\Tracking\Exceptions\TrackingServiceUnavailableException;
use App\Platform\Tracking\Models\LocationUpdate;
use App\Platform\Tracking\Testing\FakeTrackingClient;
use App\Platform\Workspace\Events\WorkspaceUpdated;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

function batchOperator(): User
{
    /** @var User $worker */
    $worker = User::factory()->create(['is_active' => true]);
    $worker->syncRoles([RoleName::CraneOperator->value]);

    return $worker;
}

function batchJob(User $worker): DispatchJob
{
    /** @var DispatchJob $job */
    $job = DispatchJob::query()->create([
        'reference' => 'DISP-BATCH-'.Str::upper(Str::random(5)),
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

    return $job;
}

/** @return array<string, mixed> */
function batchPing(DispatchJob $job, array $overrides = []): array
{
    return [
        'command_id' => (string) Str::uuid(),
        'dispatch_job_id' => $job->id,
        'latitude' => 14.5995,
        'longitude' => 120.9842,
        'sharing_enabled' => true,
        'captured_at' => now()->subMinutes(5)->toIso8601String(),
        ...$overrides,
    ];
}

function sendBatch(User $worker, array $pings): TestResponse
{
    return test()->withToken($worker->createToken('Mobile Token')->plainTextToken)
        ->postJson('/api/v1/locations/batch', ['pings' => $pings]);
}

it('stores every ping in one request and refreshes dispatch once', function (): void {
    $worker = batchOperator();
    $job = batchJob($worker);
    $pings = [batchPing($job), batchPing($job), batchPing($job)];
    Event::fake([WorkspaceUpdated::class]);

    sendBatch($worker, $pings)
        ->assertOk()
        ->assertJsonCount(3, 'data')
        ->assertJsonPath('data.0.command_id', $pings[0]['command_id'])
        ->assertJsonPath('data.0.status', 201)
        ->assertJsonPath('data.2.status', 201);

    expect(LocationUpdate::query()->where('user_id', $worker->id)->count())->toBe(3);
    expect(Event::dispatched(
        WorkspaceUpdated::class,
        fn (WorkspaceUpdated $event): bool => $event->resourceType === 'tracking',
    ))->toHaveCount(1);
});

it('refuses only the ping that fails its checks', function (): void {
    $worker = batchOperator();
    $job = batchJob($worker);
    $otherJob = batchJob(batchOperator());
    $good = batchPing($job);
    $notMine = batchPing($otherJob);

    sendBatch($worker, [$good, $notMine])
        ->assertOk()
        ->assertJsonPath('data.0.status', 201)
        ->assertJsonPath('data.1.status', 422)
        ->assertJsonPath('data.1.message', 'Location sharing requires an active assignment to the selected dispatch job.');

    expect(LocationUpdate::query()->where('user_id', $worker->id)->count())->toBe(1);
});

it('answers a resent batch from the record without storing pings twice', function (): void {
    $worker = batchOperator();
    $job = batchJob($worker);
    $pings = [batchPing($job), batchPing($job)];

    sendBatch($worker, $pings)->assertOk();
    sendBatch($worker, $pings)
        ->assertOk()
        ->assertJsonPath('data.0.status', 201)
        ->assertJsonPath('data.1.status', 201);

    expect(LocationUpdate::query()->where('user_id', $worker->id)->count())->toBe(2);
});

it('accepts a ping sent singly before and then again in a batch once', function (): void {
    $worker = batchOperator();
    $job = batchJob($worker);
    $ping = batchPing($job);
    $token = $worker->createToken('Mobile Token')->plainTextToken;

    $this->withToken($token)
        ->withHeader('X-Command-Id', $ping['command_id'])
        ->postJson('/api/v1/locations', collect($ping)->except('command_id')->all())
        ->assertStatus(201);

    sendBatch($worker, [$ping])->assertOk()->assertJsonPath('data.0.status', 201);

    expect(LocationUpdate::query()->where('user_id', $worker->id)->count())->toBe(1);
});

it('keeps pings refused during a tracking outage retryable', function (): void {
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
    $worker = batchOperator();
    $job = batchJob($worker);
    $pings = [batchPing($job), batchPing($job)];

    sendBatch($worker, $pings)->assertOk()->assertJsonPath('data.0.status', 503);
    expect(CommandLog::query()->where('user_id', $worker->id)->count())->toBe(0);

    $tracking->down = false;

    sendBatch($worker, $pings)->assertOk()->assertJsonPath('data.1.status', 201);
    expect(LocationUpdate::query()->where('user_id', $worker->id)->count())->toBe(2);
});

it('refuses a batch that is too large, repeats a command id, or has none', function (array $pings): void {
    $worker = batchOperator();

    sendBatch($worker, $pings)->assertStatus(422);
})->with([
    'too many' => fn () => array_map(fn () => ['command_id' => (string) Str::uuid()], range(1, 51)),
    'repeated command id' => fn () => [['command_id' => $id = (string) Str::uuid()], ['command_id' => $id]],
    'missing command id' => fn () => [['latitude' => 1]],
    'empty' => fn () => [],
]);

it('refuses a batch from a user who may not share location', function (): void {
    /** @var User $user */
    $user = User::factory()->create(['is_active' => true]);

    $this->withToken($user->createToken('Mobile Token')->plainTextToken)
        ->postJson('/api/v1/locations/batch', ['pings' => [['command_id' => (string) Str::uuid()]]])
        ->assertForbidden();
});
