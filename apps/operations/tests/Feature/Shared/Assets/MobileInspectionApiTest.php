<?php

use App\Modules\Dvir\Enums\DvirInspectionType;
use App\Modules\Dvir\Models\DvirInspection;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('allows submitting an inspection via mobile api', function (): void {
    $user = User::factory()->create(['is_active' => true]);
    $user->givePermissionTo('equipment.inspect');
    $token = $user->createToken('Mobile Token')->plainTextToken;

    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-TEST-01',
        'name' => 'Test Crane',
        'kind' => 'crane',
        'status' => AssetStatus::ReadyForService->value,
    ]);

    $response = $this->withToken($token)
        ->postJson("/api/v1/assets/{$asset->id}/inspections", [
            'type' => 'pre_operation',
            'result' => 'passed',
            'checklist' => [
                ['id' => '1', 'status' => 'good'],
            ],
            'findings' => 'All good',
        ]);

    $response->assertCreated();
    $this->assertDatabaseHas('inspections', [
        'operational_asset_id' => $asset->id,
        'result' => 'passed',
    ]);
});

it('allows creating and releasing a maintenance work order via mobile api', function (): void {
    $user = User::factory()->create(['is_active' => true]);
    $user->givePermissionTo('equipment.maintain');
    $user->givePermissionTo('equipment.inspect');
    $token = $user->createToken('Mobile Token')->plainTextToken;

    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-TEST-02',
        'name' => 'Test Crane 2',
        'kind' => 'crane',
        'status' => AssetStatus::ReadyForService->value,
    ]);

    $response = $this->withToken($token)
        ->postJson("/api/v1/assets/{$asset->id}/maintenance", [
            'defect' => 'Engine noise',
            'dispatch_blocking' => true,
            'remarks' => 'Needs checking',
        ]);

    $response->assertCreated();
    $workOrderId = $response->json('data.id');

    $this->assertDatabaseHas('maintenance_work_orders', [
        'id' => $workOrderId,
        'defect' => 'Engine noise',
        'dispatch_blocking' => true,
    ]);

    expect($asset->fresh()->status)->toBe(AssetStatus::UnderMaintenance);

    $this->withToken($token)
        ->postJson("/api/v1/maintenance/{$workOrderId}/complete", [
            'work_performed' => ['Replaced engine belt'],
        ])
        ->assertOk();

    $this->withToken($token)
        ->postJson("/api/v1/assets/{$asset->id}/inspections", [
            'type' => 'post_repair',
            'result' => 'passed',
            'checklist' => [
                ['id' => '1', 'status' => 'good'],
            ],
            'findings' => 'Fixed',
        ]);

    $releaseResponse = $this->withToken($token)
        ->postJson("/api/v1/maintenance/{$workOrderId}/release", [
            'work_performed' => ['Replaced engine belt'],
            'parts' => [],
            'remarks' => 'Done',
        ]);

    $releaseResponse->assertOk();
    $this->assertDatabaseHas('maintenance_work_orders', [
        'id' => $workOrderId,
        'dispatch_blocking' => false,
    ]);

    expect($asset->fresh()->status)->toBe(AssetStatus::ReadyForService);
});

it('rejects unauthorized inspection submission', function (): void {
    $unauthorizedUser = User::factory()->create(['is_active' => true]);
    $token = $unauthorizedUser->createToken('Mobile Token')->plainTextToken;

    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-TEST-03',
        'name' => 'Test Crane 3',
        'kind' => 'crane',
        'status' => AssetStatus::ReadyForService->value,
    ]);

    $response = $this->withToken($token)
        ->postJson("/api/v1/assets/{$asset->id}/inspections", [
            'type' => 'pre_operation',
            'result' => 'passed',
            'checklist' => [['id' => '1', 'status' => 'good']],
        ]);

    $response->assertForbidden();
});

it('transitions asset to under_inspection on failed inspection', function (): void {
    $user = User::factory()->create(['is_active' => true]);
    $user->givePermissionTo('equipment.inspect');
    $token = $user->createToken('Mobile Token')->plainTextToken;

    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-TEST-04',
        'name' => 'Test Crane 4',
        'kind' => 'crane',
        'status' => AssetStatus::ReadyForService->value,
    ]);

    $response = $this->withToken($token)
        ->postJson("/api/v1/assets/{$asset->id}/inspections", [
            'type' => 'pre_operation',
            'result' => 'failed',
            'checklist' => [['id' => '1', 'status' => 'failed']],
            'findings' => 'Worn hydraulic wiper seal',
        ]);

    $response->assertCreated();
    expect($asset->fresh()->status)->toBe(AssetStatus::UnderInspection);
});

