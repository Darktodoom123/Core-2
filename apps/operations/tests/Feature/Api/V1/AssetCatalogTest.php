<?php

use App\Modules\Assignment\Models\DispatchAssetAssignment;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Fuel\Enums\FuelRequestStatus;
use App\Modules\Fuel\Models\FuelRequest;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('exposes fleet and equipment catalogs through their module APIs', function (): void {
    /** @var User $manager */
    $manager = User::factory()->create(['is_active' => true]);
    $manager->syncRoles([RoleName::OperationsManager->value]);
    $token = $manager->createToken('Mobile Token')->plainTextToken;

    $truck = OperationalAsset::query()->create([
        'code' => 'TRK-CATALOG-01',
        'name' => 'Catalog truck',
        'kind' => 'truck',
        'status' => 'available',
    ]);
    $crane = OperationalAsset::query()->create([
        'code' => 'CRN-CATALOG-01',
        'name' => 'Catalog crane',
        'kind' => 'crane',
        'status' => 'available',
    ]);

    $this->withToken($token)
        ->getJson('/api/v1/fleet/assets')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $truck->id)
        ->assertJsonMissing(['id' => $crane->id]);

    $this->withToken($token)
        ->getJson('/api/v1/equipment/assets')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $crane->id)
        ->assertJsonMissing(['id' => $truck->id]);

    $this->withToken($token)
        ->getJson("/api/v1/fleet/assets/{$crane->id}")
        ->assertNotFound();
});

it('limits assigned-only fleet access to the user’s current assets', function (): void {
    /** @var User $driver */
    $driver = User::factory()->create(['is_active' => true]);
    $driver->syncRoles([RoleName::CraneOperator->value]);
    $token = $driver->createToken('Mobile Token')->plainTextToken;

    $assignedTruck = OperationalAsset::query()->create([
        'code' => 'TRK-ASSIGNED-01',
        'name' => 'Assigned truck',
        'kind' => 'truck',
        'status' => 'assigned',
    ]);
    OperationalAsset::query()->create([
        'code' => 'TRK-OTHER-01',
        'name' => 'Other truck',
        'kind' => 'truck',
        'status' => 'available',
    ]);
    $job = DispatchJob::query()->create([
        'reference' => 'DISP-ASSET-CATALOG-01',
        'client' => 'Catalog Client',
        'title' => 'Catalog assignment',
        'site' => 'Yard',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Dispatched,
        'version' => 1,
        'created_by' => $driver->id,
    ]);
    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $driver->id,
        'assignment_type' => 'driver',
        'assigned_by' => $driver->id,
        'response_status' => 'accepted',
        'created_at' => now(),
    ]);
    DispatchAssetAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'operational_asset_id' => $assignedTruck->id,
        'assignment_type' => 'primary',
        'assigned_by' => $driver->id,
        'created_at' => now(),
    ]);

    $this->withToken($token)
        ->getJson('/api/v1/fleet/assets')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $assignedTruck->id);
});

it('exposes only the caller’s fuel requests through the fuel module API', function (): void {
    /** @var User $driver */
    $driver = User::factory()->create(['is_active' => true]);
    $driver->syncRoles([RoleName::CraneOperator->value]);
    $token = $driver->createToken('Mobile Token')->plainTextToken;

    /** @var User $otherDriver */
    $otherDriver = User::factory()->create(['is_active' => true]);
    $otherDriver->syncRoles([RoleName::CraneOperator->value]);

    $ownFuelRequest = FuelRequest::query()->create([
        'reference' => 'FUEL-MOBILE-OWN-01',
        'requester_id' => $driver->id,
        'quantity_litres' => 20,
        'fuel_type' => 'diesel',
        'purpose' => 'Delivery run',
        'status' => FuelRequestStatus::Submitted,
    ]);
    $otherFuelRequest = FuelRequest::query()->create([
        'reference' => 'FUEL-MOBILE-OTHER-01',
        'requester_id' => $otherDriver->id,
        'quantity_litres' => 30,
        'fuel_type' => 'diesel',
        'purpose' => 'Other delivery run',
        'status' => FuelRequestStatus::Submitted,
    ]);

    $this->withToken($token)
        ->getJson('/api/v1/fuel-requests')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $ownFuelRequest->id)
        ->assertJsonMissing(['id' => $otherFuelRequest->id]);

    $this->withToken($token)
        ->getJson("/api/v1/fuel-requests/{$otherFuelRequest->id}")
        ->assertNotFound();
});
