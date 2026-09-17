<?php

use App\Modules\Dvir\Models\DvirInspection;
use App\Modules\HoursOfService\Enums\ShiftStatus;
use App\Modules\HoursOfService\Models\OperatorShift;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\MaintenanceWorkOrder;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('verifies operational asset relationships to dvir inspections, active shift, and blocking work orders', function (): void {
    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-REL-01',
        'name' => '50T Tadano Crane',
        'kind' => 'crane',
        'status' => AssetStatus::Available,
    ]);

    $user = User::factory()->create(['is_active' => true]);

    // Create past completed shift
    OperatorShift::query()->create([
        'user_id' => $user->id,
        'operational_asset_id' => $asset->id,
        'status' => ShiftStatus::COMPLETED,
        'started_at' => now()->subHours(10),
        'ended_at' => now()->subHours(2),
    ]);

    // Create active shift
    $activeShift = OperatorShift::query()->create([
        'user_id' => $user->id,
        'operational_asset_id' => $asset->id,
        'status' => ShiftStatus::ACTIVE,
        'started_at' => now()->subHour(),
    ]);

    // Create older completed DVIR
    DvirInspection::query()->create([
        'user_id' => $user->id,
        'operational_asset_id' => $asset->id,
        'inspection_type' => 'pre_trip',
        'has_defects' => false,
        'completed_at' => now()->subHours(3),
    ]);

    // Create latest completed DVIR
    $latestDvir = DvirInspection::query()->create([
        'user_id' => $user->id,
        'operational_asset_id' => $asset->id,
        'inspection_type' => 'post_trip',
        'has_defects' => false,
        'completed_at' => now()->subMinutes(10),
    ]);

    // Create non-blocking work order
    MaintenanceWorkOrder::query()->create([
        'operational_asset_id' => $asset->id,
        'technician_id' => $user->id,
        'status' => 'pending',
        'defect' => 'Wiper blade replacement',
        'dispatch_blocking' => false,
    ]);

    // Create active blocking work order
    $blockingOrder = MaintenanceWorkOrder::query()->create([
        'operational_asset_id' => $asset->id,
        'technician_id' => $user->id,
        'status' => 'pending',
        'defect' => 'Hydraulic line rupture',
        'dispatch_blocking' => true,
    ]);

    expect($asset->dvirInspections)->toHaveCount(2)
        ->and($asset->latestDvirInspection?->id)->toBe($latestDvir->id)
        ->and($asset->activeOperatorShift?->id)->toBe($activeShift->id)
        ->and($asset->activeBlockingWorkOrder?->id)->toBe($blockingOrder->id);
});

it('automatically locks asset to UnderMaintenance and creates dispatch-blocking work order on critical DVIR defects', function (): void {
    $operator = User::factory()->create(['is_active' => true]);
    $token = $operator->createToken('Mobile Token')->plainTextToken;

    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-LOCK-01',
        'name' => '80T Demag Crane',
        'kind' => 'crane',
        'status' => AssetStatus::Available,
    ]);

    $response = $this->withToken($token)
        ->postJson('/api/v1/dvir/inspections', [
            'inspection_type' => 'pre_trip',
            'operational_asset_id' => $asset->id,
            'has_defects' => true,
            'signature_captured' => true,
            'remarks' => 'Outrigger cylinder leaking hydraulic fluid.',
            'checks' => [
                [
                    'category' => 'hydraulics',
                    'label' => 'Outrigger Jack Cylinder',
                    'status' => 'critical',
                    'notes' => 'Severe fluid pressure drop, risk of collapse.',
                ],
                [
                    'category' => 'electrical',
                    'label' => 'Beacon Light',
                    'status' => 'good',
                ],
            ],
        ]);

    $response->assertCreated();

    // Verify asset transitioned to UnderMaintenance
    expect($asset->refresh()->status)->toBe(AssetStatus::UnderMaintenance);

    // Verify dispatch-blocking MaintenanceWorkOrder created
    $workOrder = MaintenanceWorkOrder::query()->where('operational_asset_id', $asset->id)->first();
    expect($workOrder)->not->toBeNull();
    expect($workOrder?->dispatch_blocking)->toBeTrue();
    expect($workOrder?->status)->toBe('pending');
    expect($workOrder?->defect)->toContain('Outrigger Jack Cylinder');
    expect($workOrder?->defect)->toContain('Severe fluid pressure drop');

    // Verify AuditEvents logged
    $this->assertDatabaseHas('audit_events', [
        'subject_type' => $asset->getMorphClass(),
        'subject_id' => (string) $asset->id,
        'action' => 'asset.safety_lockout_dvir',
    ]);

    $this->assertDatabaseHas('audit_events', [
        'subject_type' => $workOrder?->getMorphClass(),
        'subject_id' => (string) $workOrder?->id,
        'action' => 'maintenance.opened',
    ]);
});

it('resolves asset by asset_code fallback and triggers lockout when operational_asset_id is missing', function (): void {
    $operator = User::factory()->create(['is_active' => true]);
    $token = $operator->createToken('Mobile Token')->plainTextToken;

    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-RESOLVE-01',
        'name' => '100T Grove Crane',
        'kind' => 'crane',
        'status' => AssetStatus::Available,
    ]);

    $response = $this->withToken($token)
        ->postJson('/api/v1/dvir/inspections', [
            'inspection_type' => 'pre_trip',
            'asset_code' => 'CRN-RESOLVE-01',
            'has_defects' => true,
            'signature_captured' => true,
            'remarks' => 'Boom hoist cable frayed.',
            'checks' => [
                [
                    'category' => 'cables',
                    'label' => 'Main Hoist Cable',
                    'status' => 'critical',
                    'notes' => 'Multiple broken cable strands.',
                ],
            ],
        ]);

    $response->assertCreated();
    expect($asset->refresh()->status)->toBe(AssetStatus::UnderMaintenance);

    $workOrder = MaintenanceWorkOrder::query()->where('operational_asset_id', $asset->id)->first();
    expect($workOrder)->not->toBeNull();
    expect($workOrder?->dispatch_blocking)->toBeTrue();
});