it('transitions asset to under_maintenance on failed inspection with critical defect', function (): void {
    $user = User::factory()->create(['is_active' => true]);
    $user->givePermissionTo('equipment.inspect');
    $token = $user->createToken('Mobile Token')->plainTextToken;

    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-TEST-04B',
        'name' => 'Test Crane 4B',
        'kind' => 'crane',
        'status' => AssetStatus::ReadyForService->value,
    ]);

    $response = $this->withToken($token)
        ->postJson("/api/v1/assets/{$asset->id}/inspections", [
            'type' => 'pre_operation',
            'result' => 'failed',
            'checklist' => [['id' => '1', 'status' => 'critical']],
            'findings' => 'Cracked boom pin',
        ]);

    $response->assertCreated();
    expect($asset->fresh()->status)->toBe(AssetStatus::UnderMaintenance);
});

it('does not downgrade an existing under_maintenance asset to under_inspection on non-critical failed inspection', function (): void {
    $user = User::factory()->create(['is_active' => true]);
    $user->givePermissionTo('equipment.inspect');
    $token = $user->createToken('Mobile Token')->plainTextToken;

    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-TEST-04C',
        'name' => 'Test Crane 4C',
        'kind' => 'crane',
        'status' => AssetStatus::UnderMaintenance->value,
    ]);

    $response = $this->withToken($token)
        ->postJson("/api/v1/assets/{$asset->id}/inspections", [
            'type' => 'pre_operation',
            'result' => 'failed',
            'checklist' => [['id' => '1', 'status' => 'failed']],
            'findings' => 'Minor paint chip',
        ]);

    $response->assertCreated();
    expect($asset->fresh()->status)->toBe(AssetStatus::UnderMaintenance);
});

it('strictly rejects releasing a work order without a passing post-repair inspection', function (): void {
    $user = User::factory()->create(['is_active' => true]);
    $user->givePermissionTo('equipment.maintain');
    $token = $user->createToken('Mobile Token')->plainTextToken;

    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-TEST-05',
        'name' => 'Test Crane 5',
        'kind' => 'crane',
        'status' => AssetStatus::ReadyForService->value,
    ]);

    $woResponse = $this->withToken($token)
        ->postJson("/api/v1/assets/{$asset->id}/maintenance", [
            'defect' => 'Boom hydraulic leak',
            'dispatch_blocking' => true,
        ]);

    $woResponse->assertCreated();
    $workOrderId = $woResponse->json('data.id');

    // Attempt release without post-repair inspection
    $releaseResponse = $this->withToken($token)
        ->postJson("/api/v1/maintenance/{$workOrderId}/release", [
            'work_performed' => ['Replaced hydraulic fitting'],
        ]);

    $releaseResponse->assertUnprocessable();
    $releaseResponse->assertJsonValidationErrors(['inspection']);
    expect($asset->fresh()->status)->toBe(AssetStatus::UnderMaintenance);
});

it('keeps asset locked in maintenance if another blocking work order exists', function (): void {
    $user = User::factory()->create(['is_active' => true]);
    $user->givePermissionTo('equipment.maintain');
    $user->givePermissionTo('equipment.inspect');
    $token = $user->createToken('Mobile Token')->plainTextToken;

    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-TEST-06',
        'name' => 'Test Crane 6',
        'kind' => 'crane',
        'status' => AssetStatus::ReadyForService->value,
    ]);

    // Create Work Order 1
    $wo1Response = $this->withToken($token)
        ->postJson("/api/v1/assets/{$asset->id}/maintenance", [
            'defect' => 'Defect 1',
            'dispatch_blocking' => true,
        ]);
    $wo1Id = $wo1Response->json('data.id');

    // Create Work Order 2
    $wo2Response = $this->withToken($token)
        ->postJson("/api/v1/assets/{$asset->id}/maintenance", [
            'defect' => 'Defect 2',
            'dispatch_blocking' => true,
        ]);
    $wo2Id = $wo2Response->json('data.id');

    expect($asset->fresh()->status)->toBe(AssetStatus::UnderMaintenance);

    // Complete Work Order 1
    $this->withToken($token)
        ->postJson("/api/v1/maintenance/{$wo1Id}/complete", [
            'work_performed' => ['Fixed defect 1'],
        ])
        ->assertOk();

    // Perform passing inspection
    $this->withToken($token)
        ->postJson("/api/v1/assets/{$asset->id}/inspections", [
            'type' => 'post_repair',
            'result' => 'passed',
            'checklist' => [['id' => '1', 'status' => 'good']],
        ]);

    // Release only Work Order 1
    $releaseResponse = $this->withToken($token)
        ->postJson("/api/v1/maintenance/{$wo1Id}/release", [
            'work_performed' => ['Fixed defect 1'],
        ]);

    $releaseResponse->assertOk();

    // Asset MUST remain UnderMaintenance because Work Order 2 is still blocking
    expect($asset->fresh()->status)->toBe(AssetStatus::UnderMaintenance);
});

