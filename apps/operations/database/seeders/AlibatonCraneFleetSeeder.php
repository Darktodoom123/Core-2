<?php

namespace Database\Seeders;

use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Database\Seeder;

final class AlibatonCraneFleetSeeder extends Seeder
{
    private const CATALOGUE_URL = 'https://alibaton.com.ph/products/';

    private const PROJECTS_URL = 'https://alibaton.com.ph/projects/';

    private const YARD_LOCATION = 'Fochun Industrial Compound, Balagtas, 3016 Bulacan, Philippines';

    private const SOURCES_REVIEWED_ON = '2026-09-24';

    private const CAPACITY_NOTE = 'Published reference capacity. Verify the applicable manufacturer specification, configuration, or load chart before operational use.';

    /**
     * Seed Alibaton's published tower-crane catalogue, project references, and
     * manufacturer-backed mobile/heavy-equipment model references.
     *
     * The equipment catalogue publishes model, maximum load, and maximum radius
     * for luffing and topless tower cranes. The projects page publishes named
     * Potain and SCM tower-crane examples with project-specific capacity, jib
     * length, and H.U.H. values. Neither page is a verified physical fleet
     * inventory. The mobile/heavy-equipment rows use official manufacturer
     * specifications for brands Alibaton lists as supported, so the local
     * status is only demo data and does not assert current inventory.
     */
    public function run(): void
    {
        foreach (self::catalogue() as $catalogueAsset) {
            $this->upsertReferenceAsset(
                kind: 'tower_crane',
                code: $catalogueAsset['code'],
                model: $catalogueAsset['model'],
                subtype: $catalogueAsset['subtype'],
                capacity: $catalogueAsset['max_load_tonnes'],
                capacityUnit: 'tonnes',
                manufacturer: null,
                sourceUrl: self::CATALOGUE_URL,
                dataScope: 'public_catalogue_reference',
                location: self::YARD_LOCATION,
                specifications: [
                    'max_radius_meters' => $catalogueAsset['max_radius_meters'],
                    'location_type' => 'yard_and_warehouse',
                    'location_note' => 'User-provided yard and warehouse address; this reference row does not assert current physical inventory at this location.',
                ],
            );
        }

        foreach (self::projectExamples() as $projectAsset) {
            $this->upsertReferenceAsset(
                kind: 'tower_crane',
                code: $projectAsset['code'],
                model: $projectAsset['model'],
                subtype: $projectAsset['subtype'],
                capacity: $projectAsset['max_capacity_tonnes'],
                capacityUnit: 'tonnes',
                manufacturer: $projectAsset['manufacturer'],
                sourceUrl: self::PROJECTS_URL,
                dataScope: 'public_project_reference',
                location: null,
                specifications: [
                    'project_name' => $projectAsset['project_name'],
                    'jib_length_meters' => $projectAsset['jib_length_meters'],
                    'huh_meters' => $projectAsset['huh_meters'],
                    'source_height_label' => 'H.U.H.',
                ],
            );
        }

        foreach (self::mobileCranes() as $mobileCrane) {
            $this->upsertReferenceAsset(
                kind: 'crane',
                code: $mobileCrane['code'],
                model: $mobileCrane['model'],
                subtype: $mobileCrane['subtype'],
                capacity: $mobileCrane['capacity'],
                capacityUnit: 'tonnes',
                manufacturer: $mobileCrane['manufacturer'],
                sourceUrl: $mobileCrane['source_url'],
                dataScope: 'manufacturer_specification_reference',
                location: self::YARD_LOCATION,
                specifications: array_merge(
                    [
                        'alibaton_reference_url' => self::CATALOGUE_URL,
                        'alibaton_supported_brand' => $mobileCrane['manufacturer'],
                        'availability_note' => 'Alibaton lists this manufacturer as supported; this row is a model reference and does not assert current Alibaton inventory.',
                        'location_type' => 'yard_and_warehouse',
                        'location_note' => 'User-provided yard and warehouse address; this reference row does not assert current physical inventory at this location.',
                    ],
                    $mobileCrane['specifications'],
                ),
            );
        }

        foreach (self::heavyEquipment() as $heavyEquipment) {
            $this->upsertReferenceAsset(
                kind: 'equipment',
                code: $heavyEquipment['code'],
                model: $heavyEquipment['model'],
                subtype: $heavyEquipment['subtype'],
                capacity: $heavyEquipment['capacity'],
                capacityUnit: $heavyEquipment['capacity_unit'],
                manufacturer: $heavyEquipment['manufacturer'],
                sourceUrl: $heavyEquipment['source_url'],
                dataScope: 'manufacturer_specification_reference',
                location: self::YARD_LOCATION,
                specifications: array_merge(
                    [
                        'alibaton_reference_url' => self::CATALOGUE_URL,
                        'alibaton_supported_brand' => $heavyEquipment['manufacturer'],
                        'availability_note' => 'Alibaton lists this manufacturer as supported; this row is a model reference and does not assert current Alibaton inventory.',
                        'location_type' => 'yard_and_warehouse',
                        'location_note' => 'User-provided yard and warehouse address; this reference row does not assert current physical inventory at this location.',
                    ],
                    $heavyEquipment['specifications'],
                ),
            );
        }
    }

