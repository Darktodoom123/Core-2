<?php

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Tracking\Models\LocationUpdate;
use App\Platform\Workspace\ViewModels\OperationsWorkspaceViewModel;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

function createFieldUser(RoleName $role): User
{
    $user = User::factory()->create();
    $user->syncRoles([$role->value]);

    return $user;
}

it('enforces role-scoped location access control and cross-worker isolation', function () {
    $driver1 = createFieldUser(RoleName::CraneOperator);
    $driver2 = createFieldUser(RoleName::CraneOperator);
    $dispatcher = createFieldUser(RoleName::OperationsManager);

    // Driver 1 creates location update
    LocationUpdate::query()->create([
        'user_id' => $driver1->id,
        'latitude' => 14.5995,
        'longitude' => 120.9842,
        'accuracy_metres' => 5,
        'sharing_enabled' => true,
        'captured_at' => now(),
        'received_at' => now(),
    ]);

    // Driver 2 creates location update
    LocationUpdate::query()->create([
        'user_id' => $driver2->id,
        'latitude' => 14.6010,
        'longitude' => 120.9850,
        'accuracy_metres' => 10,
        'sharing_enabled' => true,
        'captured_at' => now(),
        'received_at' => now(),
    ]);

    // Office role with tracking.view_all sees both updates
    $this->actingAs($dispatcher)->getJson('/operations/locations')
        ->assertOk()
        ->assertJsonCount(2, 'data.data');

    // Field worker without tracking.view_all is denied access to operations-wide feed
    $this->actingAs($driver1)->getJson('/operations/locations')
        ->assertForbidden();

    // Query scoping visibleTo ensures driver1 only gets own updates
    $driver1Locations = LocationUpdate::query()->visibleTo($driver1)->get();
    expect($driver1Locations)->toHaveCount(1)
        ->and($driver1Locations->first()->user_id)->toBe($driver1->id);

    // Driver 2 cannot see Driver 1 updates via visibleTo query
    $driver2Locations = LocationUpdate::query()->visibleTo($driver2)->get();
    expect($driver2Locations)->toHaveCount(1)
        ->and($driver2Locations->first()->user_id)->toBe($driver2->id);
});

it('handles sharing-off and consent state updates', function () {
    $driver = createFieldUser(RoleName::CraneOperator);

    // Post location update with sharing disabled
    $this->actingAs($driver)->post('/operations/locations', [
        'latitude' => 14.5995,
        'longitude' => 120.9842,
        'accuracy_metres' => 5,
        'sharing_enabled' => false,
        'captured_at' => now()->toIso8601String(),
    ])->assertRedirect('/');

    $update = LocationUpdate::query()->where('user_id', $driver->id)->sole();
    expect($update->sharing_enabled)->toBeFalse()
        ->and($update->latitude)->toBeNull()
        ->and($update->longitude)->toBeNull()
        ->and($update->freshness_status)->toBe('offline');
    expect(AuditEvent::query()
        ->where('action', 'tracking.location_sharing_paused')
        ->where('actor_id', $driver->id)
        ->exists())->toBeTrue();
});

it('requires a currently active assignment window for precise location sharing', function () {
    $driver = createFieldUser(RoleName::CraneOperator);
    $job = DispatchJob::query()->create([
        'reference' => 'LOC-FUTURE-001',
        'client' => 'Location Client',
        'title' => 'Future Location Job',
        'site' => 'Site A',
        'status' => DispatchStatus::Working,
        'priority' => DispatchPriority::Routine,
        'created_by' => $driver->id,
    ]);

    $job->personnelAssignments()->create([
        'user_id' => $driver->id,
        'assignment_type' => 'driver',
        'assigned_by' => $driver->id,
        'active_from' => now()->addMinute(),
    ]);

    $this->actingAs($driver)
        ->post('/operations/locations', [
            'latitude' => 14.5995,
            'longitude' => 120.9842,
            'captured_at' => now()->toIso8601String(),
            'sharing_enabled' => true,
            'dispatch_job_id' => $job->id,
        ])
        ->assertSessionHasErrors('dispatch_job_id');

    expect(LocationUpdate::query()->where('user_id', $driver->id)->exists())->toBeFalse();
});

it('correctly calculates location freshness status categories', function () {
    $driver = createFieldUser(RoleName::CraneOperator);

    $fresh = LocationUpdate::query()->create([
        'user_id' => $driver->id,
        'latitude' => 14.5995,
        'longitude' => 120.9842,
        'sharing_enabled' => true,
        'captured_at' => now()->subMinute(),
        'received_at' => now()->subMinute(),
    ]);

    $delayed = LocationUpdate::query()->create([
        'user_id' => $driver->id,
        'latitude' => 14.5995,
        'longitude' => 120.9842,
        'sharing_enabled' => true,
        'captured_at' => now()->subMinutes(5),
        'received_at' => now()->subMinutes(5),
    ]);

    $stale = LocationUpdate::query()->create([
        'user_id' => $driver->id,
        'latitude' => 14.5995,
        'longitude' => 120.9842,
        'sharing_enabled' => true,
        'captured_at' => now()->subMinutes(15),
        'received_at' => now()->subMinutes(15),
    ]);

    $offline = LocationUpdate::query()->create([
        'user_id' => $driver->id,
        'latitude' => 14.5995,
        'longitude' => 120.9842,
        'sharing_enabled' => true,
        'captured_at' => now()->subMinutes(45),
        'received_at' => now()->subMinutes(45),
    ]);

    expect($fresh->freshness_status)->toBe('fresh')
        ->and($delayed->freshness_status)->toBe('delayed')
        ->and($stale->freshness_status)->toBe('stale')
        ->and($offline->freshness_status)->toBe('offline');
});

it('uses server receive time rather than device capture time for freshness', function () {
    $driver = createFieldUser(RoleName::CraneOperator);

    $delayedByServer = LocationUpdate::query()->create([
        'user_id' => $driver->id,
        'latitude' => 14.5995,
        'longitude' => 120.9842,
        'sharing_enabled' => true,
        'captured_at' => now(),
        'received_at' => now()->subMinutes(5),
    ]);

    $freshDespiteOldCapture = LocationUpdate::query()->create([
        'user_id' => $driver->id,
        'latitude' => 14.5995,
        'longitude' => 120.9842,
        'sharing_enabled' => true,
        'captured_at' => now()->subMinutes(45),
        'received_at' => now()->subMinute(),
    ]);

    expect($delayedByServer->freshness_status)->toBe('delayed')
        ->and($freshDespiteOldCapture->freshness_status)->toBe('fresh');
});

it('prevents system administrators from having location sharing permissions', function () {
    $admin = createFieldUser(RoleName::SystemAdministrator);
    $driver = createFieldUser(RoleName::CraneOperator);

    expect($admin->can(PermissionName::TrackingShareOwn->value))->toBeFalse()
        ->and($admin->can(PermissionName::TrackingViewAll->value))->toBeTrue()
        ->and($driver->can(PermissionName::TrackingShareOwn->value))->toBeTrue();

    expect(OperationsWorkspaceViewModel::capabilities($admin)['share_location'])->toBeFalse()
        ->and(OperationsWorkspaceViewModel::capabilities($driver)['share_location'])->toBeTrue();
});