it('rejects work order release when inspection is pre_operation rather than post-repair verification', function (): void {
    $user = User::factory()->create(['is_active' => true]);
    $user->givePermissionTo('equipment.maintain');
    $user->givePermissionTo('equipment.inspect');
    $token = $user->createToken('Mobile Token')->plainTextToken;

    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-TEST-07',
        'name' => 'Test Crane 7',
        'kind' => 'crane',
        'status' => AssetStatus::ReadyForService->value,
    ]);

    $woResponse = $this->withToken($token)
        ->postJson("/api/v1/assets/{$asset->id}/maintenance", [
            'defect' => 'Winch brake slippage',
            'dispatch_blocking' => true,
        ]);
    $woId = $woResponse->json('data.id');

    // Attempt to pass with a pre_operation inspection
    $this->withToken($token)
        ->postJson("/api/v1/assets/{$asset->id}/inspections", [
            'type' => 'pre_operation',
            'result' => 'passed',
            'checklist' => [['id' => '1', 'status' => 'good']],
            'findings' => 'Walkaround passed',
        ]);

    $releaseResponse = $this->withToken($token)
        ->postJson("/api/v1/maintenance/{$woId}/release", [
            'work_performed' => ['Adjusted winch brake band'],
        ]);

    $releaseResponse->assertUnprocessable();
    $releaseResponse->assertJsonValidationErrors(['inspection']);
    expect($asset->fresh()->status)->toBe(AssetStatus::UnderMaintenance);
});

it('rejects work order release when only routine post-trip dvir is present and requires authoritative post_repair inspection', function (): void {
    $user = User::factory()->create(['is_active' => true]);
    $user->givePermissionTo('equipment.maintain');
    $user->givePermissionTo('equipment.inspect');
    $token = $user->createToken('Mobile Token')->plainTextToken;

    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-TEST-DVIR-REL',
        'name' => 'Test Crane DVIR',
        'kind' => 'crane',
        'status' => AssetStatus::ReadyForService->value,
    ]);

    $woResponse = $this->withToken($token)
        ->postJson("/api/v1/assets/{$asset->id}/maintenance", [
            'defect' => 'Hydraulic line split',
            'dispatch_blocking' => true,
        ]);
    $woResponse->assertCreated();
    $woId = $woResponse->json('data.id');

    // Complete repair
    $this->withToken($token)
        ->postJson("/api/v1/maintenance/{$woId}/complete", [
            'work_performed' => ['Replaced hydraulic pressure hose'],
        ])
        ->assertOk();

    // Create a clean routine post_trip DVIR inspection after repair completion
    $asset->dvirInspections()->create([
        'user_id' => $user->id,
        'inspection_type' => DvirInspectionType::POST_TRIP->value,
        'inspector_name' => $user->name,
        'has_defects' => false,
        'critical_defects_count' => 0,
        'completed_at' => now()->addMinutes(1),
        'signature_captured' => true,
        'reference' => 'DVIR-ROUTINE-999',
    ]);

    // Routine post-trip DVIR must NOT authorize release
    $releaseResponse = $this->withToken($token)
        ->postJson("/api/v1/maintenance/{$woId}/release", [
            'work_performed' => ['Replaced hydraulic pressure hose'],
        ]);
    $releaseResponse->assertUnprocessable();
    $releaseResponse->assertJsonValidationErrors(['inspection']);
    expect($asset->fresh()->status)->toBe(AssetStatus::UnderMaintenance);

    // Now submit authoritative post_repair inspection
    $this->withToken($token)
        ->postJson("/api/v1/assets/{$asset->id}/inspections", [
            'type' => 'post_repair',
            'result' => 'passed',
            'checklist' => [['id' => 'hyd-01', 'status' => 'good']],
            'findings' => 'Post-repair hydraulic pressure verification passed',
        ])
        ->assertCreated();

    // Authoritative post_repair inspection authorizes release
    $releaseResponse = $this->withToken($token)
        ->postJson("/api/v1/maintenance/{$woId}/release", [
            'work_performed' => ['Replaced hydraulic pressure hose'],
        ]);
    $releaseResponse->assertOk();
    expect($asset->fresh()->status)->toBe(AssetStatus::ReadyForService);
});

