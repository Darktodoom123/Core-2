<?php

use App\Enums\DispatchPriority;
use App\Enums\DispatchStatus;
use App\Enums\PermissionName;
use App\Enums\RoleName;
use App\Models\DispatchJob;
use App\Models\DispatchPersonnelAssignment;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('allows field workers with tracking permission to share location', function (): void {
    /** @var User $worker */
    $worker = User::factory()->create(['is_active' => true]);
    $worker->syncRoles([RoleName::Driver->value]);
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
