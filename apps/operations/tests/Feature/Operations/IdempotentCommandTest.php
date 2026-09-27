<?php

use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Idempotency\Models\CommandLog;
use App\Platform\Idempotency\Services\IdempotentCommandService;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Tracking\Models\LocationUpdate;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

function assignLocationJob(User $driver): DispatchJob
{
    $job = DispatchJob::query()->create([
        'reference' => 'LOC-'.Str::upper(Str::random(8)),
        'client' => 'Location Client',
        'title' => 'Location Test Job',
        'site' => 'Test Site',
        'status' => DispatchStatus::Working,
        'priority' => DispatchPriority::Routine,
        'scheduled_start' => now()->subHour(),
        'scheduled_end' => now()->addHours(2),
        'created_by' => $driver->id,
    ]);

    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $driver->id,
        'assignment_type' => 'driver',
        'assigned_by' => $driver->id,
        'active_from' => now()->subHour(),
    ]);

    return $job;
}

it('replays cached responses for duplicate command submissions with identical command_id', function () {
    $driver = User::factory()->create();
    $driver->syncRoles([RoleName::CraneOperator->value]);
    $job = assignLocationJob($driver);

    $commandId = (string) Str::uuid();

    $capturedAt = now()->toIso8601String();

    // First command submission
    $response1 = $this->actingAs($driver)
        ->withHeader('Idempotency-Key', $commandId)
        ->post('/operations/locations', [
            'latitude' => 14.5995,
            'longitude' => 120.9842,
            'accuracy_metres' => 5,
            'sharing_enabled' => true,
            'dispatch_job_id' => $job->id,
            'captured_at' => $capturedAt,
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
            'dispatch_job_id' => $job->id,
            'captured_at' => $capturedAt,
        ]);

    // Replayed response returns cached result without creating a duplicate LocationUpdate row
    $response2->assertSessionHas('flash', [
        'tone' => 'success',
        'message' => 'Your current location was shared.',
    ]);
    expect(LocationUpdate::query()->where('user_id', $driver->id)->count())->toBe(1);
    expect(CommandLog::query()->where('command_id', $commandId)->count())->toBe(1);
});

it('logs command details in command_logs table', function () {
    $driver = User::factory()->create();
    $driver->syncRoles([RoleName::CraneOperator->value]);
    $job = assignLocationJob($driver);

    $commandId = (string) Str::uuid();

    $this->actingAs($driver)->post('/operations/locations', [
        'command_id' => $commandId,
        'latitude' => 14.5995,
        'longitude' => 120.9842,
        'sharing_enabled' => true,
        'dispatch_job_id' => $job->id,
        'captured_at' => now()->toIso8601String(),
    ]);

    $log = CommandLog::query()->where('command_id', $commandId)->sole();
    expect($log->user_id)->toBe($driver->id)
        ->and($log->action_name)->toBe('location.store')
        ->and($log->status)->toBe('completed');
});

it('rejects a non-UUID idempotency header before writing the location or command log', function (): void {
    $driver = User::factory()->create();
    $driver->syncRoles([RoleName::CraneOperator->value]);
    $job = assignLocationJob($driver);

    $response = $this->actingAs($driver)
        ->withHeader('Idempotency-Key', 'not-a-uuid')
        ->postJson('/operations/locations', [
            'latitude' => 14.5995,
            'longitude' => 120.9842,
            'accuracy_metres' => 5,
            'sharing_enabled' => true,
            'dispatch_job_id' => $job->id,
            'captured_at' => now()->toIso8601String(),
        ]);

    $response->assertStatus(422)->assertJsonValidationErrors(['command_id']);
    expect(LocationUpdate::query()->where('user_id', $driver->id)->count())->toBe(0)
        ->and(CommandLog::query()->where('user_id', $driver->id)->count())->toBe(0);
});

it('fails closed for legacy idempotency records without a payload hash', function (): void {
    $driver = User::factory()->create();
    $driver->syncRoles([RoleName::CraneOperator->value]);
    $job = assignLocationJob($driver);
    $commandId = (string) Str::uuid();

    CommandLog::query()->create([
        'user_id' => $driver->id,
        'command_id' => $commandId,
        'action_name' => 'location.store',
        'payload_hash' => null,
        'expected_version' => null,
        'status' => 'completed',
        'response_code' => 302,
        'response_payload' => ['type' => 'redirect', 'url' => '/'],
    ]);

    $response = $this->actingAs($driver)
        ->withHeader('Idempotency-Key', $commandId)
        ->postJson('/operations/locations', [
            'latitude' => 14.5995,
            'longitude' => 120.9842,
            'accuracy_metres' => 5,
            'sharing_enabled' => true,
            'dispatch_job_id' => $job->id,
            'captured_at' => now()->toIso8601String(),
        ]);

    $response->assertStatus(422)->assertJsonValidationErrors(['command_id']);
    expect(LocationUpdate::query()->where('user_id', $driver->id)->count())->toBe(0);
});

it('does not keep a 5xx answer, and rolls back what the attempt wrote', function (): void {
    $user = User::factory()->create(['is_active' => true]);
    $commandId = (string) Str::uuid();
    $service = app(IdempotentCommandService::class);
    $attempts = 0;
    $execute = function () use (&$attempts, $user): JsonResponse {
        $attempts++;
        LocationUpdate::query()->create([
            'user_id' => $user->id,
            'latitude' => 14.5995,
            'longitude' => 120.9842,
            'sharing_enabled' => true,
            'source' => 'field-mobile',
            'captured_at' => now(),
            'received_at' => now(),
        ]);

        return $attempts === 1
            ? new JsonResponse(['message' => 'Try again.'], 503)
            : new JsonResponse(['data' => ['ok' => true]], 201);
    };

    $first = $service->process($user, $commandId, 'location.store', null, $execute, ['lat' => 1]);

    expect($first->getStatusCode())->toBe(503)
        ->and(CommandLog::query()->where('command_id', $commandId)->exists())->toBeFalse()
        ->and(LocationUpdate::query()->where('user_id', $user->id)->count())->toBe(0);

    $retry = $service->process($user, $commandId, 'location.store', null, $execute, ['lat' => 1]);

    expect($retry->getStatusCode())->toBe(201)
        ->and($attempts)->toBe(2)
        ->and(CommandLog::query()->where('command_id', $commandId)->value('response_code'))->toBe(201)
        ->and(LocationUpdate::query()->where('user_id', $user->id)->count())->toBe(1);
});

it('forgets location retry refusals stored before 5xx answers stopped being kept', function (): void {
    $user = User::factory()->create(['is_active' => true]);
    $stored = fn (string $action, int $code): CommandLog => CommandLog::query()->create([
        'user_id' => $user->id,
        'command_id' => (string) Str::uuid(),
        'action_name' => $action,
        'payload_hash' => hash('sha256', '{}'),
        'status' => $code >= 400 ? 'failed' : 'completed',
        'response_code' => $code,
        'response_payload' => [],
    ]);
    $refused = $stored('location.store', 503);
    $accepted = $stored('location.store', 201);
    $otherAction = $stored('dispatch.transition', 503);

    (require database_path('migrations/2026_09_28_100000_forget_stored_location_retry_refusals.php'))->up();

    expect(CommandLog::query()->whereKey($refused->id)->exists())->toBeFalse()
        ->and(CommandLog::query()->whereKey($accepted->id)->exists())->toBeTrue()
        ->and(CommandLog::query()->whereKey($otherAction->id)->exists())->toBeTrue();
});