it('forbids managerial override release when user lacks maintenance permission for asset kind', function (): void {
    $fleetTech = User::factory()->create(['is_active' => true]);
    $fleetTech->givePermissionTo('fleet.maintain');
    $fleetToken = $fleetTech->createToken('Mobile Token')->plainTextToken;

    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-TEST-08',
        'name' => 'Test Crane 8',
        'kind' => 'crane',
        'status' => AssetStatus::ReadyForService->value,
    ]);

    $wo = $asset->maintenanceWorkOrders()->create([
        'defect' => 'Boom angle sensor drift',
        'dispatch_blocking' => true,
        'status' => AssetStatus::UnderMaintenance->value,
        'technician_id' => $fleetTech->id,
    ]);

    // Technician with fleet.maintain attempts to release an equipment (crane) asset with override
    $releaseResponse = $this->withToken($fleetToken)
        ->postJson("/api/v1/maintenance/{$wo->id}/release", [
            'work_performed' => ['Recalibrated sensor'],
            'managerial_override' => true,
            'override_reason' => 'Emergency dispatch requirement',
        ]);

    $releaseResponse->assertForbidden();
    expect($asset->fresh()->status)->toBe(AssetStatus::ReadyForService);
});

it('forbids release with override when user is an operator without maintenance permissions', function (): void {
    $operator = User::factory()->create(['is_active' => true]);
    $operator->assignRole(RoleName::CraneOperator->value);
    $operatorToken = $operator->createToken('Mobile Token')->plainTextToken;

    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-TEST-09',
        'name' => 'Test Crane 9',
        'kind' => 'crane',
        'status' => AssetStatus::ReadyForService->value,
    ]);

    $wo = $asset->maintenanceWorkOrders()->create([
        'defect' => 'Hydraulic line pinhole leak',
        'dispatch_blocking' => true,
        'status' => AssetStatus::UnderMaintenance->value,
        'technician_id' => $operator->id,
    ]);

    $releaseResponse = $this->withToken($operatorToken)
        ->postJson("/api/v1/maintenance/{$wo->id}/release", [
            'work_performed' => ['Taped line'],
            'managerial_override' => true,
            'override_reason' => 'Operator unauthorized release',
        ]);

    $releaseResponse->assertForbidden();
});

it('requires override_reason when managerial_override is true', function (): void {
    $tech = User::factory()->create(['is_active' => true]);
    $tech->givePermissionTo('equipment.maintain');
    $token = $tech->createToken('Mobile Token')->plainTextToken;

    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-TEST-10',
        'name' => 'Test Crane 10',
        'kind' => 'crane',
        'status' => AssetStatus::UnderMaintenance->value,
    ]);

    $wo = $asset->maintenanceWorkOrders()->create([
        'defect' => 'Loose pin',
        'dispatch_blocking' => true,
        'status' => AssetStatus::UnderMaintenance->value,
        'technician_id' => $tech->id,
    ]);

    $releaseResponse = $this->withToken($token)
        ->postJson("/api/v1/maintenance/{$wo->id}/release", [
            'work_performed' => ['Tightened pin'],
            'managerial_override' => true,
            'override_reason' => '',
        ]);

    $releaseResponse->assertUnprocessable();
    $releaseResponse->assertJsonValidationErrors(['override_reason']);
});

it('allows authorized technician to release with managerial override and valid reason', function (): void {
    $tech = User::factory()->create(['is_active' => true]);
    $tech->givePermissionTo('equipment.maintain');
    $token = $tech->createToken('Mobile Token')->plainTextToken;

    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-TEST-11',
        'name' => 'Test Crane 11',
        'kind' => 'crane',
        'status' => AssetStatus::UnderMaintenance->value,
    ]);

    $wo = $asset->maintenanceWorkOrders()->create([
        'defect' => 'Minor beacon light fault',
        'dispatch_blocking' => true,
        'status' => AssetStatus::UnderMaintenance->value,
        'technician_id' => $tech->id,
    ]);

    $releaseResponse = $this->withToken($token)
        ->postJson("/api/v1/maintenance/{$wo->id}/release", [
            'work_performed' => ['Replaced bulb'],
            'managerial_override' => true,
            'override_reason' => 'Verified replacement in yard.',
        ]);

    $releaseResponse->assertOk();
    expect($asset->fresh()->status)->toBe(AssetStatus::ReadyForService);
    expect($wo->fresh()->dispatch_blocking)->toBeFalse();
});