    /**
     * @param  array<string, int|float|string>  $specifications
     */
    private function upsertReferenceAsset(
        string $kind,
        string $code,
        string $model,
        string $subtype,
        ?float $capacity,
        ?string $capacityUnit,
        ?string $manufacturer,
        string $sourceUrl,
        string $dataScope,
        ?string $location,
        array $specifications,
    ): void {
        OperationalAsset::query()->updateOrCreate(
            ['code' => $code],
            [
                'name' => trim(($manufacturer === null ? '' : $manufacturer.' ').$model.' '.$subtype),
                'kind' => $kind,
                'subtype' => $subtype,
                'status' => AssetStatus::Available->value,
                'registration_number' => null,
                'manufacturer' => $manufacturer,
                'model' => $model,
                'rated_capacity' => $capacity,
                'capacity_unit' => $capacityUnit,
                'meter_type' => null,
                'meter_value' => null,
                'baseline_burn_rate' => null,
                'burn_rate_unit' => null,
                'location' => $location,
                'specifications' => array_merge(
                    [
                        'capacity_note' => self::CAPACITY_NOTE,
                        'data_scope' => $dataScope,
                        'source_url' => $sourceUrl,
                        'source_reviewed_on' => self::SOURCES_REVIEWED_ON,
                        'availability_note' => 'The local Available status is demo data and does not assert current inventory availability.',
                    ],
                    $specifications,
                ),
            ],
        );
    }

    /**
     * @return list<array{code: string, model: string, subtype: string, max_load_tonnes: float, max_radius_meters: int}>
     */
    private static function catalogue(): array
    {
        return [
            // Luffing tower cranes.
            [
                'code' => 'TWR-301',
                'model' => 'JHD140N-8',
                'subtype' => 'Luffing Tower Crane',
                'max_load_tonnes' => 8.00,
                'max_radius_meters' => 50,
            ],
            [
                'code' => 'TWR-302',
                'model' => 'JHD140N-10',
                'subtype' => 'Luffing Tower Crane',
                'max_load_tonnes' => 10.00,
                'max_radius_meters' => 50,
            ],
            [
                'code' => 'TWR-303',
                'model' => 'JHD190A-12',
                'subtype' => 'Luffing Tower Crane',
                'max_load_tonnes' => 12.00,
                'max_radius_meters' => 55,
            ],
            [
                'code' => 'TWR-304',
                'model' => 'JHD190A-14',
                'subtype' => 'Luffing Tower Crane',
                'max_load_tonnes' => 14.00,
                'max_radius_meters' => 55,
            ],
            [
                'code' => 'TWR-305',
                'model' => 'JHD200C-16',
                'subtype' => 'Luffing Tower Crane',
                'max_load_tonnes' => 16.00,
                'max_radius_meters' => 55,
            ],
            [
                'code' => 'TWR-306',
                'model' => 'JHD300C-18',
                'subtype' => 'Luffing Tower Crane',
                'max_load_tonnes' => 18.00,
                'max_radius_meters' => 60,
            ],

            // Topless tower cranes.
            [
                'code' => 'TWR-307',
                'model' => 'JHT6013N-6',
                'subtype' => 'Topless Tower Crane',
                'max_load_tonnes' => 6.00,
                'max_radius_meters' => 60,
            ],
            [
                'code' => 'TWR-308',
                'model' => 'JHT6017N-8',
                'subtype' => 'Topless Tower Crane',
                'max_load_tonnes' => 8.00,
                'max_radius_meters' => 60,
            ],
            [
                'code' => 'TWR-309',
                'model' => 'JHT6515N-10',
                'subtype' => 'Topless Tower Crane',
                'max_load_tonnes' => 10.00,
                'max_radius_meters' => 65,
            ],
            [
                'code' => 'TWR-310',
                'model' => 'JHT7025A-12',
                'subtype' => 'Topless Tower Crane',
                'max_load_tonnes' => 12.00,
                'max_radius_meters' => 70,
            ],
            [
                'code' => 'TWR-311',
                'model' => 'JHT7527C-16',
                'subtype' => 'Topless Tower Crane',
                'max_load_tonnes' => 16.00,
                'max_radius_meters' => 75,
            ],
            [
                'code' => 'TWR-312',
                'model' => 'JHT8024B-20',
                'subtype' => 'Topless Tower Crane',
                'max_load_tonnes' => 20.00,
                'max_radius_meters' => 80,
            ],
        ];
    }

