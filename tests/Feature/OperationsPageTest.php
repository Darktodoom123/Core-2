<?php

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\Client;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Models\ServiceRequest;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
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
    $client = Client::query()->create([
        'code' => 'CLI-1001',
        'company_name' => 'Arcwell',
        'address' => 'Quezon City',
        'status' => 'active',
    ]);
    ServiceRequest::query()->create([
        'reference' => 'SR-1001',
        'client_id' => $client->id,
        'created_by' => $dispatcher->id,
        'project_name' => 'Plant lift',
        'service_type' => 'crane',
        'location' => 'Pasig City',
        'site_notes' => 'Use the east gate.',
        'scheduled_date' => now()->addDays(2),
        'priority' => DispatchPriority::Routine,
        'status' => 'submitted',
        'requirements' => ['25t crane'],
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
            ->where('navigation.0.id', 'overview')
            ->where('navigation.0.label', 'Operations overview')
            ->where('navigation.1.id', 'dispatch')
            ->where('navigation.1.label', 'Dispatch workspace')
            ->where('navigation.2.id', 'assets')
            ->where('navigation.3.id', 'fuel')
            ->where('navigation.4.id', 'tracking')
            ->where('navigation.4.label', 'Live tracking')
            ->where('navigation.5.id', 'reports')
            ->where('navigation.5.label', 'Job reports')
            ->where('navigation.6.id', 'notifications')
            ->where('navigation.6.label', 'Notifications')
            ->where('navigation.7.id', 'gpt-recommendations')
            ->where('navigation.7.label', 'GPT AI Advisory')
            ->missing('navigation.8')
            ->has('clients', 1)
            ->where('clients.0.code', 'CLI-1001')
            ->has('serviceRequests', 1)
            ->where('serviceRequests.0.reference', 'SR-1001')
            ->where('serviceRequests.0.client.company_name', 'Arcwell')
            ->where('serviceRequests.0.status', [
                'value' => 'submitted',
                'label' => 'Submitted',
            ])
            ->where('serviceRequests.0.dispatch_jobs_count', 0)
            ->where('capabilities.create_client', true)
            ->where('capabilities.create_service_request', true)
            ->where('capabilities.convert_service_request', true)
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
            ->where('navigation.0.id', 'overview')
            ->where('navigation.0.label', 'Operations overview')
            ->where('navigation.1.id', 'dispatch')
            ->where('navigation.1.label', "Today's work")
            ->where('navigation.2.id', 'assets')
            ->where('navigation.2.label', 'Assigned vehicle')
            ->where('navigation.3.id', 'fuel')
            ->where('navigation.3.label', 'Fuel requests')
            ->where('navigation.4.id', 'tracking')
            ->where('navigation.4.label', 'Live tracking')
            ->where('navigation.5.id', 'reports')
            ->where('navigation.5.label', 'Job reports')
            ->where('navigation.6.id', 'notifications')
            ->where('navigation.6.label', 'Notifications')
            ->missing('navigation.7')
            ->has('jobs', 0)
            ->has('clients', 0)
            ->has('serviceRequests', 0)
            ->where('capabilities.create_client', false)
            ->where('capabilities.create_service_request', false)
            ->where('capabilities.convert_service_request', false)
        );
});

it('serves operational overview workspace for Operations Manager and System Administrator roles', function () {
    $manager = User::factory()->create();
    $manager->syncRoles([RoleName::OperationsManager->value]);

    $this->actingAs($manager)->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('auth.role', 'operations_manager')
            ->where('navigation.0.id', 'overview')
            ->has('jobs')
            ->has('assets')
            ->has('approvals')
            ->has('fuelRequests')
        );

    $admin = User::factory()->create();
    $admin->syncRoles([RoleName::SystemAdministrator->value]);

    $this->actingAs($admin)->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('auth.role', 'system_administrator')
            ->where('navigation.0.id', 'overview')
            ->has('users')
            ->has('auditEvents')
        );
});