it('blocks work order release when a subsequent defect inspection occurred after post-repair inspection', function (string $source): void {
    $tech = User::factory()->create(['is_active' => true]);
    $tech->givePermissionTo('equipment.maintain');
    $tech->givePermissionTo('equipment.inspect');
    $token = $tech->createToken('Mobile Token')->plainTextToken;

    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-TEST-12',
        'name' => 'Test Crane 12',
        'kind' => 'crane',
        'status' => AssetStatus::ReadyForService->value,
    ]);

    $woResponse = $this->withToken($token)
        ->postJson("/api/v1/assets/{$asset->id}/maintenance", [
            'defect' => 'Hoist wire fraying',
            'dispatch_blocking' => true,
        ]);
    $woId = $woResponse->json('data.id');

    $this->withToken($token)->postJson("/api/v1/maintenance/{$woId}/complete", [
        'work_performed' => ['Replaced wire rope'],
    ])->assertOk();

    // 1. Post-repair inspection at T1 passes
    $this->withToken($token)
        ->postJson("/api/v1/assets/{$asset->id}/inspections", [
            'type' => 'post_repair',
            'result' => 'passed',
            'checklist' => [['id' => '1', 'status' => 'good']],
            'findings' => 'Cable replaced and inspected',
        ])->assertCreated();

    // 2. Subsequent inspection at T2 reports a new defect
    $this->travel(1)->minutes();
    if ($source === 'dvir') {
        DvirInspection::query()->create([
            'user_id' => $tech->id,
            'operational_asset_id' => $asset->id,
            'inspection_type' => 'post_trip',
            'has_defects' => true,
            'critical_defects_count' => 0,
            'completed_at' => now(),
        ]);
    } else {
        $this->withToken($token)
            ->postJson("/api/v1/assets/{$asset->id}/inspections", [
                'type' => 'safety',
                'result' => 'failed',
                'checklist' => [['id' => '1', 'status' => 'bad']],
                'findings' => 'Hook latch snapped during load test',
            ])->assertCreated();
    }

    // 3. Attempt to release work order should be blocked due to subsequent unaddressed defect
    $releaseResponse = $this->withToken($token)
        ->postJson("/api/v1/maintenance/{$woId}/release", [
            'work_performed' => ['Replaced wire rope'],
        ]);

    $releaseResponse->assertUnprocessable();
    $releaseResponse->assertJsonValidationErrors(['inspection']);
    $releaseResponse->assertJsonPath('errors.inspection.0', 'A subsequent inspection reported defects after post-repair verification. A new passing post-repair verification is required before release.');
    expect($asset->fresh()->status)->toBe(AssetStatus::UnderMaintenance);
})->with(['workshop', 'dvir']);

it('rejects pre-trip DVIR from authorizing maintenance work order release', function (): void {
    $tech = User::factory()->create(['is_active' => true]);
    $tech->givePermissionTo('fleet.maintain');
    $token = $tech->createToken('Mobile Token')->plainTextToken;

    $asset = OperationalAsset::query()->create([
        'code' => 'TRK-TEST-01',
        'name' => 'Test Truck 1',
        'kind' => 'truck',
        'status' => AssetStatus::UnderMaintenance->value,
    ]);

    $wo = $asset->maintenanceWorkOrders()->create([
        'defect' => 'Brake pad wear',
        'dispatch_blocking' => true,
        'status' => AssetStatus::UnderMaintenance->value,
        'technician_id' => $tech->id,
    ]);

    // Create a passing pre-trip DVIR inspection
    $asset->dvirInspections()->create([
        'user_id' => $tech->id,
        'inspection_type' => DvirInspectionType::PRE_TRIP->value,
        'has_defects' => false,
        'critical_defects_count' => 0,
        'completed_at' => now(),
        'walkaround_photos' => ['front' => 'photos/front.jpg'],
        'status' => 'completed',
    ]);

    // Pre-trip DVIR cannot authorize release
    $releaseResponse = $this->withToken($token)
        ->postJson("/api/v1/maintenance/{$wo->id}/release", [
            'work_performed' => ['Replaced brake pads'],
        ]);

    $releaseResponse->assertUnprocessable();
    $releaseResponse->assertJsonValidationErrors(['inspection']);
    expect($asset->fresh()->status)->toBe(AssetStatus::UnderMaintenance);
});

