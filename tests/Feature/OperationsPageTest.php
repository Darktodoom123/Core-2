<?php

use App\Modules\Dispatch\Actions\CreateManualDispatchHandoff;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\Client;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Models\ServiceRequest;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Tracking\Models\LocationUpdate;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('serves canonical live dispatch view models and capability navigation', function () {
    $dispatcher = User::factory()->create();
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

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
            ->where('navigation.0.id', 'overview')
            ->where('navigation.0.label', 'Operations overview')
            ->where('navigation.1.id', 'dispatch')
            ->where('navigation.1.label', 'Dispatch workspace')
            ->where('navigation.2.id', 'assets')
            ->where('navigation.2.label', 'Fleet Management')
            ->where('navigation.3.id', 'fuel')
            ->where('navigation.3.label', 'Fuel requests')
            ->where('navigation.4.id', 'approvals')
            ->where('navigation.4.label', 'Approvals')
            ->where('navigation.5.id', 'reports')
            ->where('navigation.5.label', 'Job reports')
            ->where('navigation.6.id', 'notifications')
            ->where('navigation.6.label', 'Notifications')
            ->where('navigation.7.id', 'sos')
            ->where('navigation.7.label', 'Emergency SOS')
            ->missing('navigation.8')
            ->where('capabilities.create_dispatch', true)
            ->where('capabilities.create_client', true)
            ->where('capabilities.create_service_request', true)
            ->where('capabilities.convert_service_request', true)
            ->missing('capabilities.register_asset')
            ->has('workspace.refreshed_at')
            ->where('workspace.stale_after_seconds', 120)
            ->loadDeferredProps('workspace-overview', fn (Assert $section) => $section
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
                ->has('assets')
                ->has('fuelRequests'))
        );
});

it('adapts live navigation labels for assigned field work without exposing unavailable modules', function () {
    $driver = User::factory()->create();
    $driver->syncRoles([RoleName::CraneOperator->value]);

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
            ->where('navigation.4.id', 'reports')
            ->where('navigation.4.label', 'Job reports')
            ->where('navigation.5.id', 'notifications')
            ->where('navigation.5.label', 'Notifications')
            ->missing('navigation.6')
            ->where('capabilities.create_dispatch', false)
            ->where('capabilities.create_client', false)
            ->where('capabilities.create_service_request', false)
            ->where('capabilities.convert_service_request', false)
            ->loadDeferredProps('workspace-overview', fn (Assert $section) => $section
                ->has('jobs', 0)
                ->has('clients', 0)
                ->has('serviceRequests', 0))
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
            ->loadDeferredProps('workspace-overview', fn (Assert $section) => $section
                ->has('jobs')
                ->has('assets')
                ->has('approvals')
                ->has('fuelRequests'))
        );

    $admin = User::factory()->create();
    $admin->syncRoles([RoleName::SystemAdministrator->value]);

    $this->actingAs($admin)->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('auth.role', 'system_administrator')
            ->where('navigation.0.id', 'overview')
            ->where('navigation', fn ($nav): bool => collect($nav)->contains('id', 'gpt-recommendations'))
            ->loadDeferredProps('workspace-overview', fn (Assert $section) => $section
                ->has('users')
                ->has('auditEvents'))
        );
});

it('serves only the latest visible location per worker in the workspace feed', function () {
    $dispatcher = User::factory()->create();
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);
    $driver = User::factory()->create();
    $driver->syncRoles([RoleName::CraneOperator->value]);
    $secondDriver = User::factory()->create();
    $secondDriver->syncRoles([RoleName::CraneOperator->value]);

    LocationUpdate::query()->create([
        'user_id' => $driver->id,
        'latitude' => 14.5995,
        'longitude' => 120.9842,
        'sharing_enabled' => true,
        'captured_at' => now()->subMinutes(10),
        'received_at' => now()->subMinutes(10),
    ]);
    $latestDriverLocation = LocationUpdate::query()->create([
        'user_id' => $driver->id,
        'latitude' => 14.6010,
        'longitude' => 120.9850,
        'sharing_enabled' => true,
        'captured_at' => now()->subMinute(),
        'received_at' => now()->subMinute(),
    ]);
    $secondDriverLocation = LocationUpdate::query()->create([
        'user_id' => $secondDriver->id,
        'latitude' => 14.6020,
        'longitude' => 120.9860,
        'sharing_enabled' => true,
        'captured_at' => now()->subMinutes(2),
        'received_at' => now()->subMinutes(2),
    ]);

    $this->actingAs($dispatcher)->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->loadDeferredProps('workspace-overview', fn (Assert $section) => $section
                ->has('locations', 2)
                ->where('locations', function ($locations) use ($latestDriverLocation, $secondDriverLocation): bool {
                    return collect($locations)->pluck('id')->sort()->values()->all() === collect([
                        $latestDriverLocation->id,
                        $secondDriverLocation->id,
                    ])->sort()->values()->all();
                })));
});