    /**
     * @return list<array{code: string, manufacturer: string, model: string, subtype: string, max_capacity_tonnes: float, jib_length_meters: int, huh_meters: float, project_name: string}>
     */
    private static function projectExamples(): array
    {
        return [
            [
                'code' => 'PRJ-TWR-401',
                'manufacturer' => 'Potain',
                'model' => 'MC200A',
                'subtype' => 'Hammerhead Tower Crane',
                'max_capacity_tonnes' => 10.00,
                'jib_length_meters' => 60,
                'huh_meters' => 130.0,
                'project_name' => 'Cement Plant Project',
            ],
            [
                'code' => 'PRJ-TWR-402',
                'manufacturer' => 'Potain',
                'model' => 'MC200B',
                'subtype' => 'Hammerhead Tower Crane',
                'max_capacity_tonnes' => 10.00,
                'jib_length_meters' => 60,
                'huh_meters' => 59.7,
                'project_name' => 'Subway Project',
            ],
            [
                'code' => 'PRJ-TWR-403',
                'manufacturer' => 'Potain',
                'model' => 'MTC278 K12',
                'subtype' => 'Topless Tower Crane',
                'max_capacity_tonnes' => 12.00,
                'jib_length_meters' => 70,
                'huh_meters' => 47.6,
                'project_name' => 'Subway Project',
            ],
            [
                'code' => 'PRJ-TWR-404',
                'manufacturer' => 'Potain',
                'model' => 'MC175',
                'subtype' => 'Hammerhead Tower Crane',
                'max_capacity_tonnes' => 10.00,
                'jib_length_meters' => 55,
                'huh_meters' => 101.0,
                'project_name' => 'Royal Pacific Residence',
            ],
            [
                'code' => 'PRJ-TWR-405',
                'manufacturer' => 'Potain',
                'model' => 'MCT328 L16',
                'subtype' => 'Topless Tower Crane',
                'max_capacity_tonnes' => 16.00,
                'jib_length_meters' => 75,
                'huh_meters' => 52.1,
                'project_name' => 'Railway Project',
            ],
            [
                'code' => 'PRJ-TWR-406',
                'manufacturer' => 'Potain',
                'model' => 'MC320A K12',
                'subtype' => 'Hammerhead Tower Crane',
                'max_capacity_tonnes' => 12.00,
                'jib_length_meters' => 70,
                'huh_meters' => 46.4,
                'project_name' => 'Railway Project',
            ],
            [
                'code' => 'PRJ-TWR-407',
                'manufacturer' => 'SCM',
                'model' => 'D125',
                'subtype' => 'Luffing Tower Crane',
                'max_capacity_tonnes' => 10.00,
                'jib_length_meters' => 50,
                'huh_meters' => 145.0,
                'project_name' => 'Condominium Project',
            ],
            [
                'code' => 'PRJ-TWR-408',
                'manufacturer' => 'Potain',
                'model' => 'MCT385',
                'subtype' => 'Topless Tower Crane',
                'max_capacity_tonnes' => 20.00,
                'jib_length_meters' => 75,
                'huh_meters' => 131.7,
                'project_name' => 'Cement Plant Project',
            ],
            [
                'code' => 'PRJ-TWR-409',
                'manufacturer' => 'Potain',
                'model' => 'MC205/MC200',
                'subtype' => 'Hammerhead Tower Crane',
                'max_capacity_tonnes' => 10.00,
                'jib_length_meters' => 60,
                'huh_meters' => 47.7,
                'project_name' => 'Government Office Project',
            ],
            [
                'code' => 'PRJ-TWR-410',
                'manufacturer' => 'Potain',
                'model' => 'MCT278 K12',
                'subtype' => 'Topless Tower Crane',
                'max_capacity_tonnes' => 12.00,
                'jib_length_meters' => 70,
                'huh_meters' => 23.0,
                'project_name' => 'Water Reclamation Facilities',
            ],
            [
                'code' => 'PRJ-TWR-411',
                'manufacturer' => 'Potain',
                'model' => 'MC205B',
                'subtype' => 'Hammerhead Tower Crane',
                'max_capacity_tonnes' => 10.00,
                'jib_length_meters' => 60,
                'huh_meters' => 59.0,
                'project_name' => 'Commercial Building Project',
            ],
            [
                'code' => 'PRJ-TWR-412',
                'manufacturer' => 'Potain',
                'model' => 'MC170/175',
                'subtype' => 'Hammerhead Tower Crane',
                'max_capacity_tonnes' => 10.00,
                'jib_length_meters' => 55,
                'huh_meters' => 29.0,
                'project_name' => 'Mid-Rise Condominium',
            ],
            [
                'code' => 'PRJ-TWR-413',
                'manufacturer' => 'Potain',
                'model' => 'MC205B',
                'subtype' => 'Hammerhead Tower Crane',
                'max_capacity_tonnes' => 10.00,
                'jib_length_meters' => 60,
                'huh_meters' => 44.0,
                'project_name' => 'Factory Project',
            ],
            [
                'code' => 'PRJ-TWR-414',
                'manufacturer' => 'Potain',
                'model' => 'MR608',
                'subtype' => 'Luffing Tower Crane',
                'max_capacity_tonnes' => 32.00,
                'jib_length_meters' => 60,
                'huh_meters' => 51.6,
                'project_name' => 'Factory Project',
            ],
        ];
    }