it('supports idempotent replay of inspection and maintenance endpoints', function (): void {
    $tech = User::factory()->create(['is_active' => true]);
    $tech->givePermissionTo('equipment.maintain');
    $tech->givePermissionTo('equipment.inspect');
    $token = $tech->createToken('Mobile Token')->plainTextToken;

    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-TEST-IDEMP',
        'name' => 'Test Crane Idemp',
        'kind' => 'crane',
        'status' => AssetStatus::ReadyForService->value,
    ]);

    $commandId1 = (string) Str::uuid();

    // 1. Submit inspection twice with same command ID
    $res1 = $this->withToken($token)
        ->withHeader('X-Command-Id', $commandId1)
        ->postJson("/api/v1/assets/{$asset->id}/inspections", [
            'type' => 'maintenance',
            'result' => 'passed',
            'checklist' => [['id' => '1', 'status' => 'good']],
        ]);
    $res1->assertCreated();

    $res2 = $this->withToken($token)
        ->withHeader('X-Command-Id', $commandId1)
        ->postJson("/api/v1/assets/{$asset->id}/inspections", [
            'type' => 'maintenance',
            'result' => 'passed',
            'checklist' => [['id' => '1', 'status' => 'good']],
        ]);
    $res2->assertCreated();

    // Exactly 1 inspection record in DB
    expect($asset->inspections()->count())->toBe(1);

    // 2. Submit maintenance work order twice with same command ID
    $commandId2 = (string) Str::uuid();
    $woRes1 = $this->withToken($token)
        ->withHeader('X-Command-Id', $commandId2)
        ->postJson("/api/v1/assets/{$asset->id}/maintenance", [
            'defect' => 'Winch motor over-temp',
            'dispatch_blocking' => true,
        ]);
    $woRes1->assertCreated();
    $woId = $woRes1->json('data.id');

    $woRes2 = $this->withToken($token)
        ->withHeader('X-Command-Id', $commandId2)
        ->postJson("/api/v1/assets/{$asset->id}/maintenance", [
            'defect' => 'Winch motor over-temp',
            'dispatch_blocking' => true,
        ]);
    $woRes2->assertCreated();
    expect($woRes2->json('data.id'))->toBe($woId);
    expect($asset->maintenanceWorkOrders()->count())->toBe(1);

    // 3. Complete repair twice with same command ID
    $commandIdComplete = (string) Str::uuid();
    $this->flushHeaders();
    $this->withToken($token)
        ->withHeader('X-Command-Id', $commandIdComplete)
        ->postJson("/api/v1/maintenance/{$woId}/complete", [
            'work_performed' => ['Coolant replaced and motor tested'],
        ])
        ->assertOk();

    $this->withToken($token)
        ->withHeader('X-Command-Id', $commandIdComplete)
        ->postJson("/api/v1/maintenance/{$woId}/complete", [
            'work_performed' => ['Coolant replaced and motor tested'],
        ])
        ->assertOk();

    // 4. Post-repair inspection
    $this->flushHeaders();
    $this->withToken($token)
        ->postJson("/api/v1/assets/{$asset->id}/inspections", [
            'type' => 'post_repair',
            'result' => 'passed',
            'checklist' => [['id' => '1', 'status' => 'good']],
        ]);

    // 4. Release twice with same command ID
    $commandId3 = (string) Str::uuid();
    $rel1 = $this->withToken($token)
        ->withHeader('X-Command-Id', $commandId3)
        ->postJson("/api/v1/maintenance/{$woId}/release", [
            'work_performed' => ['Coolant replaced and motor tested'],
        ]);
    $rel1->assertOk();

    $rel2 = $this->withToken($token)
        ->withHeader('X-Command-Id', $commandId3)
        ->postJson("/api/v1/maintenance/{$woId}/release", [
            'work_performed' => ['Coolant replaced and motor tested'],
        ]);
    $rel2->assertOk();
    expect($asset->fresh()->status)->toBe(AssetStatus::ReadyForService);
});

