<?php

use App\Modules\Dvir\Enums\DvirCheckStatus;
use App\Modules\Dvir\Enums\DvirInspectionType;
use App\Modules\Dvir\Models\DvirInspection;
use App\Modules\Dvir\Models\DvirInspectionCheck;
use App\Modules\Dvir\Models\DvirInspectionPhoto;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('returns authoritative paginated dvir history with receipt metadata and filters', function (): void {
    $manager = User::factory()->create(['name' => 'Fleet Operations Manager']);
    $manager->syncRoles([RoleName::OperationsManager->value]);

    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-DVIR-HISTORY-01',
        'name' => 'History Test Crane',
        'kind' => 'mobile_crane',
        'status' => AssetStatus::Available,
    ]);

    $records = collect();

    for ($index = 0; $index < 17; $index++) {
        $isCritical = $index === 2;
        $inspection = DvirInspection::query()->create([
            'user_id' => $manager->id,
            'operational_asset_id' => $asset->id,
            'inspection_type' => $index % 2 === 0 ? DvirInspectionType::PRE_TRIP : DvirInspectionType::POST_TRIP,
            'asset_code' => $asset->code,
            'asset_name' => $asset->name,
            'inspector_name' => $manager->name,
            'completed_at' => now()->subMinutes($index + 1),
            'has_defects' => $isCritical,
            'critical_defects_count' => $isCritical ? 1 : 0,
            'signature_captured' => true,
            'remarks' => $isCritical ? 'Do not operate until the brake line is repaired.' : null,
        ]);

        if ($isCritical) {
            DvirInspectionCheck::query()->create([
                'dvir_inspection_id' => $inspection->id,
                'category' => 'Brakes',
                'label' => 'Service brake response',
                'status' => DvirCheckStatus::CRITICAL,
                'notes' => 'Brake pressure is below the safe threshold.',
                'sort_order' => 1,
            ]);

            DvirInspectionPhoto::query()->create([
                'dvir_inspection_id' => $inspection->id,
                'angle' => 'defect_brake_line',
                'storage_disk' => 'public',
                'file_path' => 'dvir/history/brake-line.jpg',
                'file_name' => 'brake-line.jpg',
                'mime_type' => 'image/jpeg',
            ]);
        }

        $records->push($inspection);
    }

    $firstPage = $this->actingAs($manager)
        ->getJson("/operations/assets/{$asset->id}/dvir-history?limit=2")
        ->assertOk()
        ->assertJsonPath('meta.total', 17)
        ->assertJsonPath('meta.has_more', true)
        ->assertJsonPath('data.0.type', 'pre_trip')
        ->assertJsonPath('data.0.status', 'passed')
        ->assertJsonPath('data.0.received_at', fn ($value): bool => is_string($value))
        ->assertJsonCount(2, 'data');

    $firstIds = collect($firstPage->json('data'))->pluck('id');
    $cursor = $firstPage->json('meta.next');

    expect($cursor)->toMatchArray([
        'before_id' => $records[1]->id,
        'before_completed_at' => $records[1]->completed_at->toIso8601String(),
    ]);

    $secondPage = $this->actingAs($manager)
        ->getJson('/operations/assets/'.$asset->id.'/dvir-history?limit=2&before_id='.$cursor['before_id'].'&before_completed_at='.urlencode($cursor['before_completed_at']))
        ->assertOk()
        ->assertJsonPath('meta.total', 17)
        ->assertJsonCount(2, 'data');

    expect(collect($secondPage->json('data'))->pluck('id')->intersect($firstIds))->toBeEmpty();

    $attention = $this->actingAs($manager)
        ->getJson("/operations/assets/{$asset->id}/dvir-history?filter=needs_attention")
        ->assertOk()
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('data.0.status', 'critical_defect')
        ->assertJsonPath('data.0.critical_defects_count', 1)
        ->assertJsonPath('data.0.photos.0.file_name', 'brake-line.jpg')
        ->assertJsonPath('data.0.defects.0.label', 'Service brake response');

    expect($attention->json('data.0.completed_at'))->toBe($records[2]->completed_at->toIso8601String());

    $preTrip = $this->actingAs($manager)
        ->getJson("/operations/assets/{$asset->id}/dvir-history?filter=pre_trip")
        ->assertOk()
        ->assertJsonPath('meta.total', 9);

    expect(collect($preTrip->json('data'))->pluck('type')->unique()->all())->toBe(['pre_trip']);
});

it('does not expose dvir history for an asset outside the users visibility scope', function (): void {
    $operator = User::factory()->create();
    $operator->syncRoles([RoleName::CraneOperator->value]);

    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-DVIR-HIDDEN-01',
        'name' => 'Hidden Crane',
        'kind' => 'mobile_crane',
        'status' => AssetStatus::Available,
    ]);

    $this->actingAs($operator)
        ->getJson("/operations/assets/{$asset->id}/dvir-history")
        ->assertNotFound();
});
