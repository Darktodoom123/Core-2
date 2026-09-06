<?php

use App\Modules\Assignment\Actions\AssignDispatchResources;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dvir\Enums\DvirInspectionType;
use App\Modules\Dvir\Models\DvirInspection;
use App\Modules\Dvir\Models\DvirInspectionPhoto;
use App\Modules\Fuel\Enums\FuelRequestStatus;
use App\Modules\Fuel\Models\FuelRequest;
use App\Modules\HoursOfService\Enums\DutyStatus;
use App\Modules\HoursOfService\Enums\ShiftStatus;
use App\Modules\HoursOfService\Enums\StandbyReason;
use App\Modules\HoursOfService\Models\OperatorDutyLog;
use App\Modules\HoursOfService\Models\OperatorShift;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Enums\JobReportStatus;
use App\Platform\Reporting\Models\JobReport;
use App\Platform\Workspace\Http\Controllers\OperationsWorkspaceController;
use App\Platform\Workspace\ViewModels\OperationsWorkspaceViewModel;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\MaintenanceWorkOrder;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Models\Role;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
    Storage::fake('public');
    Storage::fake('r2');
});

/*
|--------------------------------------------------------------------------
| Section 1: Safety Lockout Adversarial Permutations
|--------------------------------------------------------------------------
*/