    /**
     * Model references for mobile cranes from manufacturers Alibaton lists as supported.
     *
     * @return list<array{code: string, manufacturer: string, model: string, subtype: string, capacity: float, source_url: string, specifications: array<string, int|float|string>}>
     */
    private static function mobileCranes(): array
    {
        return [
            [
                'code' => 'MOB-CRN-401',
                'manufacturer' => 'XCMG',
                'model' => 'XCT25L5_S1',
                'subtype' => 'Truck Crane',
                'capacity' => 25.00,
                'source_url' => 'https://www.xcmgglobal.com/product/truck-crane/xct25l5_s1/',
                'specifications' => [
                    'telescopic_boom_meters' => 43.0,
                    'max_hoist_height_meters' => 50.0,
                    'axles' => 3,
                    'max_load_moment_kn_m' => 1127.0,
                ],
            ],
            [
                'code' => 'MOB-CRN-402',
                'manufacturer' => 'XCMG',
                'model' => 'XCR55L4',
                'subtype' => 'Rough-Terrain Crane',
                'capacity' => 55.00,
                'source_url' => 'https://www.xcmgglobal.com/product/rough-terrain-crane/xcr55l4/',
                'specifications' => [
                    'telescopic_boom_meters' => 36.5,
                    'max_hoist_height_meters' => 49.6,
                    'axles' => 2,
                    'drive_steer_configuration' => '4x4x4',
                ],
            ],
            [
                'code' => 'MOB-CRN-403',
                'manufacturer' => 'XCMG',
                'model' => 'XCT80_Y1',
                'subtype' => 'Truck Crane',
                'capacity' => 80.00,
                'source_url' => 'https://www.xcmgglobal.com/product/truck-crane/xct80_y1/',
                'specifications' => [
                    'telescopic_boom_meters' => 50.5,
                    'max_hoist_height_meters' => 65.0,
                    'axles' => 4,
                    'max_load_moment_kn_m' => 2965.0,
                ],
            ],
            [
                'code' => 'MOB-CRN-404',
                'manufacturer' => 'XCMG',
                'model' => 'XCA80G7-1E',
                'subtype' => 'All-Terrain Crane',
                'capacity' => 80.00,
                'source_url' => 'https://www.xcmgglobal.com/product/all-terrain-crane/xca80g7-1e/',
                'specifications' => [
                    'telescopic_boom_meters' => 60.0,
                    'max_hoist_height_meters' => 75.0,
                    'axles' => 4,
                    'max_load_moment_kn_m' => 2075.0,
                    'drive_steer_configuration' => '8x6x8',
                ],
            ],
        ];
    }

