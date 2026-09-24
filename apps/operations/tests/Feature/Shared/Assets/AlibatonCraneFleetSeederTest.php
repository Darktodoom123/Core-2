<?php

use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\AlibatonCraneFleetSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('seeds the published Alibaton tower-crane catalogue with load and radius', function (): void {
    $this->seed(AlibatonCraneFleetSeeder::class);

    $expected = [
        'JHD140N-8' => ['subtype' => 'Luffing Tower Crane', 'capacity' => 8.0, 'radius' => 50],
        'JHD140N-10' => ['subtype' => 'Luffing Tower Crane', 'capacity' => 10.0, 'radius' => 50],
        'JHD190A-12' => ['subtype' => 'Luffing Tower Crane', 'capacity' => 12.0, 'radius' => 55],
        'JHD190A-14' => ['subtype' => 'Luffing Tower Crane', 'capacity' => 14.0, 'radius' => 55],
        'JHD200C-16' => ['subtype' => 'Luffing Tower Crane', 'capacity' => 16.0, 'radius' => 55],
        'JHD300C-18' => ['subtype' => 'Luffing Tower Crane', 'capacity' => 18.0, 'radius' => 60],
        'JHT6013N-6' => ['subtype' => 'Topless Tower Crane', 'capacity' => 6.0, 'radius' => 60],
        'JHT6017N-8' => ['subtype' => 'Topless Tower Crane', 'capacity' => 8.0, 'radius' => 60],
        'JHT6515N-10' => ['subtype' => 'Topless Tower Crane', 'capacity' => 10.0, 'radius' => 65],
        'JHT7025A-12' => ['subtype' => 'Topless Tower Crane', 'capacity' => 12.0, 'radius' => 70],
        'JHT7527C-16' => ['subtype' => 'Topless Tower Crane', 'capacity' => 16.0, 'radius' => 75],
        'JHT8024B-20' => ['subtype' => 'Topless Tower Crane', 'capacity' => 20.0, 'radius' => 80],
    ];

    expect(OperationalAsset::query()->where('code', 'like', 'TWR-%')->count())->toBe(count($expected));

    foreach ($expected as $model => $specification) {
        $asset = OperationalAsset::query()->where('model', $model)->firstOrFail();

        expect($asset->kind)->toBe('tower_crane')
            ->and($asset->subtype)->toBe($specification['subtype'])
            ->and((float) $asset->rated_capacity)->toBe($specification['capacity'])
            ->and($asset->capacity_unit)->toBe('tonnes')
            ->and($asset->specifications['max_radius_meters'])->toBe($specification['radius'])
            ->and($asset->location)->toBe('Fochun Industrial Compound, Balagtas, 3016 Bulacan, Philippines')
            ->and($asset->specifications['location_type'])->toBe('yard_and_warehouse')
            ->and($asset->specifications['source_url'])->toBe('https://alibaton.com.ph/products/');
    }
});