it('rejects work order release when passing inspection occurred before repair completion', function (): void {
    $tech = User::factory()->create(['is_active' => true]);
    $tech->givePermissionTo('equipment.maintain');
    $tech->givePermissionTo('equipment.inspect');
    $token = $tech->createToken('Mobile Token')->plainTextToken;

    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-TEST-TIMING-01',
        'name' => 'Timing Test Crane',
        'kind' => 'crane',
        'status' => AssetStatus::ReadyForService->value,
    ]);

    // 1. Work order created at T0 (10:00)
    Carbon::setTestNow(Carbon::parse('2026-09-17 10:00:00'));
    $woResponse = $this->withToken($token)
        ->postJson("/api/v1/assets/{$asset->id}/maintenance", [
            'defect' => 'Hydraulic seal leak',
            'dispatch_blocking' => true,
        ]);
    $woResponse->assertCreated();
    $woId = $woResponse->json('data.id');
    expect($asset->fresh()->status)->toBe(AssetStatus::UnderMaintenance);

    // 2. Passing inspection at T1 (10:15) - BEFORE repair completion
    Carbon::setTestNow(Carbon::parse('2026-09-17 10:15:00'));
    $insp1 = $this->withToken($token)
        ->postJson("/api/v1/assets/{$asset->id}/inspections", [
            'type' => 'post_repair',
            'result' => 'passed',
            'checklist' => [['id' => '1', 'status' => 'good']],
            'findings' => 'Visual walkaround before repair finished',
        ]);
    $insp1->assertCreated();

    // 3. Repair completed at T2 (10:30)
    Carbon::setTestNow(Carbon::parse('2026-09-17 10:30:00'));
    $completeRes = $this->withToken($token)
        ->postJson("/api/v1/maintenance/{$woId}/complete", [
            'work_performed' => ['Replaced hydraulic seal and bled lines'],
        ]);
    $completeRes->assertOk();
    $completeRes->assertJsonPath('data.status', 'repair_completed');

    // 4. Release attempted at T3 (10:35) -> must be REJECTED because inspection at T1 was before repair completion T2
    Carbon::setTestNow(Carbon::parse('2026-09-17 10:35:00'));
    $releaseFail = $this->withToken($token)
        ->postJson("/api/v1/maintenance/{$woId}/release", [
            'work_performed' => ['Replaced hydraulic seal and bled lines'],
        ]);
    $releaseFail->assertUnprocessable();
    $releaseFail->assertJsonValidationErrors(['inspection']);
    expect($asset->fresh()->status)->toBe(AssetStatus::UnderMaintenance);

    // 5. Qualifying new inspection at T4 (10:40) -> AFTER repair completion
    Carbon::setTestNow(Carbon::parse('2026-09-17 10:40:00'));
    $insp2 = $this->withToken($token)
        ->postJson("/api/v1/assets/{$asset->id}/inspections", [
            'type' => 'post_repair',
            'result' => 'passed',
            'checklist' => [['id' => '1', 'status' => 'good']],
            'findings' => 'Post-repair leak pressure test verified clean',
        ]);
    $insp2->assertCreated();

    // 6. Release attempted at T5 (10:45) -> SUCCEEDS
    Carbon::setTestNow(Carbon::parse('2026-09-17 10:45:00'));
    $releaseSuccess = $this->withToken($token)
        ->postJson("/api/v1/maintenance/{$woId}/release", [
            'work_performed' => ['Replaced hydraulic seal and bled lines'],
        ]);
    $releaseSuccess->assertOk();
    expect($asset->fresh()->status)->toBe(AssetStatus::ReadyForService);
    expect($asset->fresh()->maintenanceWorkOrders()->find($woId)->dispatch_blocking)->toBeFalse();

    Carbon::setTestNow();
});

it('rejects release of blocking work order when persisted repair completion is missing', function (): void {
    $tech = User::factory()->create(['is_active' => true]);
    $tech->givePermissionTo('equipment.maintain');
    $tech->givePermissionTo('equipment.inspect');
    $token = $tech->createToken('Mobile Token')->plainTextToken;

    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-TEST-NOREP',
        'name' => 'No Repair Crane',
        'kind' => 'crane',
        'status' => AssetStatus::ReadyForService->value,
    ]);

    $woResponse = $this->withToken($token)
        ->postJson("/api/v1/assets/{$asset->id}/maintenance", [
            'defect' => 'Worn sheaves',
            'dispatch_blocking' => true,
        ]);
    $woResponse->assertCreated();
    $woId = $woResponse->json('data.id');

    // Passing inspection submitted, but repair completion was NEVER recorded
    $this->withToken($token)
        ->postJson("/api/v1/assets/{$asset->id}/inspections", [
            'type' => 'post_repair',
            'result' => 'passed',
            'checklist' => [['id' => '1', 'status' => 'good']],
        ])
        ->assertCreated();

    // Release must be rejected with completed_at validation error
    $releaseResponse = $this->withToken($token)
        ->postJson("/api/v1/maintenance/{$woId}/release", [
            'work_performed' => ['Replaced sheaves'],
        ]);

    $releaseResponse->assertUnprocessable();
    $releaseResponse->assertJsonValidationErrors(['completed_at']);
    expect($asset->fresh()->status)->toBe(AssetStatus::UnderMaintenance);
});

it('rejects release request attempting to substitute an earlier completed_at than recorded repair completion', function (): void {
    $tech = User::factory()->create(['is_active' => true]);
    $tech->givePermissionTo('equipment.maintain');
    $tech->givePermissionTo('equipment.inspect');
    $token = $tech->createToken('Mobile Token')->plainTextToken;

    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-TEST-EARLIER',
        'name' => 'Earlier Time Crane',
        'kind' => 'crane',
        'status' => AssetStatus::ReadyForService->value,
    ]);

    Carbon::setTestNow(Carbon::parse('2026-09-17 10:00:00'));
    $woResponse = $this->withToken($token)
        ->postJson("/api/v1/assets/{$asset->id}/maintenance", [
            'defect' => 'Outrigger cylinder leak',
            'dispatch_blocking' => true,
        ]);
    $woResponse->assertCreated();
    $woId = $woResponse->json('data.id');

    // Repair completed at 10:30
    Carbon::setTestNow(Carbon::parse('2026-09-17 10:30:00'));
    $this->withToken($token)
        ->postJson("/api/v1/maintenance/{$woId}/complete", [
            'work_performed' => ['Repacked cylinder'],
        ])
        ->assertOk();

    // Passing inspection at 10:35
    Carbon::setTestNow(Carbon::parse('2026-09-17 10:35:00'));
    $this->withToken($token)
        ->postJson("/api/v1/assets/{$asset->id}/inspections", [
            'type' => 'post_repair',
            'result' => 'passed',
            'checklist' => [['id' => '1', 'status' => 'good']],
        ])
        ->assertCreated();

    // Release payload attempts to substitute completed_at as 10:15 (earlier than 10:30)
    Carbon::setTestNow(Carbon::parse('2026-09-17 10:40:00'));
    $releaseResponse = $this->withToken($token)
        ->postJson("/api/v1/maintenance/{$woId}/release", [
            'work_performed' => ['Repacked cylinder'],
            'completed_at' => '2026-09-17 10:15:00',
        ]);

    $releaseResponse->assertUnprocessable();
    $releaseResponse->assertJsonValidationErrors(['completed_at']);
    expect($asset->fresh()->status)->toBe(AssetStatus::UnderMaintenance);

    Carbon::setTestNow();
});

