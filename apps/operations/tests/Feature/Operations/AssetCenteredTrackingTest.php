<?php

use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Safety\Enums\SosIncidentCategory;
use App\Platform\Safety\Enums\SosIncidentStatus;
use App\Platform\Safety\Models\SosIncident;
use App\Platform\Tracking\Contracts\TrackingClientInterface;
use App\Platform\Tracking\Data\LocationSampleDto;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Carbon\CarbonImmutable;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('excludes unlinked location updates (null operational_asset_id) from workspace live tracking', function (): void {
    $dispatcher = User::factory()->create();
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    $driverWithAsset = User::factory()->create(['name' => 'Operator With Asset']);
    $driverWithAsset->syncRoles([RoleName::CraneOperator->value]);

    $unlinkedWorker = User::factory()->create(['name' => 'Personnel On Foot']);
    $unlinkedWorker->syncRoles([RoleName::CraneOperator->value]);

    $crane = OperationalAsset::query()->create([
        'code' => 'CRN-LIVE-1',
        'name' => 'Heavy Crane 1',
        'kind' => 'crane',
        'status' => AssetStatus::Available,
        'location' => 'North Yard',
    ]);

    $client = app(TrackingClientInterface::class);

    // Ingest location linked to an asset
    $client->ingestLocation(LocationSampleDto::fromArray([
        'user_id' => $driverWithAsset->id,
        'operational_asset_id' => $crane->id,
        'latitude' => 14.5995,
        'longitude' => 120.9842,
        'sharing_enabled' => true,
        'captured_at' => now(),
        'received_at' => now(),
    ]));

    // Ingest location for personnel without an asset
    $client->ingestLocation(LocationSampleDto::fromArray([
        'user_id' => $unlinkedWorker->id,
        'operational_asset_id' => null,
        'latitude' => 14.6000,
        'longitude' => 120.9850,
        'sharing_enabled' => true,
        'captured_at' => now(),
        'received_at' => now(),
    ]));

    $this->actingAs($dispatcher)->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->loadDeferredProps('workspace-overview', fn (Assert $section) => $section
                ->has('locations', 1)
                ->where('locations.0.asset.id', $crane->id)
                ->where('locations.0.asset.code', 'CRN-LIVE-1')
                ->where('locations.0.user.name', 'Operator With Asset')
            )
        );
});

it('excludes soft-deleted assets from workspace live tracking', function (): void {
    $dispatcher = User::factory()->create();
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    $driver = User::factory()->create(['name' => 'Retired Asset Driver']);
    $driver->syncRoles([RoleName::CraneOperator->value]);

    $activeAsset = OperationalAsset::query()->create([
        'code' => 'TRK-ACT-1',
        'name' => 'Active Transport Truck',
        'kind' => 'truck',
        'status' => AssetStatus::Available,
        'location' => 'South Yard',
    ]);

    $deletedAsset = OperationalAsset::query()->create([
        'code' => 'TRK-DEL-1',
        'name' => 'Decommissioned Truck',
        'kind' => 'truck',
        'status' => AssetStatus::Available,
        'location' => 'Scrap Yard',
    ]);

    $client = app(TrackingClientInterface::class);

    $client->ingestLocation(LocationSampleDto::fromArray([
        'user_id' => $driver->id,
        'operational_asset_id' => $activeAsset->id,
        'latitude' => 14.5995,
        'longitude' => 120.9842,
        'sharing_enabled' => true,
        'captured_at' => now(),
        'received_at' => now(),
    ]));

    $client->ingestLocation(LocationSampleDto::fromArray([
        'user_id' => $driver->id,
        'operational_asset_id' => $deletedAsset->id,
        'latitude' => 14.6000,
        'longitude' => 120.9850,
        'sharing_enabled' => true,
        'captured_at' => now(),
        'received_at' => now(),
    ]));

    // Soft-delete the second asset
    $deletedAsset->delete();

    $this->actingAs($dispatcher)->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->loadDeferredProps('workspace-overview', fn (Assert $section) => $section
                ->has('locations', 1)
                ->where('locations.0.asset.id', $activeAsset->id)
                ->where('locations.0.asset.code', 'TRK-ACT-1')
            )
        );
});

