<?php

use App\Modules\Assignment\Services\DispatchResourceEligibility;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\Inspection;
use App\Shared\Assets\Models\MaintenanceWorkOrder;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('allows authorized roles to register fleet vehicles and equipment with full specifications', function () {
    $dispatcher = User::factory()->create();
    $dispatcher->syncRoles([RoleName::Dispatcher->value]);

    // Fleet registration (truck)
    $response = $this->actingAs($dispatcher)->post('/operations/assets', [
        'code' => 'TRK-101',
        'name' => 'Heavy Hauler 1',
        'kind' => 'truck',
        'subtype' => 'Flatbed',
        'registration_number' => 'REG-8821',
        'manufacturer' => 'Volvo',
        'model' => 'FH16',
        'rated_capacity' => 25.5,
        'capacity_unit' => 'tonnes',
        'meter_type' => 'odometer',
        'meter_value' => 125000.5,
        'location' => 'Yard A',
        'specifications' => ['axles' => 3, 'engine' => 'D16K'],
    ]);

    $response->assertRedirect('/')->assertSessionHas('flash', function (array $flash) {
        return $flash['tone'] === 'success' && str_contains($flash['message'], 'TRK-101');
    });

    $this->assertDatabaseHas('operational_assets', [
        'code' => 'TRK-101',
        'name' => 'Heavy Hauler 1',
        'kind' => 'truck',
        'subtype' => 'Flatbed',
        'registration_number' => 'REG-8821',
        'manufacturer' => 'Volvo',
        'status' => AssetStatus::Available->value,
    ]);

    $this->assertDatabaseHas('audit_events', [
        'action' => 'asset.registered',
        'actor_id' => $dispatcher->id,
    ]);
});

it('rejects asset registration for unauthorized users or duplicate codes', function () {
    $driver = User::factory()->create();
    $driver->syncRoles([RoleName::Driver->value]);

    $this->actingAs($driver)->post('/operations/assets', [
        'code' => 'TRK-999',
        'name' => 'Unauthorized Truck',
        'kind' => 'truck',
    ])->assertForbidden();

    $dispatcher = User::factory()->create();
    $dispatcher->syncRoles([RoleName::Dispatcher->value]);
    OperationalAsset::query()->create(['code' => 'EX-1', 'name' => 'Existing', 'kind' => 'equipment', 'status' => AssetStatus::Available]);

    $this->actingAs($dispatcher)->post('/operations/assets', [
        'code' => 'EX-1',
        'name' => 'Duplicate Code',
        'kind' => 'equipment',
    ])->assertSessionHasErrors(['code']);
});

it('requires reasons and safety checks when updating asset status', function () {
    $manager = User::factory()->create();
    $manager->syncRoles([RoleName::OperationsManager->value]);

    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-50',
        'name' => 'Mobile Crane 50',
        'kind' => 'crane',
        'status' => AssetStatus::Available,
    ]);

    // Updating status without a reason fails validation
    $this->actingAs($manager)->post("/operations/assets/{$asset->id}/status", [
        'status' => AssetStatus::Unavailable->value,
        'reason' => '',
    ])->assertSessionHasErrors(['reason']);

    // Changing to ReadyForService fails if no passing inspection exists
    $this->actingAs($manager)->post("/operations/assets/{$asset->id}/status", [
        'status' => AssetStatus::ReadyForService->value,
        'reason' => 'Routine availability check',
    ])->assertSessionHasErrors(['status']);

    // Once a passing inspection is completed, status transition to ReadyForService succeeds
    $asset->inspections()->create([
        'technician_id' => $manager->id,
        'type' => 'safety',
        'result' => 'passed',
        'checklist' => ['boom' => true],
        'completed_at' => now(),
    ]);

    $this->actingAs($manager)->post("/operations/assets/{$asset->id}/status", [
        'status' => AssetStatus::ReadyForService->value,
        'reason' => 'Passed safety verification',
    ])->assertRedirect('/')->assertSessionHas('flash');

    expect($asset->refresh()->status)->toBe(AssetStatus::ReadyForService);
    $this->assertDatabaseHas('audit_events', [
        'action' => 'asset.status_updated',
        'reason' => 'Passed safety verification',
    ]);
});