it('rejects unauthorized repair completion recording', function (): void {
    $unauth = User::factory()->create(['is_active' => true]);
    $unauthToken = $unauth->createToken('Unauth')->plainTextToken;

    $tech = User::factory()->create(['is_active' => true]);
    $tech->givePermissionTo('equipment.maintain');

    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-TEST-UNAUTH-COMP',
        'name' => 'Unauth Crane',
        'kind' => 'crane',
        'status' => AssetStatus::UnderMaintenance->value,
    ]);

    $wo = $asset->maintenanceWorkOrders()->create([
        'defect' => 'Boom cable wear',
        'dispatch_blocking' => true,
        'status' => AssetStatus::UnderMaintenance->value,
        'technician_id' => $tech->id,
    ]);

    $this->withToken($unauthToken)
        ->postJson("/api/v1/maintenance/{$wo->id}/complete", [
            'work_performed' => ['Attempted unauthorized repair completion'],
        ])
        ->assertForbidden();
});

it('protects repair completion recording against unauthorized changes and retries that alter its meaning', function (): void {
    $tech = User::factory()->create(['is_active' => true]);
    $tech->givePermissionTo('equipment.maintain');
    $token = $tech->createToken('Tech')->plainTextToken;

    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-TEST-PROT',
        'name' => 'Protection Crane',
        'kind' => 'crane',
        'status' => AssetStatus::ReadyForService->value,
    ]);

    Carbon::setTestNow(Carbon::parse('2026-09-17 10:00:00'));
    $woResponse = $this->withToken($token)
        ->postJson("/api/v1/assets/{$asset->id}/maintenance", [
            'defect' => 'Electrical harness fault',
            'dispatch_blocking' => true,
        ]);
    $woResponse->assertCreated();
    $woId = $woResponse->json('data.id');

    // 2. Cannot record completion with a timestamp earlier than work order creation
    $this->withToken($token)
        ->postJson("/api/v1/maintenance/{$woId}/complete", [
            'work_performed' => ['Harness repair'],
            'completed_at' => '2026-09-17 09:30:00',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['completed_at']);

    // 3. Authorized technician records valid repair completion at 10:30 with completed_at 10:25
    Carbon::setTestNow(Carbon::parse('2026-09-17 10:30:00'));
    $res1 = $this->withToken($token)
        ->postJson("/api/v1/maintenance/{$woId}/complete", [
            'work_performed' => ['Repaired wiring'],
            'completed_at' => '2026-09-17 10:25:00',
        ]);
    $res1->assertOk();
    $firstCompletedAt = $res1->json('data.completed_at');
    expect(Carbon::parse($firstCompletedAt)->toIso8601String())
        ->toBe(Carbon::parse('2026-09-17 10:25:00')->toIso8601String());

    // 4. Subsequent retry attempting to alter completed_at to a different time must be rejected
    $resAlter = $this->withToken($token)
        ->postJson("/api/v1/maintenance/{$woId}/complete", [
            'work_performed' => ['Repaired wiring'],
            'completed_at' => '2026-09-17 10:29:00',
        ]);
    $resAlter->assertUnprocessable();
    $resAlter->assertJsonValidationErrors(['completed_at']);

    // 5. Idempotent retry without completed_at preserves original completion timestamp without advancing
    Carbon::setTestNow(Carbon::parse('2026-09-17 10:45:00'));
    $resRetry = $this->withToken($token)
        ->postJson("/api/v1/maintenance/{$woId}/complete", [
            'work_performed' => ['Repaired wiring and tested'],
        ]);
    $resRetry->assertOk();
    expect(Carbon::parse($resRetry->json('data.completed_at'))->toIso8601String())
        ->toBe(Carbon::parse('2026-09-17 10:25:00')->toIso8601String());

    Carbon::setTestNow();
});