it('deduplicates multiple location updates for the same asset preserving the latest timestamp', function (): void {
    $dispatcher = User::factory()->create();
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    $operator1 = User::factory()->create(['name' => 'First Shift Operator']);
    $operator1->syncRoles([RoleName::CraneOperator->value]);

    $operator2 = User::factory()->create(['name' => 'Second Shift Operator']);
    $operator2->syncRoles([RoleName::CraneOperator->value]);

    $sharedCrane = OperationalAsset::query()->create([
        'code' => 'CRN-SHARED',
        'name' => 'Shared Tower Crane',
        'kind' => 'crane',
        'status' => AssetStatus::Available,
        'location' => 'Central Yard',
    ]);

    $client = app(TrackingClientInterface::class);

    // Operator 1 reports earlier position
    $client->ingestLocation(LocationSampleDto::fromArray([
        'user_id' => $operator1->id,
        'operational_asset_id' => $sharedCrane->id,
        'latitude' => 14.5000,
        'longitude' => 121.0000,
        'sharing_enabled' => true,
        'captured_at' => CarbonImmutable::now()->subHours(2),
        'received_at' => CarbonImmutable::now()->subHours(2),
    ]));

    // Operator 2 reports newer position
    $client->ingestLocation(LocationSampleDto::fromArray([
        'user_id' => $operator2->id,
        'operational_asset_id' => $sharedCrane->id,
        'latitude' => 14.6000,
        'longitude' => 121.1000,
        'sharing_enabled' => true,
        'captured_at' => CarbonImmutable::now()->subMinutes(5),
        'received_at' => CarbonImmutable::now()->subMinutes(5),
    ]));

    $this->actingAs($dispatcher)->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->loadDeferredProps('workspace-overview', fn (Assert $section) => $section
                ->has('locations', 1)
                ->where('locations.0.asset.id', $sharedCrane->id)
                ->where('locations.0.asset.code', 'CRN-SHARED')
                ->where('locations.0.user.name', 'Second Shift Operator')
                ->where('locations.0.latitude', 14.6)
                ->where('locations.0.longitude', 121.1)
            )
        );
});

it('retains asset with unassigned operator fallback when location update user record is missing', function (): void {
    $dispatcher = User::factory()->create();
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    $asset = OperationalAsset::query()->create([
        'code' => 'GEN-STANDALONE',
        'name' => 'Standalone Telemetry Generator',
        'kind' => 'equipment',
        'status' => AssetStatus::Available,
        'location' => 'Yard Generator Shed',
    ]);

    $client = app(TrackingClientInterface::class);

    // Ingest location with a non-existent user ID
    $client->ingestLocation(LocationSampleDto::fromArray([
        'user_id' => 999999, // non-existent user
        'operational_asset_id' => $asset->id,
        'latitude' => 14.5500,
        'longitude' => 121.0500,
        'sharing_enabled' => true,
        'captured_at' => now(),
        'received_at' => now(),
    ]));

    $this->actingAs($dispatcher)->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->loadDeferredProps('workspace-overview', fn (Assert $section) => $section
                ->has('locations', 1)
                ->where('locations.0.asset.id', $asset->id)
                ->where('locations.0.asset.code', 'GEN-STANDALONE')
                ->where('locations.0.user.name', 'Unassigned operator')
            )
        );
});

it('preserves SOS incidents even when the worker has no active asset assignment', function (): void {
    $dispatcher = User::factory()->create();
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    $unlinkedWorker = User::factory()->create(['name' => 'Distressed Solo Worker']);
    $unlinkedWorker->syncRoles([RoleName::CraneOperator->value]);

    $incident = SosIncident::factory()->create([
        'category' => SosIncidentCategory::SiteAccident,
        'status' => SosIncidentStatus::Active,
        'worker_note' => 'Solo worker accident emergency',
        'reporter_id' => $unlinkedWorker->id,
        'operational_asset_id' => null,
        'dispatch_job_id' => null,
        'latitude' => 14.5900,
        'longitude' => 120.9800,
        'received_at' => now(),
        'device_activated_at' => now(),
    ]);

    $this->actingAs($dispatcher)->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('activeSosIncidents', 1)
            ->where('activeSosIncidents.0.id', (string) $incident->id)
            ->where('activeSosIncidents.0.worker.name', 'Distressed Solo Worker')
            ->where('activeSosIncidents.0.category.value', 'site_accident')
            ->loadDeferredProps('workspace-overview', fn (Assert $section) => $section
                // No asset-linked locations exist, so locations array is empty
                ->has('locations', 0)
            )
        );
});

