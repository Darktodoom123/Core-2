<?php

use App\Modules\Dvir\Models\DvirInspection;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

function dvirPayload(array $overrides = []): array
{
    return array_merge([
        'inspection_type' => 'pre_trip',
        'asset_code' => 'ALB-CRN-050',
        'asset_name' => '50T Tadano All-Terrain Crane',
        'starting_odometer_km' => 42150,
        'engine_hours' => 1842.5,
        'has_defects' => false,
        'signature_captured' => true,
        'remarks' => 'Pre-trip walkaround completed. Safe to operate.',
        'checks' => [
            [
                'id' => 'check-brakes',
                'category' => 'brakes_suspension',
                'label' => 'Service brake response',
                'status' => 'good',
            ],
        ],
    ], $overrides);
}

it('requires authentication to access dvir inspections', function (): void {
    $this->getJson('/api/v1/dvir/inspections')->assertUnauthorized();
    $this->postJson('/api/v1/dvir/inspections', dvirPayload())->assertUnauthorized();
});

it('rejects inactive users', function (): void {
    /** @var User $user */
    $user = User::factory()->create(['is_active' => false]);
    $token = $user->createToken('Mobile Token')->plainTextToken;

    $this->withToken($token)
        ->postJson('/api/v1/dvir/inspections', dvirPayload())
        ->assertForbidden();
});

it('stores a completed dvir inspection with its checks', function (): void {
    /** @var User $operator */
    $operator = User::factory()->create(['is_active' => true]);
    $token = $operator->createToken('Mobile Token')->plainTextToken;

    $response = $this->withToken($token)
        ->postJson('/api/v1/dvir/inspections', dvirPayload([
            'checks' => [
                [
                    'category' => 'brakes_suspension',
                    'label' => 'Service brake response',
                    'status' => 'good',
                ],
                [
                    'id' => 'defect-outrigger-1',
                    'category' => 'mobile_crane_outriggers',
                    'label' => 'Left rear outrigger pad cracked',
                    'status' => 'critical',
                    'notes' => 'Do not operate until replaced.',
                ],
                [
                    'category' => 'in_cab_controls',
                    'label' => 'Load moment indicator warning',
                    'status' => 'attention',
                ],
            ],
        ]));

    $response->assertCreated()
        ->assertJsonPath('data.type', 'pre_trip')
        ->assertJsonPath('data.asset_code', 'ALB-CRN-050')
        ->assertJsonPath('data.inspector_name', $operator->name)
        ->assertJsonPath('data.has_defects', true)
        ->assertJsonPath('data.critical_defects_count', 1)
        ->assertJsonCount(3, 'data.checks');

    $this->assertDatabaseHas('dvir_inspections', [
        'user_id' => $operator->id,
        'inspection_type' => 'pre_trip',
        'asset_code' => 'ALB-CRN-050',
        'has_defects' => true,
        'critical_defects_count' => 1,
        'signature_captured' => true,
    ]);

    $this->assertDatabaseHas('dvir_inspection_checks', [
        'external_id' => 'defect-outrigger-1',
        'category' => 'mobile_crane_outriggers',
        'status' => 'critical',
        'sort_order' => 1,
    ]);
});

it('snapshots asset identifiers from the operational asset record', function (): void {
    /** @var User $operator */
    $operator = User::factory()->create(['is_active' => true]);
    $token = $operator->createToken('Mobile Token')->plainTextToken;

    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-SNAPSHOT-01',
        'name' => '80T Grove Crane',
        'kind' => 'crane',
        'status' => 'available',
    ]);

    $response = $this->withToken($token)
        ->postJson('/api/v1/dvir/inspections', dvirPayload([
            'operational_asset_id' => $asset->id,
            'asset_code' => 'SPOOFED-CODE',
        ]));

    $response->assertCreated()
        ->assertJsonPath('data.operational_asset_id', $asset->id)
        ->assertJsonPath('data.asset_code', 'CRN-SNAPSHOT-01')
        ->assertJsonPath('data.asset_name', '80T Grove Crane');
});