it('triggers lockout when inspection contains an attention check', function (): void {
    $operator = User::factory()->create(['is_active' => true]);
    $token = $operator->createToken('Mobile Token')->plainTextToken;

    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-ATTN-01',
        'name' => 'Tadano GT-550E',
        'kind' => 'crane',
        'status' => AssetStatus::Available,
    ]);

    $this->withToken($token)
        ->postJson('/api/v1/dvir/inspections', [
            'inspection_type' => 'pre_trip',
            'operational_asset_id' => $asset->id,
            'has_defects' => true,
            'signature_captured' => true,
            'checks' => [
                [
                    'category' => 'tires_tracks',
                    'label' => 'Steering Axle Tire Tread',
                    'status' => 'attention',
                    'notes' => 'Tread depth worn near regulatory minimum.',
                ],
            ],
        ])->assertCreated();

    expect($asset->refresh()->status)->toBe(AssetStatus::UnderMaintenance);
    $workOrder = MaintenanceWorkOrder::query()->where('operational_asset_id', $asset->id)->first();
    expect($workOrder?->dispatch_blocking)->toBeTrue();
});

it('releases lockout and restores asset to ReadyForService after a post-repair passing DVIR inspection', function (): void {
    $manager = User::factory()->create(['is_active' => true]);
    $manager->syncRoles([RoleName::OperationsManager->value]);

    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-POST-REP',
        'name' => 'Liebherr LTM 1100',
        'kind' => 'crane',
        'status' => AssetStatus::UnderMaintenance,
    ]);

    $workOrder = MaintenanceWorkOrder::query()->create([
        'operational_asset_id' => $asset->id,
        'technician_id' => $manager->id,
        'status' => 'pending',
        'defect' => 'Brake pad wear',
        'dispatch_blocking' => true,
        'created_at' => now()->subHour(),
    ]);

    // Release before passing inspection fails with 422
    $this->actingAs($manager)->postJson("/operations/maintenance/{$workOrder->id}/release", [
        'work_performed' => ['Replaced brake pads'],
    ])->assertUnprocessable()->assertJsonValidationErrors(['inspection']);

    // Complete repair
    $this->actingAs($manager)->postJson("/operations/maintenance/{$workOrder->id}/complete", [
        'work_performed' => ['Replaced brake pads'],
    ])->assertOk();

    // Submit post-repair passing DVIR inspection
    DvirInspection::query()->create([
        'user_id' => $manager->id,
        'operational_asset_id' => $asset->id,
        'inspection_type' => 'post_trip',
        'has_defects' => false,
        'critical_defects_count' => 0,
        'completed_at' => now(),
    ]);

    // Release after passing DVIR inspection succeeds
    $this->actingAs($manager)->postJson("/operations/maintenance/{$workOrder->id}/release", [
        'work_performed' => ['Replaced brake pads and tested calipers'],
        'parts' => ['BP-500'],
    ])->assertOk();

    expect($workOrder->refresh()->released_at)->not->toBeNull();
    expect($workOrder->dispatch_blocking)->toBeFalse();
    expect($asset->refresh()->status)->toBe(AssetStatus::ReadyForService);

    $this->assertDatabaseHas('audit_events', [
        'action' => 'maintenance.released',
        'subject_id' => (string) $workOrder->id,
    ]);
});

it('allows authorized operations manager to clear lockout via managerial override', function (): void {
    $manager = User::factory()->create(['is_active' => true]);
    $manager->syncRoles([RoleName::OperationsManager->value]);

    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-OVERRIDE',
        'name' => 'Kato 25T City Crane',
        'kind' => 'crane',
        'status' => AssetStatus::UnderMaintenance,
    ]);

    $workOrder = MaintenanceWorkOrder::query()->create([
        'operational_asset_id' => $asset->id,
        'technician_id' => $manager->id,
        'status' => 'pending',
        'defect' => 'Minor beacon wire loose',
        'dispatch_blocking' => true,
        'created_at' => now()->subMinutes(30),
    ]);

    // Managerial override requires reason if managerial_override is true
    $this->actingAs($manager)->postJson("/operations/maintenance/{$workOrder->id}/release", [
        'work_performed' => ['Temporary tie-down of beacon harness'],
        'managerial_override' => true,
        'override_reason' => '',
    ])->assertUnprocessable()->assertJsonValidationErrors(['override_reason']);

    // Managerial override with reason successfully waives inspection requirement
    $this->actingAs($manager)->postJson("/operations/maintenance/{$workOrder->id}/release", [
        'work_performed' => ['Temporary tie-down of beacon harness'],
        'managerial_override' => true,
        'override_reason' => 'Emergency daylight mobilization approved by Fleet Director.',
    ])->assertOk();

    expect($workOrder->refresh()->released_at)->not->toBeNull();
    expect($workOrder->dispatch_blocking)->toBeFalse();
    expect($asset->refresh()->status)->toBe(AssetStatus::ReadyForService);

    $this->assertDatabaseHas('audit_events', [
        'action' => 'maintenance.released',
        'subject_id' => (string) $workOrder->id,
    ]);
});