it('preserves newer asset position when out-of-order delayed telemetry arrives from earlier operator', function (): void {
    $dispatcher = User::factory()->create();
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    $formerOperator = User::factory()->create(['name' => 'Former Operator']);
    $formerOperator->syncRoles([RoleName::CraneOperator->value]);

    $currentOperator = User::factory()->create(['name' => 'Current Operator']);
    $currentOperator->syncRoles([RoleName::CraneOperator->value]);

    $asset = OperationalAsset::query()->create([
        'code' => 'EXC-101',
        'name' => 'Hydraulic Excavator',
        'kind' => 'equipment',
        'status' => AssetStatus::Available,
        'location' => 'West Trench',
    ]);

    $client = app(TrackingClientInterface::class);

    // Current operator reports fresh position at 10:00
    $client->ingestLocation(LocationSampleDto::fromArray([
        'user_id' => $currentOperator->id,
        'operational_asset_id' => $asset->id,
        'latitude' => 14.7000,
        'longitude' => 121.2000,
        'sharing_enabled' => true,
        'captured_at' => CarbonImmutable::parse('2026-09-16T10:00:00Z'),
        'received_at' => CarbonImmutable::parse('2026-09-16T10:00:05Z'),
    ]));

    // Former operator's offline outbox syncs later with an earlier capture time (09:30)
    $client->ingestLocation(LocationSampleDto::fromArray([
        'user_id' => $formerOperator->id,
        'operational_asset_id' => $asset->id,
        'latitude' => 14.5000,
        'longitude' => 121.0000,
        'sharing_enabled' => true,
        'captured_at' => CarbonImmutable::parse('2026-09-16T09:30:00Z'),
        'received_at' => CarbonImmutable::parse('2026-09-16T10:05:00Z'),
    ]));

    $this->actingAs($dispatcher)->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->loadDeferredProps('workspace-overview', fn (Assert $section) => $section
                ->has('locations', 1)
                ->where('locations.0.asset.id', $asset->id)
                ->where('locations.0.asset.code', 'EXC-101')
                // Newer position (14.7, 121.2) is preserved
                ->where('locations.0.latitude', 14.7)
                ->where('locations.0.longitude', 121.2)
                ->where('locations.0.user.name', 'Current Operator')
            )
        );
});

it('enforces role-based asset tracking visibility between view_all and share_own', function (): void {
    $dispatcher = User::factory()->create(['name' => 'HQ Dispatcher']);
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    $driver1 = User::factory()->create(['name' => 'Operator Alpha']);
    $driver1->syncRoles([RoleName::CraneOperator->value]);

    $driver2 = User::factory()->create(['name' => 'Operator Beta']);
    $driver2->syncRoles([RoleName::CraneOperator->value]);

    $asset1 = OperationalAsset::query()->create([
        'code' => 'CRN-A',
        'name' => 'Crane Alpha',
        'kind' => 'crane',
        'status' => AssetStatus::Available,
        'location' => 'Site A',
    ]);

    $asset2 = OperationalAsset::query()->create([
        'code' => 'CRN-B',
        'name' => 'Crane Beta',
        'kind' => 'crane',
        'status' => AssetStatus::Available,
        'location' => 'Site B',
    ]);

    $client = app(TrackingClientInterface::class);

    $client->ingestLocation(LocationSampleDto::fromArray([
        'user_id' => $driver1->id,
        'operational_asset_id' => $asset1->id,
        'latitude' => 14.5100,
        'longitude' => 121.0100,
        'sharing_enabled' => true,
        'captured_at' => now(),
        'received_at' => now(),
    ]));

    $client->ingestLocation(LocationSampleDto::fromArray([
        'user_id' => $driver2->id,
        'operational_asset_id' => $asset2->id,
        'latitude' => 14.5200,
        'longitude' => 121.0200,
        'sharing_enabled' => true,
        'captured_at' => now(),
        'received_at' => now(),
    ]));

    // Dispatcher with tracking.view_all sees all assets
    $this->actingAs($dispatcher)->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->loadDeferredProps('workspace-overview', fn (Assert $section) => $section
                ->has('locations', 2)
            )
        );

    // Operator Alpha with tracking.share_own only sees their assigned asset (CRN-A)
    $this->actingAs($driver1)->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->loadDeferredProps('workspace-overview', fn (Assert $section) => $section
                ->has('locations', 1)
                ->where('locations.0.asset.code', 'CRN-A')
                ->where('locations.0.user.name', 'Operator Alpha')
            )
        );
});