it('requires an asset code when no operational asset is provided', function (): void {
    /** @var User $operator */
    $operator = User::factory()->create(['is_active' => true]);
    $token = $operator->createToken('Mobile Token')->plainTextToken;

    $this->withToken($token)
        ->postJson('/api/v1/dvir/inspections', dvirPayload(['asset_code' => null]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['asset_code']);
});

it('validates inspection type and check statuses', function (): void {
    /** @var User $operator */
    $operator = User::factory()->create(['is_active' => true]);
    $token = $operator->createToken('Mobile Token')->plainTextToken;

    $this->withToken($token)
        ->postJson('/api/v1/dvir/inspections', dvirPayload(['inspection_type' => 'annual_audit']))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['inspection_type']);

    $this->withToken($token)
        ->postJson('/api/v1/dvir/inspections', dvirPayload([
            'checks' => [
                [
                    'category' => 'brakes_suspension',
                    'label' => 'Service brake response',
                    'status' => 'totally_fine',
                ],
            ],
        ]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['checks.0.status']);
});

it('lists only the authenticated operator dvir history newest first', function (): void {
    /** @var User $operator */
    $operator = User::factory()->create(['is_active' => true]);
    /** @var User $other */
    $other = User::factory()->create(['is_active' => true]);

    DvirInspection::query()->create([
        'user_id' => $operator->id,
        'inspection_type' => 'pre_trip',
        'asset_code' => 'ALB-CRN-050',
        'has_defects' => false,
        'signature_captured' => true,
        'completed_at' => now()->subDays(2),
    ]);

    DvirInspection::query()->create([
        'user_id' => $operator->id,
        'inspection_type' => 'post_trip',
        'asset_code' => 'ALB-CRN-050',
        'has_defects' => true,
        'critical_defects_count' => 1,
        'signature_captured' => true,
        'completed_at' => now()->subHours(3),
    ]);

    DvirInspection::query()->create([
        'user_id' => $other->id,
        'inspection_type' => 'pre_trip',
        'asset_code' => 'OTHER-CRN-001',
        'has_defects' => false,
        'signature_captured' => true,
        'completed_at' => now()->subHour(),
    ]);

    $token = $operator->createToken('Mobile Token')->plainTextToken;

    $response = $this->withToken($token)
        ->getJson('/api/v1/dvir/inspections')
        ->assertOk()
        ->assertJsonCount(2, 'data.inspections')
        ->assertJsonPath('data.inspections.0.type', 'post_trip')
        ->assertJsonPath('data.inspections.1.type', 'pre_trip');

    expect(collect($response->json('data.inspections'))->pluck('asset_code')->all())
        ->not->toContain('OTHER-CRN-001');
});

it('filters history by operational asset and days window', function (): void {
    /** @var User $operator */
    $operator = User::factory()->create(['is_active' => true]);
    $token = $operator->createToken('Mobile Token')->plainTextToken;

    $crane = OperationalAsset::query()->create([
        'code' => 'CRN-FILTER-01',
        'name' => 'Filtered Crane',
        'kind' => 'crane',
        'status' => 'available',
    ]);

    DvirInspection::query()->create([
        'user_id' => $operator->id,
        'inspection_type' => 'pre_trip',
        'operational_asset_id' => $crane->id,
        'asset_code' => $crane->code,
        'has_defects' => false,
        'signature_captured' => true,
        'completed_at' => now()->subDays(1),
    ]);

    DvirInspection::query()->create([
        'user_id' => $operator->id,
        'inspection_type' => 'pre_trip',
        'asset_code' => 'ALB-CRN-050',
        'has_defects' => false,
        'signature_captured' => true,
        'completed_at' => now()->subDays(1),
    ]);

    DvirInspection::query()->create([
        'user_id' => $operator->id,
        'inspection_type' => 'pre_trip',
        'operational_asset_id' => $crane->id,
        'asset_code' => $crane->code,
        'has_defects' => false,
        'signature_captured' => true,
        'completed_at' => now()->subDays(90),
    ]);

    $this->withToken($token)
        ->getJson("/api/v1/dvir/inspections?operational_asset_id={$crane->id}&days=30")
        ->assertOk()
        ->assertJsonCount(1, 'data.inspections')
        ->assertJsonPath('data.inspections.0.asset_code', 'CRN-FILTER-01');
});

it('shows an inspection to its owner', function (): void {
    /** @var User $owner */
    $owner = User::factory()->create(['is_active' => true]);

    $record = DvirInspection::query()->create([
        'user_id' => $owner->id,
        'inspection_type' => 'post_trip',
        'asset_code' => 'ALB-CRN-050',
        'has_defects' => false,
        'signature_captured' => true,
        'completed_at' => now(),
    ]);

    $ownerToken = $owner->createToken('Mobile Token')->plainTextToken;

    $this->withToken($ownerToken)
        ->getJson("/api/v1/dvir/inspections/{$record->id}")
        ->assertOk()
        ->assertJsonPath('data.internal_id', $record->id)
        ->assertJsonPath('data.type', 'post_trip');
});

it('hides another operator inspection from the show endpoint', function (): void {
    /** @var User $owner */
    $owner = User::factory()->create(['is_active' => true]);
    /** @var User $intruder */
    $intruder = User::factory()->create(['is_active' => true]);

    $record = DvirInspection::query()->create([
        'user_id' => $owner->id,
        'inspection_type' => 'post_trip',
        'asset_code' => 'ALB-CRN-050',
        'has_defects' => false,
        'signature_captured' => true,
        'completed_at' => now(),
    ]);

    $intruderToken = $intruder->createToken('Mobile Token')->plainTextToken;

    $this->withToken($intruderToken)
        ->getJson("/api/v1/dvir/inspections/{$record->id}")
        ->assertNotFound();
});
