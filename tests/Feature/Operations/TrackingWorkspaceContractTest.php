<?php

use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Tracking\Models\LocationUpdate;
use App\Platform\Workspace\Events\WorkspaceUpdated;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function (): void {
    $this->artisan('migrate:fresh');
    $this->seed(RolePermissionSeeder::class);
});

function trackingContractUser(RoleName $role): User
{
    $user = User::factory()->create([
        'is_active' => true,
        'email_verified_at' => now(),
    ]);
    $user->syncRoles([$role->value]);

    return $user;
}

function trackingContractJob(User $driver): DispatchJob
{
    $job = DispatchJob::query()->create([
        'reference' => 'TRK-'.Str::upper(Str::random(8)),
        'client' => 'Tracking Client',
        'title' => 'Tracking Contract Job',
        'site' => 'Tracking Site',
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

it('broadcasts one tracking workspace update for each successful location write', function (): void {
    $driver = trackingContractUser(RoleName::Driver);
    $job = trackingContractJob($driver);
    Event::fake([WorkspaceUpdated::class]);

    $this->actingAs($driver)
        ->post('/operations/locations', [
            'latitude' => 14.5995,
            'longitude' => 120.9842,
            'accuracy_metres' => 8,
            'captured_at' => now()->subMinute()->toIso8601String(),
            'sharing_enabled' => true,
            'dispatch_job_id' => $job->id,
        ])
        ->assertRedirect('/');

    $token = $driver->createToken('tracking-contract')->plainTextToken;
    $this->app['auth']->forgetGuards();

    $this->withToken($token)
        ->postJson('/api/v1/locations', [
            'command_id' => Str::uuid()->toString(),
            'latitude' => 14.6000,
            'longitude' => 120.9850,
            'accuracy_metres' => 9,
            'captured_at' => now()->toIso8601String(),
            'sharing_enabled' => true,
            'dispatch_job_id' => $job->id,
        ])
        ->assertCreated();

    Event::assertDispatchedTimes(WorkspaceUpdated::class, 2);
    Event::assertDispatched(WorkspaceUpdated::class, function (WorkspaceUpdated $event): bool {
        return $event->broadcastWith()['resource_type'] === 'tracking'
            && $event->broadcastWith()['action'] === 'updated'
            && is_string($event->broadcastWith()['timestamp']);
    });
});

it('exposes scope-aware tracking freshness and only the authenticated user sharing state', function (): void {
    $driver = trackingContractUser(RoleName::Driver);
    $dispatcher = trackingContractUser(RoleName::Dispatcher);

    $update = LocationUpdate::query()->create([
        'user_id' => $driver->id,
        'latitude' => null,
        'longitude' => null,
        'sharing_enabled' => false,
        'captured_at' => now()->subMinute(),
        'received_at' => now(),
    ]);

    $this->actingAs($dispatcher)
        ->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('workspace.tracking.refreshed_at')
            ->where('workspace.tracking.stale_after_seconds', 120)
            ->where('workspace.tracking.latest_received_at', $update->received_at->toIso8601String())
            ->where('workspace.tracking.current_user.sharing_enabled', null)
            ->where('workspace.tracking.current_user.captured_at', null)
            ->where('workspace.tracking.current_user.received_at', null)
        );

    $this->actingAs($driver)
        ->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('workspace.tracking.current_user.sharing_enabled', false)
            ->where('workspace.tracking.current_user.captured_at', $update->captured_at->toIso8601String())
            ->where('workspace.tracking.current_user.received_at', $update->received_at->toIso8601String())
        );
});