it('seeds the published project-page tower-crane references', function (): void {
    $this->seed(AlibatonCraneFleetSeeder::class);

    $expected = [
        'PRJ-TWR-401' => ['manufacturer' => 'Potain', 'model' => 'MC200A', 'subtype' => 'Hammerhead Tower Crane', 'capacity' => 10.0, 'jib' => 60, 'huh' => 130.0, 'project' => 'Cement Plant Project'],
        'PRJ-TWR-402' => ['manufacturer' => 'Potain', 'model' => 'MC200B', 'subtype' => 'Hammerhead Tower Crane', 'capacity' => 10.0, 'jib' => 60, 'huh' => 59.7, 'project' => 'Subway Project'],
        'PRJ-TWR-403' => ['manufacturer' => 'Potain', 'model' => 'MTC278 K12', 'subtype' => 'Topless Tower Crane', 'capacity' => 12.0, 'jib' => 70, 'huh' => 47.6, 'project' => 'Subway Project'],
        'PRJ-TWR-404' => ['manufacturer' => 'Potain', 'model' => 'MC175', 'subtype' => 'Hammerhead Tower Crane', 'capacity' => 10.0, 'jib' => 55, 'huh' => 101.0, 'project' => 'Royal Pacific Residence'],
        'PRJ-TWR-405' => ['manufacturer' => 'Potain', 'model' => 'MCT328 L16', 'subtype' => 'Topless Tower Crane', 'capacity' => 16.0, 'jib' => 75, 'huh' => 52.1, 'project' => 'Railway Project'],
        'PRJ-TWR-406' => ['manufacturer' => 'Potain', 'model' => 'MC320A K12', 'subtype' => 'Hammerhead Tower Crane', 'capacity' => 12.0, 'jib' => 70, 'huh' => 46.4, 'project' => 'Railway Project'],
        'PRJ-TWR-407' => ['manufacturer' => 'SCM', 'model' => 'D125', 'subtype' => 'Luffing Tower Crane', 'capacity' => 10.0, 'jib' => 50, 'huh' => 145.0, 'project' => 'Condominium Project'],
        'PRJ-TWR-408' => ['manufacturer' => 'Potain', 'model' => 'MCT385', 'subtype' => 'Topless Tower Crane', 'capacity' => 20.0, 'jib' => 75, 'huh' => 131.7, 'project' => 'Cement Plant Project'],
        'PRJ-TWR-409' => ['manufacturer' => 'Potain', 'model' => 'MC205/MC200', 'subtype' => 'Hammerhead Tower Crane', 'capacity' => 10.0, 'jib' => 60, 'huh' => 47.7, 'project' => 'Government Office Project'],
        'PRJ-TWR-410' => ['manufacturer' => 'Potain', 'model' => 'MCT278 K12', 'subtype' => 'Topless Tower Crane', 'capacity' => 12.0, 'jib' => 70, 'huh' => 23.0, 'project' => 'Water Reclamation Facilities'],
        'PRJ-TWR-411' => ['manufacturer' => 'Potain', 'model' => 'MC205B', 'subtype' => 'Hammerhead Tower Crane', 'capacity' => 10.0, 'jib' => 60, 'huh' => 59.0, 'project' => 'Commercial Building Project'],
        'PRJ-TWR-412' => ['manufacturer' => 'Potain', 'model' => 'MC170/175', 'subtype' => 'Hammerhead Tower Crane', 'capacity' => 10.0, 'jib' => 55, 'huh' => 29.0, 'project' => 'Mid-Rise Condominium'],
        'PRJ-TWR-413' => ['manufacturer' => 'Potain', 'model' => 'MC205B', 'subtype' => 'Hammerhead Tower Crane', 'capacity' => 10.0, 'jib' => 60, 'huh' => 44.0, 'project' => 'Factory Project'],
        'PRJ-TWR-414' => ['manufacturer' => 'Potain', 'model' => 'MR608', 'subtype' => 'Luffing Tower Crane', 'capacity' => 32.0, 'jib' => 60, 'huh' => 51.6, 'project' => 'Factory Project'],
    ];

    expect(OperationalAsset::query()->where('code', 'like', 'PRJ-TWR-%')->count())->toBe(count($expected));

    foreach ($expected as $code => $specification) {
        $asset = OperationalAsset::query()->where('code', $code)->firstOrFail();

        expect($asset->kind)->toBe('tower_crane')
            ->and($asset->manufacturer)->toBe($specification['manufacturer'])
            ->and($asset->model)->toBe($specification['model'])
            ->and($asset->subtype)->toBe($specification['subtype'])
            ->and((float) $asset->rated_capacity)->toBe($specification['capacity'])
            ->and($asset->capacity_unit)->toBe('tonnes')
            ->and($asset->specifications['project_name'])->toBe($specification['project'])
            ->and($asset->specifications['jib_length_meters'])->toBe($specification['jib'])
            ->and((float) $asset->specifications['huh_meters'])->toBe($specification['huh'])
            ->and($asset->specifications['source_height_label'])->toBe('H.U.H.')
            ->and($asset->location)->toBeNull()
            ->and($asset->specifications['data_scope'])->toBe('public_project_reference')
            ->and($asset->specifications['source_url'])->toBe('https://alibaton.com.ph/projects/');
    }
});

