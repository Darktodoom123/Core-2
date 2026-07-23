<?php

use App\Enums\DispatchPriority;
use App\Enums\DispatchStatus;
use App\Enums\RoleName;
use App\Models\DispatchJob;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('serves canonical live dispatch view models and capability navigation', function () {
    $dispatcher = User::factory()->create();
    $dispatcher->syncRoles([RoleName::Dispatcher->value]);

    DispatchJob::query()->create([
        'reference' => 'CON-1001',
        'client' => 'Arcwell',
        'title' => 'HVAC lift',
        'site' => 'Quezon City',
        'scheduled_start' => now()->addDay(),
        'scheduled_end' => now()->addDay()->addHours(4),
        'priority' => DispatchPriority::Priority,
        'status' => DispatchStatus::PendingApproval,
        'created_by' => $dispatcher->id,
    ]);

    $this->actingAs($dispatcher)->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('workspace')
            ->has('jobs', 1)
            ->where('jobs.0.reference', 'CON-1001')
            ->where('jobs.0.priority', [
                'value' => 'priority',
                'label' => 'Priority',
            ])
            ->where('jobs.0.status', [
                'value' => 'pending_approval',
                'label' => 'Pending approval',
            ])
            ->where('navigation.0.id', 'dispatch')
            ->where('navigation.0.label', 'Dispatch workspace')
            ->where('navigation.1.id', 'assets')
            ->where('navigation.2.id', 'fuel')
            ->missing('navigation.3')
            ->has('assets')
            ->has('fuelRequests')
            ->has('workspace.refreshed_at')
            ->where('workspace.stale_after_seconds', 120)
        );
});

it('adapts live navigation labels for assigned field work without exposing unavailable modules', function () {
    $driver = User::factory()->create();
    $driver->syncRoles([RoleName::Driver->value]);

    $this->actingAs($driver)->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('navigation.0.id', 'dispatch')
            ->where('navigation.0.label', "Today's work")
            ->where('navigation.1.id', 'assets')
            ->where('navigation.1.label', 'Assigned vehicle')
            ->where('navigation.2.id', 'fuel')
            ->where('navigation.2.label', 'Fuel requests')
            ->missing('navigation.3')
            ->has('jobs', 0)
        );
});
