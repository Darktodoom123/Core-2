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

it('disables local asset registration for every operational role without changing existing records', function () {
    $existingAsset = OperationalAsset::query()->create([
        'code' => 'CORE3-TRK-101',
        'name' => 'Core 3 Heavy Hauler',
        'kind' => 'truck',
        'status' => AssetStatus::Available,
    ]);

    foreach ([RoleName::OperationsManager, RoleName::OperationsManager, RoleName::SystemAdministrator] as $role) {
        $user = User::factory()->create();
        $user->syncRoles([$role->value]);

        $this->actingAs($user)->post('/operations/assets', [
            'code' => 'CORE3-NEW-'.$role->value,
            'name' => 'Locally attempted asset',
            'kind' => 'truck',
        ])->assertForbidden();
    }

    expect(OperationalAsset::query()->count())->toBe(1);
    $this->assertDatabaseHas('operational_assets', [
        'id' => $existingAsset->id,
        'code' => 'CORE3-TRK-101',
        'name' => 'Core 3 Heavy Hauler',
        'status' => AssetStatus::Available->value,
    ]);
    $this->assertDatabaseMissing('audit_events', ['action' => 'asset.registered']);
});

it('keeps imported Core 3 assets assignable through the normal dispatch workflow', function () {
    $dispatcher = User::factory()->create();
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);
    $driver = User::factory()->create();
    $driver->syncRoles([RoleName::Driver->value]);
    $driver->personnelCredentials()->create([
        'kind' => 'driver_license',
        'credential_number' => 'CORE3-DL-101',
        'credential_type' => 'professional',
        'issued_at' => now()->subYear(),
        'expires_at' => now()->addYear(),
        'status' => 'active',
    ]);

    $asset = OperationalAsset::query()->create([
        'code' => 'CORE3-TRK-202',
        'name' => 'Imported Core 3 Truck',
        'kind' => 'truck',
        'status' => AssetStatus::Available,
    ]);
    $job = DispatchJob::query()->create([
        'reference' => 'CORE3-DSP-202',
        'client' => 'Core 3 Handoff Client',
        'title' => 'Imported asset assignment',
        'site' => 'Operations Yard',
        'scheduled_start' => now()->addDay(),
        'scheduled_end' => now()->addDay()->addHours(4),
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Draft,
        'created_by' => $dispatcher->id,
    ]);

    $this->actingAs($dispatcher)
        ->post("/operations/dispatch-jobs/{$job->id}/assignments", [
            'personnel' => [['user_id' => $driver->id, 'assignment_type' => 'driver']],
            'assets' => [['operational_asset_id' => $asset->id, 'assignment_type' => 'truck']],
        ])
        ->assertRedirect("/operations/dispatch-jobs/{$job->id}");

    $this->assertDatabaseHas('dispatch_asset_assignments', [
        'dispatch_job_id' => $job->id,
        'operational_asset_id' => $asset->id,
        'assignment_type' => 'truck',
    ]);
    $this->assertDatabaseHas('operational_assets', [
        'id' => $asset->id,
        'code' => 'CORE3-TRK-202',
    ]);
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
    $technician->syncRoles([RoleName::OperationsManager->value]);

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
    $technician->syncRoles([RoleName::OperationsManager->value]);

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