it('derives the initial workspace section from the authorized navigation', function () {
    $dispatcher = User::factory()->create();
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    $this->actingAs($dispatcher)->get('/?view=dispatch')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('initial_section', 'dispatch')
            ->where('navigation.1.id', 'dispatch'));

    $fuelViewer = User::factory()->create();
    $fuelViewer->givePermissionTo(PermissionName::FuelViewAll->value);

    $this->actingAs($fuelViewer)->get('/?view=dispatch')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('initial_section', 'overview')
            ->where('navigation.0.id', 'overview')
            ->where('navigation', fn ($navigation): bool => ! collect($navigation)->contains('id', 'dispatch')));
});

it('projects canonical manual provenance independently from the reference prefix', function () {
    $dispatcher = User::factory()->create();
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    $job = app(CreateManualDispatchHandoff::class)->handle($dispatcher, [
        'client' => 'Canonical Manual Client',
        'title' => 'Manual service dispatch',
        'site' => 'Quezon City',
        'scheduled_start' => now()->addDay(),
        'scheduled_end' => now()->addDay()->addHours(4),
        'priority' => DispatchPriority::Routine,
        'requirements' => ['Require site induction & PPE compliance verification'],
        'work_stream' => 'service',
        'equipment_subtype' => 'mobile_crane',
    ]);

    expect($job->canonicalHandoff)->not->toBeNull();

    $this->actingAs($dispatcher)->get('/?view=dispatch')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->loadDeferredProps('workspace-dispatch', fn (Assert $section) => $section
                ->where('jobs.0.reference', $job->reference)
                ->where('jobs.0.source.type', 'manual')
                ->where('jobs.0.source.label', 'Manual source')
                ->where('jobs.0.source.reference', $job->reference)
                ->where('jobs.0.source.manual_intake', true)
                ->where('jobs.0.source.provenance_indicator', 'manual_intake')));
});

it('projects dispatch job counts from the rendered service request relationships', function () {
    $dispatcher = User::factory()->create();
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);
    $client = Client::query()->create([
        'code' => 'CLI-COUNT-1',
        'company_name' => 'Count Client',
        'status' => 'active',
    ]);

    $unlinkedRequest = ServiceRequest::query()->create([
        'reference' => 'SR-COUNT-1',
        'client_id' => $client->id,
        'created_by' => $dispatcher->id,
        'project_name' => 'Unlinked request',
        'service_type' => 'crane',
        'location' => 'Pasig City',
        'status' => 'submitted',
    ]);
    $linkedRequest = ServiceRequest::query()->create([
        'reference' => 'SR-COUNT-2',
        'client_id' => $client->id,
        'created_by' => $dispatcher->id,
        'project_name' => 'Linked request',
        'service_type' => 'crane',
        'location' => 'Makati City',
        'status' => 'submitted',
    ]);

    DispatchJob::query()->create([
        'service_request_id' => $linkedRequest->id,
        'reference' => 'DSP-SRV-COUNT-1',
        'client' => $client->company_name,
        'title' => 'Linked dispatch',
        'site' => $linkedRequest->location,
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Draft,
        'created_by' => $dispatcher->id,
    ]);

    $this->actingAs($dispatcher)->get('/?view=dispatch')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->loadDeferredProps('workspace-dispatch', fn (Assert $section) => $section
                ->has('serviceRequests', 2)
                ->where('serviceRequests', function ($requests) use ($unlinkedRequest, $linkedRequest): bool {
                    $counts = collect($requests)->mapWithKeys(
                        static fn (array $request): array => [$request['reference'] => $request['dispatch_jobs_count']],
                    );

                    return $counts->sortKeys()->all() === collect([
                        $unlinkedRequest->reference => 0,
                        $linkedRequest->reference => 1,
                    ])->sortKeys()->all();
                })));
});