    /**
     * Model references for heavy equipment from manufacturers Alibaton lists as supported.
     *
     * @return list<array{code: string, manufacturer: string, model: string, subtype: string, capacity: float, capacity_unit: string, source_url: string, specifications: array<string, int|float|string>}>
     */
    private static function heavyEquipment(): array
    {
        return [
            [
                'code' => 'HEQ-LG-835H',
                'manufacturer' => 'LiuGong',
                'model' => '835H',
                'subtype' => 'Wheel Loader',
                'capacity' => 3.00,
                'capacity_unit' => 'tonnes',
                'source_url' => 'https://www.liugong.com/en/product/835h/',
                'specifications' => [
                    'capacity_type' => 'rated_load',
                    'rated_load_range_tonnes' => '3.0-3.5',
                    'standard_bucket_capacity_m3' => 1.8,
                    'bucket_capacity_range_m3' => '1.5-3.0',
                    'operating_weight_kg' => 10125,
                ],
            ],
            [
                'code' => 'HEQ-LG-856H',
                'manufacturer' => 'LiuGong',
                'model' => '856H',
                'subtype' => 'Wheel Loader',
                'capacity' => 5.50,
                'capacity_unit' => 'tonnes',
                'source_url' => 'https://www.liugong.com/en/product/856h/',
                'specifications' => [
                    'capacity_type' => 'rated_load',
                    'standard_bucket_capacity_m3' => 3.5,
                    'bucket_capacity_range_m3' => '2.7-5.6',
                    'operating_weight_kg' => 17900,
                ],
            ],
            [
                'code' => 'HEQ-LG-870H',
                'manufacturer' => 'LiuGong',
                'model' => '870H',
                'subtype' => 'Wheel Loader',
                'capacity' => 7.00,
                'capacity_unit' => 'tonnes',
                'source_url' => 'https://www.liugong.com/en/product/870h/',
                'specifications' => [
                    'capacity_type' => 'rated_load',
                    'standard_bucket_capacity_m3' => 5.0,
                    'bucket_capacity_range_m3' => '3.0-7.0',
                    'operating_weight_kg' => 23700,
                ],
            ],
            [
                'code' => 'HEQ-LG-922E',
                'manufacturer' => 'LiuGong',
                'model' => '922E',
                'subtype' => 'Crawler Excavator',
                'capacity' => 1.00,
                'capacity_unit' => 'm3 bucket',
                'source_url' => 'https://www.liugong.com/en/product/922e/',
                'specifications' => [
                    'capacity_type' => 'standard_bucket',
                    'capacity_note' => 'Manufacturer-published standard bucket capacity; this is not a lifting capacity.',
                    'standard_bucket_capacity_m3' => 1.0,
                    'bucket_capacity_range_m3' => '0.45-1.2',
                    'operating_weight_kg' => 22000,
                ],
            ],
            [
                'code' => 'HEQ-LG-950E',
                'manufacturer' => 'LiuGong',
                'model' => '950E',
                'subtype' => 'Crawler Excavator',
                'capacity' => 3.20,
                'capacity_unit' => 'm3 bucket',
                'source_url' => 'https://www.liugong.com/en/product/950e/',
                'specifications' => [
                    'capacity_type' => 'standard_bucket',
                    'capacity_note' => 'Manufacturer-published standard bucket capacity; this is not a lifting capacity.',
                    'standard_bucket_capacity_m3' => 3.2,
                    'bucket_capacity_range_m3' => '2.2-3.2',
                    'operating_weight_range_kg' => '46500-49800',
                ],
            ],
        ];
    }
}