describe('Safety Lockout Adversarial Permutations', function (): void {
    test('critical defect check automatically locks asset to UnderMaintenance and generates dispatch-blocking work order', function (): void {
        $operator = User::factory()->create(['is_active' => true]);
        $operator->syncRoles([RoleName::CraneOperator->value]);
        $token = $operator->createToken('Mobile Token')->plainTextToken;

        $asset = OperationalAsset::query()->create([
            'code' => 'CRN-ADV-01',
            'name' => 'Adversarial 60T Crane',
            'kind' => 'crane',
            'status' => AssetStatus::Available,
        ]);

        $response = $this->withToken($token)
            ->postJson('/api/v1/dvir/inspections', [
                'inspection_type' => 'pre_trip',
                'operational_asset_id' => $asset->id,
                'has_defects' => true,
                'signature_captured' => true,
                'checks' => [
                    [
                        'category' => 'hydraulics',
                        'label' => 'Main Winch Motor',
                        'status' => 'critical',
                        'notes' => 'Catastrophic oil spray under load test.',
                    ],
                ],
            ]);

        $response->assertCreated();
        expect($asset->refresh()->status)->toBe(AssetStatus::UnderMaintenance);

        $workOrder = MaintenanceWorkOrder::query()->where('operational_asset_id', $asset->id)->first();
        expect($workOrder)->not()->toBeNull()
            ->and($workOrder->dispatch_blocking)->toBeTrue()
            ->and($workOrder->defect)->toContain('Main Winch Motor')
            ->and($workOrder->defect)->toContain('Catastrophic oil spray');
    });

    test('attention defect check triggers safety lockout and dispatch-blocking work order', function (): void {
        $operator = User::factory()->create(['is_active' => true]);
        $operator->syncRoles([RoleName::CraneOperator->value]);
        $token = $operator->createToken('Mobile Token')->plainTextToken;

        $asset = OperationalAsset::query()->create([
            'code' => 'CRN-ADV-02',
            'name' => 'Adversarial 80T Crane',
            'kind' => 'crane',
            'status' => AssetStatus::Available,
        ]);

        $response = $this->withToken($token)
            ->postJson('/api/v1/dvir/inspections', [
                'inspection_type' => 'pre_trip',
                'operational_asset_id' => $asset->id,
                'has_defects' => true,
                'signature_captured' => true,
                'checks' => [
                    [
                        'category' => 'electrical',
                        'label' => 'Boom Angle Sensor',
                        'status' => 'attention',
                        'notes' => 'Intermittent reading fluctuations.',
                    ],
                ],
            ]);

        $response->assertCreated();
        expect($asset->refresh()->status)->toBe(AssetStatus::UnderMaintenance);

        $workOrder = MaintenanceWorkOrder::query()->where('operational_asset_id', $asset->id)->first();
        expect($workOrder)->not()->toBeNull()
            ->and($workOrder->dispatch_blocking)->toBeTrue()
            ->and($workOrder->defect)->toContain('Boom Angle Sensor');
    });

    test('compound checks with mixed critical, attention, and good statuses enforce lockout', function (): void {
        $operator = User::factory()->create(['is_active' => true]);
        $operator->syncRoles([RoleName::CraneOperator->value]);
        $token = $operator->createToken('Mobile Token')->plainTextToken;

        $asset = OperationalAsset::query()->create([
            'code' => 'CRN-ADV-03',
            'name' => 'Compound Crane',
            'kind' => 'crane',
            'status' => AssetStatus::Available,
        ]);

        $response = $this->withToken($token)
            ->postJson('/api/v1/dvir/inspections', [
                'inspection_type' => 'pre_trip',
                'operational_asset_id' => $asset->id,
                'has_defects' => true,
                'signature_captured' => true,
                'checks' => [
                    ['category' => 'tires', 'label' => 'Tire Pressure', 'status' => 'good'],
                    ['category' => 'lighting', 'label' => 'Headlights', 'status' => 'good'],
                    ['category' => 'hydraulics', 'label' => 'Outriggers', 'status' => 'attention', 'notes' => 'Slow deploy'],
                    ['category' => 'safety', 'label' => 'Anti-Two Block Switch', 'status' => 'critical', 'notes' => 'Switch stuck'],
                ],
            ]);

        $response->assertCreated();
        expect($asset->refresh()->status)->toBe(AssetStatus::UnderMaintenance);

        $workOrder = MaintenanceWorkOrder::query()->where('operational_asset_id', $asset->id)->first();
        expect($workOrder)->not()->toBeNull()
            ->and($workOrder->dispatch_blocking)->toBeTrue()
            ->and($workOrder->defect)->toContain('Anti-Two Block Switch')
            ->and($workOrder->defect)->toContain('Outriggers');
    });

    test('checks with all good status do NOT trigger lockout and asset remains Available', function (): void {
        $operator = User::factory()->create(['is_active' => true]);
        $operator->syncRoles([RoleName::CraneOperator->value]);
        $token = $operator->createToken('Mobile Token')->plainTextToken;

        $asset = OperationalAsset::query()->create([
            'code' => 'CRN-ADV-04',
            'name' => 'Clean Crane',
            'kind' => 'crane',
            'status' => AssetStatus::Available,
        ]);

        $response = $this->withToken($token)
            ->postJson('/api/v1/dvir/inspections', [
                'inspection_type' => 'pre_trip',
                'operational_asset_id' => $asset->id,
                'has_defects' => false,
                'signature_captured' => true,
                'checks' => [
                    ['category' => 'hydraulics', 'label' => 'Pressure Test', 'status' => 'good'],
                    ['category' => 'chassis', 'label' => 'Outrigger Pads', 'status' => 'good'],
                ],
            ]);

        $response->assertCreated();
        expect($asset->refresh()->status)->toBe(AssetStatus::Available);

        $workOrder = MaintenanceWorkOrder::query()->where('operational_asset_id', $asset->id)->first();
        expect($workOrder)->toBeNull();
    });

    test('client-spoofed has_defects=false cannot bypass lockout when critical check is submitted', function (): void {
        $operator = User::factory()->create(['is_active' => true]);
        $operator->syncRoles([RoleName::CraneOperator->value]);
        $token = $operator->createToken('Mobile Token')->plainTextToken;

        $asset = OperationalAsset::query()->create([
            'code' => 'CRN-SPOOF-01',
            'name' => 'Spoof Target Crane',
            'kind' => 'crane',
            'status' => AssetStatus::Available,
        ]);

        // Malicious client explicitly claims has_defects: false, but submits a critical check
        $response = $this->withToken($token)
            ->postJson('/api/v1/dvir/inspections', [
                'inspection_type' => 'pre_trip',
                'operational_asset_id' => $asset->id,
                'has_defects' => false,
                'signature_captured' => true,
                'checks' => [
                    [
                        'category' => 'brakes',
                        'label' => 'Service Brake Air Pressure',
                        'status' => 'critical',
                        'notes' => 'Zero air pressure build-up, total brake failure.',
                    ],
                ],
            ]);

        $response->assertCreated();
        // Server derives has_defects and critical_defects_count, refusing to let spoofed false bypass lockout
        expect($asset->refresh()->status)->toBe(AssetStatus::UnderMaintenance);

        $workOrder = MaintenanceWorkOrder::query()->where('operational_asset_id', $asset->id)->first();
        expect($workOrder)->not()->toBeNull()
            ->and($workOrder->dispatch_blocking)->toBeTrue();
    });

    test('client-spoofed has_defects=false cannot bypass lockout when attention check is submitted', function (): void {
        $operator = User::factory()->create(['is_active' => true]);
        $operator->syncRoles([RoleName::CraneOperator->value]);
        $token = $operator->createToken('Mobile Token')->plainTextToken;

        $asset = OperationalAsset::query()->create([
            'code' => 'CRN-SPOOF-02',
            'name' => 'Spoof Attention Crane',
            'kind' => 'crane',
            'status' => AssetStatus::Available,
        ]);

        $response = $this->withToken($token)
            ->postJson('/api/v1/dvir/inspections', [
                'inspection_type' => 'pre_trip',
                'operational_asset_id' => $asset->id,
                'has_defects' => false,
                'signature_captured' => true,
                'checks' => [
                    [
                        'category' => 'fluids',
                        'label' => 'Coolant Level',
                        'status' => 'attention',
                        'notes' => 'Coolant below minimum reservoir level.',
                    ],
                ],
            ]);

        $response->assertCreated();
        expect($asset->refresh()->status)->toBe(AssetStatus::UnderMaintenance);

        $workOrder = MaintenanceWorkOrder::query()->where('operational_asset_id', $asset->id)->first();
        expect($workOrder)->not()->toBeNull()
            ->and($workOrder->dispatch_blocking)->toBeTrue();
    });

    test('resolves asset by asset_code fallback when operational_asset_id is omitted', function (): void {
        $operator = User::factory()->create(['is_active' => true]);
        $operator->syncRoles([RoleName::CraneOperator->value]);
        $token = $operator->createToken('Mobile Token')->plainTextToken;

        $asset = OperationalAsset::query()->create([
            'code' => 'CRN-FALLBACK-99',
            'name' => 'Fallback Resolved Crane',
            'kind' => 'crane',
            'status' => AssetStatus::Available,
        ]);

        $response = $this->withToken($token)
            ->postJson('/api/v1/dvir/inspections', [
                'inspection_type' => 'pre_trip',
                'asset_code' => 'CRN-FALLBACK-99',
                'has_defects' => true,
                'signature_captured' => true,
                'checks' => [
                    [
                        'category' => 'structural',
                        'label' => 'Outrigger Beam Weld',
                        'status' => 'critical',
                        'notes' => 'Hairline crack on right forward outrigger box.',
                    ],
                ],
            ]);

        $response->assertCreated();
        expect($asset->refresh()->status)->toBe(AssetStatus::UnderMaintenance);

        $workOrder = MaintenanceWorkOrder::query()->where('operational_asset_id', $asset->id)->first();
        expect($workOrder)->not()->toBeNull()
            ->and($workOrder->dispatch_blocking)->toBeTrue();
    });

    test('operational_asset_id takes precedence when mismatched with asset_code', function (): void {
        $operator = User::factory()->create(['is_active' => true]);
        $operator->syncRoles([RoleName::CraneOperator->value]);
        $token = $operator->createToken('Mobile Token')->plainTextToken;

        $targetAsset = OperationalAsset::query()->create([
            'code' => 'CRN-TARGET-ID',
            'name' => 'Target Asset by ID',
            'kind' => 'crane',
            'status' => AssetStatus::Available,
        ]);

        $decoyAsset = OperationalAsset::query()->create([
            'code' => 'CRN-DECOY-CODE',
            'name' => 'Decoy Asset by Code',
            'kind' => 'crane',
            'status' => AssetStatus::Available,
        ]);

        // Submit with targetAsset ID, but decoyAsset code
        $response = $this->withToken($token)
            ->postJson('/api/v1/dvir/inspections', [
                'inspection_type' => 'pre_trip',
                'operational_asset_id' => $targetAsset->id,
                'asset_code' => 'CRN-DECOY-CODE',
                'has_defects' => true,
                'signature_captured' => true,
                'checks' => [
                    [
                        'category' => 'safety',
                        'label' => 'Load Moment Indicator',
                        'status' => 'critical',
                        'notes' => 'LMI system displays error code ERR-404.',
                    ],
                ],
            ]);

        $response->assertCreated();
        // Target asset resolved by ID is locked out
        expect($targetAsset->refresh()->status)->toBe(AssetStatus::UnderMaintenance);
        // Decoy asset remains Available and unaffected
        expect($decoyAsset->refresh()->status)->toBe(AssetStatus::Available);
    });

    test('missing both operational_asset_id and asset_code fails request validation', function (): void {
        $operator = User::factory()->create(['is_active' => true]);
        $operator->syncRoles([RoleName::CraneOperator->value]);
        $token = $operator->createToken('Mobile Token')->plainTextToken;

        $response = $this->withToken($token)
            ->postJson('/api/v1/dvir/inspections', [
                'inspection_type' => 'pre_trip',
                'has_defects' => true,
                'signature_captured' => true,
                'checks' => [
                    [
                        'category' => 'safety',
                        'label' => 'Horn',
                        'status' => 'critical',
                    ],
                ],
            ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['asset_code']);
    });

    test('asset under safety lockout cannot be assigned to dispatch jobs', function (): void {
        $manager = User::factory()->create(['is_active' => true]);
        $manager->syncRoles([RoleName::OperationsManager->value]);

        $job = DispatchJob::query()->create([
            'reference' => 'DSP-LOCKOUT-TEST',
            'client' => 'Highrise Towers Ltd',
            'title' => 'Core Wall Lifting',
            'site' => 'Ortigas Center',
            'status' => DispatchStatus::Scheduled,
            'priority' => DispatchPriority::Routine,
            'scheduled_start' => now()->addHours(2),
            'scheduled_end' => now()->addHours(8),
            'created_by' => $manager->id,
            'version' => 1,
        ]);

        $lockedAsset = OperationalAsset::query()->create([
            'code' => 'CRN-LOCKED-01',
            'name' => 'Grounded Crane',
            'kind' => 'mobile_crane',
            'status' => AssetStatus::UnderMaintenance,
        ]);

        MaintenanceWorkOrder::query()->create([
            'operational_asset_id' => $lockedAsset->id,
            'technician_id' => $manager->id,
            'status' => 'pending',
            'defect' => 'Hydraulic boom cylinder leak',
            'dispatch_blocking' => true,
        ]);

        // 1. Direct service action execution throws ValidationException
        $assignAction = app(AssignDispatchResources::class);
        $caughtException = null;

        try {
            $assignAction->handle(
                actor: $manager,
                job: $job,
                personnel: [],
                assets: [
                    [
                        'operational_asset_id' => $lockedAsset->id,
                        'assignment_type' => 'crane',
                    ],
                ],
            );
        } catch (ValidationException $e) {
            $caughtException = $e;
        }

        expect($caughtException)->not()->toBeNull();
        $assetErrors = $caughtException->errors()['assets'] ?? [];
        expect(implode(' ', $assetErrors))->toContain('cannot be assigned as Crane');

        // 2. HTTP controller endpoint rejects assignment of locked out asset
        $response = $this->actingAs($manager)
            ->post("/operations/dispatch-jobs/{$job->id}/assignments", [
                'assets' => [
                    [
                        'operational_asset_id' => $lockedAsset->id,
                        'assignment_type' => 'crane',
                    ],
                ],
            ]);

        $response->assertSessionHasErrors(['assets']);
    });
});

/*
|--------------------------------------------------------------------------
| Section 2: Managerial Override & Release Verification
|--------------------------------------------------------------------------
*/

describe('Managerial Override & Release Verification', function (): void {
    test('non-authorized role (CraneOperator) is forbidden from triggering override or release', function (): void {
        $operator = User::factory()->create(['is_active' => true]);
        $operator->syncRoles([RoleName::CraneOperator->value]);

        $asset = OperationalAsset::query()->create([
            'code' => 'CRN-AUTH-01',
            'name' => 'Heavy Crane',
            'kind' => 'crane',
            'status' => AssetStatus::UnderMaintenance,
        ]);

        $workOrder = MaintenanceWorkOrder::query()->create([
            'operational_asset_id' => $asset->id,
            'technician_id' => $operator->id,
            'status' => 'pending',
            'defect' => 'Boom leak',
            'dispatch_blocking' => true,
        ]);

        $this->actingAs($operator)
            ->postJson("/operations/maintenance/{$workOrder->id}/release", [
                'work_performed' => ['Replaced seal'],
                'managerial_override' => true,
                'override_reason' => 'Operator unauthorized self-release attempt',
            ])
            ->assertForbidden();
    });

    test('non-authorized role (Rigger) is forbidden from triggering release', function (): void {
        $rigger = User::factory()->create(['is_active' => true]);
        $rigger->syncRoles([RoleName::Rigger->value]);

        $asset = OperationalAsset::query()->create([
            'code' => 'CRN-AUTH-02',
            'name' => 'Heavy Crane',
            'kind' => 'crane',
            'status' => AssetStatus::UnderMaintenance,
        ]);

        $workOrder = MaintenanceWorkOrder::query()->create([
            'operational_asset_id' => $asset->id,
            'technician_id' => $rigger->id,
            'status' => 'pending',
            'defect' => 'Boom leak',
            'dispatch_blocking' => true,
        ]);

        $this->actingAs($rigger)
            ->postJson("/operations/maintenance/{$workOrder->id}/release", [
                'work_performed' => ['Visual check'],
            ])
            ->assertForbidden();
    });

    test('unauthenticated request to release is rejected with 401', function (): void {
        $asset = OperationalAsset::query()->create([
            'code' => 'CRN-GUEST-01',
            'name' => 'Heavy Crane',
            'kind' => 'crane',
            'status' => AssetStatus::UnderMaintenance,
        ]);

        $workOrder = MaintenanceWorkOrder::query()->create([
            'operational_asset_id' => $asset->id,
            'status' => 'pending',
            'defect' => 'Boom leak',
            'dispatch_blocking' => true,
        ]);

        $this->postJson("/operations/maintenance/{$workOrder->id}/release", [
            'work_performed' => ['Visual check'],
        ])->assertUnauthorized();
    });

    test('segregates fleet.maintain vs equipment.maintain permissions strictly by asset kind', function (): void {
        // User with ONLY fleet.maintain
        $fleetTech = User::factory()->create(['is_active' => true]);
        $fleetRole = Role::create(['name' => 'fleet-only', 'guard_name' => 'web']);
        $fleetRole->syncPermissions([PermissionName::FleetMaintain->value]);
        $fleetTech->assignRole($fleetRole);

        // User with ONLY equipment.maintain
        $heavyTech = User::factory()->create(['is_active' => true]);
        $heavyRole = Role::create(['name' => 'heavy-only', 'guard_name' => 'web']);
        $heavyRole->syncPermissions([PermissionName::EquipmentMaintain->value]);
        $heavyTech->assignRole($heavyRole);

        $crane = OperationalAsset::query()->create([
            'code' => 'CRN-SEG-01',
            'name' => 'All Terrain Crane',
            'kind' => 'crane',
            'status' => AssetStatus::UnderMaintenance,
        ]);

        $truck = OperationalAsset::query()->create([
            'code' => 'TRK-SEG-01',
            'name' => 'Prime Mover',
            'kind' => 'truck',
            'status' => AssetStatus::UnderMaintenance,
        ]);

        $craneOrder = MaintenanceWorkOrder::query()->create([
            'operational_asset_id' => $crane->id,
            'status' => 'pending',
            'defect' => 'Hoist wire',
            'dispatch_blocking' => true,
        ]);

        $truckOrder = MaintenanceWorkOrder::query()->create([
            'operational_asset_id' => $truck->id,
            'status' => 'pending',
            'defect' => 'Air brake valve',
            'dispatch_blocking' => true,
        ]);

        // 1. Fleet tech cannot release crane (requires equipment.maintain)
        $this->actingAs($fleetTech)
            ->postJson("/operations/maintenance/{$craneOrder->id}/release", [
                'work_performed' => ['Replaced cable'],
                'managerial_override' => true,
                'override_reason' => 'Fleet tech attempting crane override',
            ])->assertForbidden();

        // 2. Heavy tech cannot release truck (requires fleet.maintain)
        $this->actingAs($heavyTech)
            ->postJson("/operations/maintenance/{$truckOrder->id}/release", [
                'work_performed' => ['Replaced valve'],
                'managerial_override' => true,
                'override_reason' => 'Heavy tech attempting truck override',
            ])->assertForbidden();

        // 3. Fleet tech CAN release truck with override
        $this->actingAs($fleetTech)
            ->postJson("/operations/maintenance/{$truckOrder->id}/release", [
                'work_performed' => ['Replaced valve'],
                'managerial_override' => true,
                'override_reason' => 'Authorized fleet tech override for truck',
            ])->assertOk();

        // 4. Heavy tech CAN release crane with override
        $this->actingAs($heavyTech)
            ->postJson("/operations/maintenance/{$craneOrder->id}/release", [
                'work_performed' => ['Replaced cable'],
                'managerial_override' => true,
                'override_reason' => 'Authorized heavy tech override for crane',
            ])->assertOk();
    });

    test('managerial override rejects missing, empty, whitespace, or null override_reason', function (): void {
        $manager = User::factory()->create(['is_active' => true]);
        $manager->syncRoles([RoleName::OperationsManager->value]);

        $asset = OperationalAsset::query()->create([
            'code' => 'CRN-REASON-01',
            'name' => 'Reason Test Crane',
            'kind' => 'crane',
            'status' => AssetStatus::UnderMaintenance,
        ]);

        $workOrder = MaintenanceWorkOrder::query()->create([
            'operational_asset_id' => $asset->id,
            'technician_id' => $manager->id,
            'status' => 'pending',
            'defect' => 'Loose pin',
            'dispatch_blocking' => true,
        ]);

        // Missing override_reason field
        $this->actingAs($manager)
            ->postJson("/operations/maintenance/{$workOrder->id}/release", [
                'work_performed' => ['Tightened pin'],
                'managerial_override' => true,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['override_reason']);

        // Empty string
        $this->actingAs($manager)
            ->postJson("/operations/maintenance/{$workOrder->id}/release", [
                'work_performed' => ['Tightened pin'],
                'managerial_override' => true,
                'override_reason' => '',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['override_reason']);

        // Whitespace only
        $this->actingAs($manager)
            ->postJson("/operations/maintenance/{$workOrder->id}/release", [
                'work_performed' => ['Tightened pin'],
                'managerial_override' => true,
                'override_reason' => '     ',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['override_reason']);

        // Null
        $this->actingAs($manager)
            ->postJson("/operations/maintenance/{$workOrder->id}/release", [
                'work_performed' => ['Tightened pin'],
                'managerial_override' => true,
                'override_reason' => null,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['override_reason']);
    });

    test('releasing blocking work order without passing inspection or override fails validation', function (): void {
        $manager = User::factory()->create(['is_active' => true]);
        $manager->syncRoles([RoleName::OperationsManager->value]);

        $asset = OperationalAsset::query()->create([
            'code' => 'CRN-NOINSP-01',
            'name' => 'No Inspection Crane',
            'kind' => 'crane',
            'status' => AssetStatus::UnderMaintenance,
        ]);

        $workOrder = MaintenanceWorkOrder::query()->create([
            'operational_asset_id' => $asset->id,
            'technician_id' => $manager->id,
            'status' => 'pending',
            'defect' => 'Hydraulic seal blown',
            'dispatch_blocking' => true,
            'created_at' => now()->subHours(2),
        ]);

        // Case 1: No inspection records exist at all
        $this->actingAs($manager)
            ->postJson("/operations/maintenance/{$workOrder->id}/release", [
                'work_performed' => ['Replaced hydraulic cylinder seal kit'],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['inspection']);

        // Case 2: Stale DVIR inspection completed BEFORE the work order was created
        $staleDvir = DvirInspection::query()->create([
            'user_id' => $manager->id,
            'operational_asset_id' => $asset->id,
            'inspection_type' => DvirInspectionType::PRE_TRIP,
            'has_defects' => false,
            'critical_defects_count' => 0,
            'completed_at' => now()->subHours(3), // 1 hour prior to workOrder created_at
        ]);

        $this->actingAs($manager)
            ->postJson("/operations/maintenance/{$workOrder->id}/release", [
                'work_performed' => ['Replaced hydraulic cylinder seal kit'],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['inspection']);

        // Case 3: Post-repair DVIR inspection completed AFTER work order, but has defects flagged
        $failingDvir = DvirInspection::query()->create([
            'user_id' => $manager->id,
            'operational_asset_id' => $asset->id,
            'inspection_type' => DvirInspectionType::POST_TRIP,
            'has_defects' => true,
            'critical_defects_count' => 0,
            'completed_at' => now()->subMinutes(10),
        ]);

        $this->actingAs($manager)
            ->postJson("/operations/maintenance/{$workOrder->id}/release", [
                'work_performed' => ['Replaced hydraulic cylinder seal kit'],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['inspection']);

        // Case 4: Legacy inspection with completed_at null (still in progress)
        $incompleteInspection = $asset->inspections()->create([
            'technician_id' => $manager->id,
            'type' => 'post_repair',
            'result' => 'passed',
            'checklist' => ['brakes' => 'pass'],
            'completed_at' => null,
        ]);

        $this->actingAs($manager)
            ->postJson("/operations/maintenance/{$workOrder->id}/release", [
                'work_performed' => ['Replaced hydraulic cylinder seal kit'],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['inspection']);

        // Case 5: Post-repair DVIR with critical_defects_count > 0
        $criticalDvir = DvirInspection::query()->create([
            'user_id' => $manager->id,
            'operational_asset_id' => $asset->id,
            'inspection_type' => DvirInspectionType::POST_TRIP,
            'has_defects' => false, // even if has_defects is claimed false, critical count > 0 blocks release
            'critical_defects_count' => 1,
            'completed_at' => now()->subMinutes(5),
        ]);

        $this->actingAs($manager)
            ->postJson("/operations/maintenance/{$workOrder->id}/release", [
                'work_performed' => ['Replaced hydraulic cylinder seal kit'],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['inspection']);
    });

    test('multiple blocking work orders: releasing one keeps asset in UnderMaintenance until all are released', function (): void {
        $manager = User::factory()->create(['is_active' => true]);
        $manager->syncRoles([RoleName::OperationsManager->value]);

        $asset = OperationalAsset::query()->create([
            'code' => 'CRN-MULTI-WO',
            'name' => 'Multi Work Order Crane',
            'kind' => 'crane',
            'status' => AssetStatus::UnderMaintenance,
        ]);

        $workOrder1 = MaintenanceWorkOrder::query()->create([
            'operational_asset_id' => $asset->id,
            'technician_id' => $manager->id,
            'status' => 'pending',
            'defect' => 'Defect A: Hook latch spring broken',
            'dispatch_blocking' => true,
            'created_at' => now()->subHours(2),
        ]);

        $workOrder2 = MaintenanceWorkOrder::query()->create([
            'operational_asset_id' => $asset->id,
            'technician_id' => $manager->id,
            'status' => 'pending',
            'defect' => 'Defect B: Boom tip sheave bearing seized',
            'dispatch_blocking' => true,
            'created_at' => now()->subHour(),
        ]);

        // Release Work Order 1 via override
        $this->actingAs($manager)
            ->postJson("/operations/maintenance/{$workOrder1->id}/release", [
                'work_performed' => ['Replaced latch spring'],
                'managerial_override' => true,
                'override_reason' => 'Verified latch replacement in yard.',
            ])->assertOk();

        expect($workOrder1->refresh()->released_at)->not()->toBeNull()
            ->and($workOrder1->dispatch_blocking)->toBeFalse();

        // Asset MUST remain UnderMaintenance because Work Order 2 is still blocking!
        expect($asset->refresh()->status)->toBe(AssetStatus::UnderMaintenance);

        // Now release Work Order 2 via override
        $this->actingAs($manager)
            ->postJson("/operations/maintenance/{$workOrder2->id}/release", [
                'work_performed' => ['Replaced sheave bearing and greased'],
                'managerial_override' => true,
                'override_reason' => 'Sheave bearing replaced and load tested.',
            ])->assertOk();

        expect($workOrder2->refresh()->released_at)->not()->toBeNull()
            ->and($workOrder2->dispatch_blocking)->toBeFalse();

        // Now that ALL blocking work orders are released, asset transitions to ReadyForService
        expect($asset->refresh()->status)->toBe(AssetStatus::ReadyForService);
    });
});

/*
|--------------------------------------------------------------------------
| Section 3: Eager Loading & N+1 Scalability Harness
|--------------------------------------------------------------------------
*/

describe('Eager Loading & N+1 Scalability Harness', function (): void {
    test('fetchAssetsWithTotal executes constant O(1) database queries regardless of asset fleet count', function (): void {
        $manager = User::factory()->create(['is_active' => true]);
        $manager->syncRoles([RoleName::OperationsManager->value]);

        $controller = app(OperationsWorkspaceController::class);
        $fetchMethod = new ReflectionMethod($controller, 'fetchAssetsWithTotal');
        $fetchMethod->setAccessible(true);

        // Helper to seed N complete operational assets with all relations
        $seedAssets = function (int $count, string $prefix) use ($manager): void {
            for ($i = 1; $i <= $count; $i++) {
                $asset = OperationalAsset::query()->create([
                    'code' => "{$prefix}-".sprintf('%03d', $i),
                    'name' => "Fleet Crane {$i}",
                    'kind' => 'mobile_crane',
                    'status' => AssetStatus::Available,
                ]);

                $shift = OperatorShift::query()->create([
                    'user_id' => $manager->id,
                    'operational_asset_id' => $asset->id,
                    'status' => ShiftStatus::ACTIVE,
                    'started_at' => now()->subHours(3),
                ]);

                OperatorDutyLog::query()->create([
                    'user_id' => $manager->id,
                    'operator_shift_id' => $shift->id,
                    'duty_status' => DutyStatus::OPERATING,
                    'started_at' => now()->subHours(3),
                ]);

                $dvir = DvirInspection::query()->create([
                    'user_id' => $manager->id,
                    'operational_asset_id' => $asset->id,
                    'inspection_type' => DvirInspectionType::PRE_TRIP,
                    'completed_at' => now()->subMinutes(45),
                    'has_defects' => false,
                    'signature_captured' => true,
                ]);

                DvirInspectionPhoto::query()->create([
                    'dvir_inspection_id' => $dvir->id,
                    'angle' => 'front',
                    'storage_disk' => 'public',
                    'file_path' => "dvir_photos/{$dvir->id}/front.jpg",
                ]);

                MaintenanceWorkOrder::query()->create([
                    'operational_asset_id' => $asset->id,
                    'technician_id' => $manager->id,
                    'status' => 'pending',
                    'defect' => 'Routine 500-hour service check',
                    'dispatch_blocking' => false,
                ]);
            }
        };

        // 1. Warm up permissions / Spatie cache before measurement
        $fetchMethod->invoke($controller, $manager, 1);

        // 2. Benchmark small batch (5 assets)
        $seedAssets(5, 'SET-A');
        DB::flushQueryLog();
        DB::enableQueryLog();

        [$assetsSmall, $totalSmall] = $fetchMethod->invoke($controller, $manager, 5);
        $queriesSmall = DB::getQueryLog();
        $queryCountSmall = count($queriesSmall);

        expect($totalSmall)->toBe(5)
            ->and($assetsSmall)->toHaveCount(5);

        // 3. Benchmark larger batch (additional 45 assets -> 50 total)
        $seedAssets(45, 'SET-B');
        DB::flushQueryLog();
        DB::enableQueryLog();

        [$assetsLarge, $totalLarge] = $fetchMethod->invoke($controller, $manager, 50);
        $queriesLarge = DB::getQueryLog();
        $queryCountLarge = count($queriesLarge);

        expect($totalLarge)->toBe(50)
            ->and($assetsLarge)->toHaveCount(50);

        // Strict empirical proof: query count MUST BE FLAT and NOT scale with N
        // If there was an N+1 bug (e.g. 1 query per asset), queryCountLarge would be queryCountSmall + 45
        expect($queryCountLarge)->toBe($queryCountSmall);

        // 3. Verify that passing the 50 assets through ViewModel serialization triggers ZERO extra queries
        DB::flushQueryLog();
        DB::enableQueryLog();

        $serialized = OperationsWorkspaceViewModel::assets($assetsLarge);
        $queriesViewModel = DB::getQueryLog();

        expect($queriesViewModel)->toBeEmpty()
            ->and($serialized)->toHaveCount(50);
    });

    test('fetchJobReports executes constant O(1) queries regardless of job report count', function (): void {
        $manager = User::factory()->create(['is_active' => true]);
        $manager->syncRoles([RoleName::OperationsManager->value]);

        $controller = app(OperationsWorkspaceController::class);
        $fetchMethod = new ReflectionMethod($controller, 'fetchJobReports');
        $fetchMethod->setAccessible(true);

        $seedReports = function (int $count, string $prefix) use ($manager): void {
            for ($i = 1; $i <= $count; $i++) {
                $job = DispatchJob::query()->create([
                    'reference' => "{$prefix}-JOB-".sprintf('%03d', $i),
                    'client' => 'Client Corp',
                    'title' => "Erection {$i}",
                    'site' => 'Site Yard',
                    'status' => DispatchStatus::Working,
                    'priority' => DispatchPriority::Routine,
                    'scheduled_start' => now()->subHours(2),
                    'scheduled_end' => now()->addHours(4),
                    'created_by' => $manager->id,
                    'version' => 1,
                ]);

                $asset = OperationalAsset::query()->create([
                    'code' => "{$prefix}-CRN-".sprintf('%03d', $i),
                    'name' => "Crane {$i}",
                    'kind' => 'mobile_crane',
                    'status' => AssetStatus::Working,
                ]);

                $shift = OperatorShift::query()->create([
                    'user_id' => $manager->id,
                    'operational_asset_id' => $asset->id,
                    'dispatch_job_id' => $job->id,
                    'status' => ShiftStatus::ACTIVE,
                    'started_at' => now()->subHours(2),
                ]);

                OperatorDutyLog::query()->create([
                    'user_id' => $manager->id,
                    'operator_shift_id' => $shift->id,
                    'duty_status' => DutyStatus::STANDBY,
                    'standby_reason' => StandbyReason::WAITING_ON_CLIENT,
                    'is_demurrage_billable' => true,
                    'duration_minutes' => 30,
                    'started_at' => now()->subHour(),
                ]);

                DvirInspection::query()->create([
                    'user_id' => $manager->id,
                    'operational_asset_id' => $asset->id,
                    'dispatch_job_id' => $job->id,
                    'inspection_type' => DvirInspectionType::PRE_TRIP,
                    'completed_at' => now()->subHours(2),
                    'has_defects' => false,
                    'critical_defects_count' => 0,
                    'signature_captured' => true,
                ]);

                FuelRequest::query()->create([
                    'dispatch_job_id' => $job->id,
                    'operator_shift_id' => $shift->id,
                    'requester_id' => $manager->id,
                    'reference' => "{$prefix}-FUEL-".sprintf('%03d', $i),
                    'quantity_litres' => 50.0,
                    'fuel_type' => 'diesel',
                    'purpose' => 'Lifting',
                    'status' => FuelRequestStatus::Submitted,
                ]);

                JobReport::query()->create([
                    'dispatch_job_id' => $job->id,
                    'author_id' => $manager->id,
                    'work_summary' => "Completed lift operation {$i}",
                    'status' => JobReportStatus::Submitted,
                    'signer_name' => 'Site Quality Inspector',
                    'signer_role' => 'Client QA',
                    'signed_at' => now(),
                    'submitted_at' => now()->subMinutes($i),
                ]);
            }
        };

        // 1. Warm up permissions / Spatie cache before measurement
        $fetchMethod->invoke($controller, $manager);

        // 2. Small batch (5 reports)
        $seedReports(5, 'REP-A');
        DB::flushQueryLog();
        DB::enableQueryLog();

        $reportsSmall = $fetchMethod->invoke($controller, $manager);
        $queriesSmall = DB::getQueryLog();
        $queryCountSmall = count($queriesSmall);

        expect($reportsSmall)->toHaveCount(5);

        // 3. Larger batch (additional 35 reports -> 40 total)
        $seedReports(35, 'REP-B');
        DB::flushQueryLog();
        DB::enableQueryLog();

        $reportsLarge = $fetchMethod->invoke($controller, $manager);
        $queriesLarge = DB::getQueryLog();
        $queryCountLarge = count($queriesLarge);

        expect($reportsLarge)->toHaveCount(40);

        // Query count for fetching reports must be flat O(1)
        expect($queryCountLarge)->toBe($queryCountSmall);

        // 3. Serialization of 40 reports via ViewModel
        // Runs exactly 1 batch query for delay logs across all unique job IDs, with ZERO per-report N+1 queries
        DB::flushQueryLog();
        DB::enableQueryLog();

        $serialized = OperationsWorkspaceViewModel::jobReports($reportsLarge);
        $queriesViewModel = DB::getQueryLog();

        // Must be exactly 2 batch queries (1 for OperatorDutyLog, 1 for eager-loaded shift:id,dispatch_job_id)
        // Completely flat O(1) query count regardless of 5 vs 40 vs 100 job reports!
        expect(count($queriesViewModel))->toBe(2)
            ->and($serialized)->toHaveCount(40);
    });
});