it('seeds mobile cranes and heavy-equipment model references with capacity metadata', function (): void {
    $this->seed(AlibatonCraneFleetSeeder::class);

    $expected = [
        'MOB-CRN-401' => ['kind' => 'crane', 'manufacturer' => 'XCMG', 'model' => 'XCT25L5_S1', 'subtype' => 'Truck Crane', 'capacity' => 25.0, 'unit' => 'tonnes', 'source' => 'https://www.xcmgglobal.com/product/truck-crane/xct25l5_s1/', 'capacity_type' => null],
        'MOB-CRN-402' => ['kind' => 'crane', 'manufacturer' => 'XCMG', 'model' => 'XCR55L4', 'subtype' => 'Rough-Terrain Crane', 'capacity' => 55.0, 'unit' => 'tonnes', 'source' => 'https://www.xcmgglobal.com/product/rough-terrain-crane/xcr55l4/', 'capacity_type' => null],
        'MOB-CRN-403' => ['kind' => 'crane', 'manufacturer' => 'XCMG', 'model' => 'XCT80_Y1', 'subtype' => 'Truck Crane', 'capacity' => 80.0, 'unit' => 'tonnes', 'source' => 'https://www.xcmgglobal.com/product/truck-crane/xct80_y1/', 'capacity_type' => null],
        'MOB-CRN-404' => ['kind' => 'crane', 'manufacturer' => 'XCMG', 'model' => 'XCA80G7-1E', 'subtype' => 'All-Terrain Crane', 'capacity' => 80.0, 'unit' => 'tonnes', 'source' => 'https://www.xcmgglobal.com/product/all-terrain-crane/xca80g7-1e/', 'capacity_type' => null],
        'HEQ-LG-835H' => ['kind' => 'equipment', 'manufacturer' => 'LiuGong', 'model' => '835H', 'subtype' => 'Wheel Loader', 'capacity' => 3.0, 'unit' => 'tonnes', 'source' => 'https://www.liugong.com/en/product/835h/', 'capacity_type' => 'rated_load'],
        'HEQ-LG-856H' => ['kind' => 'equipment', 'manufacturer' => 'LiuGong', 'model' => '856H', 'subtype' => 'Wheel Loader', 'capacity' => 5.5, 'unit' => 'tonnes', 'source' => 'https://www.liugong.com/en/product/856h/', 'capacity_type' => 'rated_load'],
        'HEQ-LG-870H' => ['kind' => 'equipment', 'manufacturer' => 'LiuGong', 'model' => '870H', 'subtype' => 'Wheel Loader', 'capacity' => 7.0, 'unit' => 'tonnes', 'source' => 'https://www.liugong.com/en/product/870h/', 'capacity_type' => 'rated_load'],
        'HEQ-LG-922E' => ['kind' => 'equipment', 'manufacturer' => 'LiuGong', 'model' => '922E', 'subtype' => 'Crawler Excavator', 'capacity' => 1.0, 'unit' => 'm3 bucket', 'source' => 'https://www.liugong.com/en/product/922e/', 'capacity_type' => 'standard_bucket'],
        'HEQ-LG-950E' => ['kind' => 'equipment', 'manufacturer' => 'LiuGong', 'model' => '950E', 'subtype' => 'Crawler Excavator', 'capacity' => 3.2, 'unit' => 'm3 bucket', 'source' => 'https://www.liugong.com/en/product/950e/', 'capacity_type' => 'standard_bucket'],
    ];

    expect(OperationalAsset::query()->whereIn('code', array_keys($expected))->count())->toBe(count($expected));

    foreach ($expected as $code => $specification) {
        $asset = OperationalAsset::query()->where('code', $code)->firstOrFail();

        expect($asset->kind)->toBe($specification['kind'])
            ->and($asset->manufacturer)->toBe($specification['manufacturer'])
            ->and($asset->model)->toBe($specification['model'])
            ->and($asset->subtype)->toBe($specification['subtype'])
            ->and((float) $asset->rated_capacity)->toBe($specification['capacity'])
            ->and($asset->capacity_unit)->toBe($specification['unit'])
            ->and($asset->location)->toBe('Fochun Industrial Compound, Balagtas, 3016 Bulacan, Philippines')
            ->and($asset->specifications['source_url'])->toBe($specification['source'])
            ->and($asset->specifications['data_scope'])->toBe('manufacturer_specification_reference')
            ->and($asset->specifications['location_type'])->toBe('yard_and_warehouse')
            ->and($asset->specifications['alibaton_reference_url'])->toBe('https://alibaton.com.ph/products/')
            ->and($asset->specifications['alibaton_supported_brand'])->toBe($specification['manufacturer']);

        if ($specification['capacity_type'] !== null) {
            expect($asset->specifications['capacity_type'])->toBe($specification['capacity_type']);
        }
    }

    $excavator = OperationalAsset::query()->where('code', 'HEQ-LG-922E')->firstOrFail();

    expect($excavator->specifications['capacity_note'])->toBe('Manufacturer-published standard bucket capacity; this is not a lifting capacity.');
});

it('keeps the catalogue seeder idempotent', function (): void {
    $this->seed(AlibatonCraneFleetSeeder::class);
    $this->seed(AlibatonCraneFleetSeeder::class);

    $asset = OperationalAsset::query()->where('model', 'JHT8024B-20')->firstOrFail();

    expect(OperationalAsset::query()->count())->toBe(35)
        ->and((float) $asset->rated_capacity)->toBe(20.0)
        ->and(OperationalAsset::query()->where('code', 'MOB-CRN-401')->count())->toBe(1)
        ->and(OperationalAsset::query()->where('code', 'MOB-CRN-404')->count())->toBe(1)
        ->and(OperationalAsset::query()->where('code', 'HEQ-LG-950E')->count())->toBe(1);
});
