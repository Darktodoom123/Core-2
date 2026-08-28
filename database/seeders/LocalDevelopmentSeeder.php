<?php

namespace Database\Seeders;

use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Identity\Support\Username;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use LogicException;

final class LocalDevelopmentSeeder extends Seeder
{
    /**
     * Seed one quick-login account for each operational role with location updates.
     */
    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new LogicException('Local development fixtures may only be seeded in local or testing environments.');
        }

        $users = [];
        foreach (self::accounts() as $index => $account) {
            $user = User::query()->updateOrCreate(
                ['email' => $account['email']],
                [
                    'name' => $account['name'],
                    'username' => $account['username'],
                    'email_verified_at' => now(),
                    'password' => Hash::make('password'),
                    'is_active' => true,
                    'suspended_at' => null,
                ],
            );

            $user->syncRoles([$account['role']->value]);
            $users[$account['role']->value] = $user;
        }

        $assets = [
            [
                'code' => 'CRN-101',
                'name' => '55T Mobile Hydraulic Crane',
                'kind' => 'crane',
                'subtype' => 'All-Terrain',
                'status' => AssetStatus::ReadyForService->value,
                'registration_number' => 'CRN-5501-PH',
                'manufacturer' => 'Liebherr',
                'model' => 'LTM 1055-3.2',
                'rated_capacity' => 55.0,
                'capacity_unit' => 'tonnes',
                'meter_type' => 'hour_meter',
                'meter_value' => 1420.5,
                'baseline_burn_rate' => 18.50,
                'burn_rate_unit' => 'L/hr',
                'location' => 'Central Depot Yard (Bay 3)',
                'specifications' => ['boom_length' => '40m', 'counterweight' => '12t', 'outrigger_spread' => '6.3m'],
            ],
            [
                'code' => 'TRK-201',
                'name' => 'Prime Mover Heavy Hauler',
                'kind' => 'truck',
                'subtype' => '6x4 Tractor Unit',
                'status' => AssetStatus::Available->value,
                'registration_number' => 'TRK-9821-PH',
                'manufacturer' => 'Volvo',
                'model' => 'FH16 750',
                'rated_capacity' => 45.0,
                'capacity_unit' => 'tonnes',
                'meter_type' => 'odometer',
                'meter_value' => 48200.0,
                'baseline_burn_rate' => 0.35,
                'burn_rate_unit' => 'L/km',
                'location' => 'South Staging Yard',
                'specifications' => ['engine' => '750 HP', 'fifth_wheel_rating' => '32t'],
            ],
            [
                'code' => 'TRK-202',
                'name' => 'Support Flatbed Unit',
                'kind' => 'truck',
                'subtype' => 'Flatbed Rig',
                'status' => AssetStatus::Working->value,
                'registration_number' => 'TRK-4102-PH',
                'manufacturer' => 'Isuzu',
                'model' => 'Giga EXR',
                'rated_capacity' => 25.0,
                'capacity_unit' => 'tonnes',
                'meter_type' => 'odometer',
                'meter_value' => 31450.0,
                'baseline_burn_rate' => 0.28,
                'burn_rate_unit' => 'L/km',
                'location' => 'En Route - Coastal Expressway',
                'specifications' => ['deck_length' => '12m', 'winch_capacity' => '15t'],
            ],
            [
                'code' => 'CRN-102',
                'name' => '80T Rough-Terrain Crane',
                'kind' => 'crane',
                'subtype' => 'Rough-Terrain',
                'status' => AssetStatus::Assigned->value,
                'registration_number' => 'CRN-8002-PH',
                'manufacturer' => 'Tadano',
                'model' => 'GR-800EX',
                'rated_capacity' => 80.0,
                'capacity_unit' => 'tonnes',
                'meter_type' => 'hour_meter',
                'meter_value' => 2190.0,
                'baseline_burn_rate' => 22.00,
                'burn_rate_unit' => 'L/hr',
                'location' => 'Port Terminal Sector 7',
                'specifications' => ['max_radius' => '47m', 'jib_extension' => '17m'],
            ],
            [
                'code' => 'EQP-501',
                'name' => 'Modular Spreader Beam Set',
                'kind' => 'equipment',
                'subtype' => 'Rigging Gear',
                'status' => AssetStatus::ReadyForService->value,
                'registration_number' => null,
                'manufacturer' => 'Modulift',
                'model' => 'MOD 110',
                'rated_capacity' => 100.0,
                'capacity_unit' => 'tonnes',
                'meter_type' => null,
                'meter_value' => null,
                'baseline_burn_rate' => null,
                'burn_rate_unit' => null,
                'location' => 'Central Tool Crib',
                'specifications' => ['max_span' => '14m', 'shackle_size' => '85t'],
            ],
        ];

        $createdAssets = [];
        foreach ($assets as $assetData) {
            $createdAssets[$assetData['code']] = OperationalAsset::query()->updateOrCreate(
                ['code' => $assetData['code']],
                $assetData,
            );
        }

        $operator = $users[RoleName::CraneOperator->value] ?? null;

        // Seed location telemetry for fleet assets
        if ($operator !== null) {
            DB::table('location_updates')->updateOrInsert(
                ['user_id' => $operator->id, 'operational_asset_id' => $createdAssets['CRN-101']->id],
                [
                    'latitude' => 14.5995,
                    'longitude' => 121.0142,
                    'accuracy_metres' => 3.2,
                    'speed' => 0.0,
                    'remarks' => 'Stationary at Central Depot Yard',
                    'sharing_enabled' => true,
                    'source' => 'field_mobile',
                    'captured_at' => now(),
                    'received_at' => now(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
            );
        }
    }

    /**
     * @return list<array{name: string, username: string, email: string, role: RoleName}>
     */
    public static function accounts(): array
    {
        return [
            [
                'name' => 'Dev System Administrator',
                'username' => Username::fromEmail('admin@example.com'),
                'email' => 'admin@example.com',
                'role' => RoleName::SystemAdministrator,
            ],
            [
                'name' => 'Dev Operations Manager',
                'username' => Username::fromEmail('manager@example.com'),
                'email' => 'manager@example.com',
                'role' => RoleName::OperationsManager,
            ],
            [
                'name' => 'Dev Crane Operator',
                'username' => Username::fromEmail('operator@example.com'),
                'email' => 'operator@example.com',
                'role' => RoleName::CraneOperator,
            ],
        ];
    }
}