it('records inspection submissions and updates status on non-passing outcomes', function () {
    $technician = User::factory()->create();
    $technician->syncRoles([RoleName::FieldTechnician->value]);

    $asset = OperationalAsset::query()->create([
        'code' => 'TRK-202',
        'name' => 'Service Truck 2',
        'kind' => 'truck',
        'status' => AssetStatus::Available,
    ]);

    $this->actingAs($technician)->post("/operations/assets/{$asset->id}/inspections", [
        'type' => 'pre_operation',
        'result' => 'failed',
        'checklist' => ['brakes' => false, 'tires' => true],
        'findings' => 'Brake pad wear beyond limit.',
    ])->assertRedirect('/')->assertSessionHas('flash');

    expect($asset->refresh()->status)->toBe(AssetStatus::UnderInspection);
    $this->assertDatabaseHas('inspections', [
        'operational_asset_id' => $asset->id,
        'result' => 'failed',
        'technician_id' => $technician->id,
    ]);
    $this->assertDatabaseHas('audit_events', [
        'action' => 'asset.inspected',
        'actor_id' => $technician->id,
    ]);
});

it('handles maintenance order creation and verified release after post-repair passing inspection', function () {
    $technician = User::factory()->create();
    $technician->syncRoles([RoleName::FieldTechnician->value]);

    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-77',
        'name' => 'Tower Crane 77',
        'kind' => 'crane',
        'status' => AssetStatus::Available,
    ]);

    // Open blocking maintenance
    $this->actingAs($technician)->post("/operations/assets/{$asset->id}/maintenance", [
        'defect' => 'Winch motor noise',
        'dispatch_blocking' => true,
        'remarks' => 'Requires replacement bearing',
    ])->assertRedirect('/')->assertSessionHas('flash');

    expect($asset->refresh()->status)->toBe(AssetStatus::UnderMaintenance);
    $workOrder = MaintenanceWorkOrder::query()->where('operational_asset_id', $asset->id)->first();
    expect($workOrder->dispatch_blocking)->toBeTrue();

    // Release before passing inspection should fail
    $this->actingAs($technician)->post("/operations/maintenance/{$workOrder->id}/release", [
        'work_performed' => ['Replaced winch motor bearing'],
        'parts' => ['BRG-900'],
    ])->assertSessionHasErrors(['inspection']);

    // Inspection BEFORE repair should not count for post-repair release
    $asset->inspections()->create([
        'technician_id' => $technician->id,
        'type' => 'pre_operation',
        'result' => 'passed',
        'checklist' => ['check' => true],
        'completed_at' => $workOrder->created_at->subMinute(),
    ]);

    $this->actingAs($technician)->post("/operations/maintenance/{$workOrder->id}/release", [
        'work_performed' => ['Replaced winch motor bearing'],
        'parts' => ['BRG-900'],
    ])->assertSessionHasErrors(['inspection']);

    // Inspection AFTER repair allows successful release
    $asset->inspections()->create([
        'technician_id' => $technician->id,
        'type' => 'maintenance',
        'result' => 'passed',
        'checklist' => ['winch' => true],
        'completed_at' => now(),
    ]);

    $this->actingAs($technician)->post("/operations/maintenance/{$workOrder->id}/release", [
        'work_performed' => ['Replaced winch motor bearing'],
        'parts' => ['BRG-900'],
        'remarks' => 'Tested under load, fully operational.',
    ])->assertRedirect('/')->assertSessionHas('flash');

    expect($workOrder->refresh()->released_at)->not->toBeNull();
    expect($workOrder->release_verified_by)->toBe($technician->id);
    expect($asset->refresh()->status)->toBe(AssetStatus::ReadyForService);
    $this->assertDatabaseHas('audit_events', [
        'action' => 'maintenance.released',
        'actor_id' => $technician->id,
    ]);
});

it('prevents unsafe assets from being assessed as eligible for dispatch assignment', function () {
    $eligibility = app(DispatchResourceEligibility::class);

    $creator = User::factory()->create();
    $job = DispatchJob::query()->create([
        'reference' => 'DSP-TEST-001',
        'client' => 'Test Client',
        'title' => 'Test Dispatch Job',
        'site' => 'Site A',
        'status' => DispatchStatus::Draft,
        'priority' => DispatchPriority::Routine,
        'scheduled_start' => now()->addHour(),
        'scheduled_end' => now()->addHours(4),
        'created_by' => $creator->id,
        'version' => 1,
    ]);

    // Asset with under_maintenance status
    $asset1 = OperationalAsset::query()->create([
        'code' => 'TRK-505',
        'name' => 'Unsafe Truck',
        'kind' => 'truck',
        'status' => AssetStatus::UnderMaintenance,
    ]);

    $assessment1 = $eligibility->asset($asset1, 'truck', $job);
    expect($assessment1['eligible'])->toBeFalse();
    expect($assessment1['reasons'])->toContain('Readiness is Under maintenance.');
});
