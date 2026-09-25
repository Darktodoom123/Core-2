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
     * Legacy demo rows retained for the testing environment only.
     *
     * @var list<string>
     */
    private const LEGACY_LOCAL_ASSET_CODES = [
        'CRN-101',
        'TRK-201',
        'TRK-202',
        'CRN-102',
        'EQP-501',
        'CR-501',
        'CRN-103',
        'CRN-104',
        'CRN-105',
        'CRN-106',
        'CRN-107',
    ];

    /**
     * Existing local fixture references that should follow their Alibaton replacements.
     *
     * @var array<string, string>
     */
    private const LOCAL_ASSET_REPLACEMENTS = [
        'CRN-101' => 'MOB-CRN-401',
        'CR-501' => 'MOB-CRN-402',
    ];

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

        if (app()->environment('testing')) {
            $assets = [
                [
                    'code' => 'CRN-101',
                    'name' => '50T Tadano All-Terrain Crane',
                    'kind' => 'crane',
                    'subtype' => 'All-Terrain',
                    'status' => AssetStatus::Assigned->value,
                    'registration_number' => 'CRN-5501-PH',
                    'manufacturer' => 'Tadano',
                    'model' => 'ATF 50G-3',
                    'rated_capacity' => 50.0,
                    'capacity_unit' => 'tonnes',
                    'meter_type' => 'hour_meter',
                    'meter_value' => 1420.5,
                    'baseline_burn_rate' => 18.50,
                    'burn_rate_unit' => 'L/hr',
                    'location' => 'North Staging Terminal - Pier 4',
                    'specifications' => [
                        'boom_length' => '40m',
                        'counterweight' => '12t',
                        'outrigger_spread' => '6.3m',
                        'jib_length_meters' => 60,
                        'attachments' => ['20T Counterweight', 'Jib Extension'],
                    ],
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

            // Seed location telemetry for legacy test fixtures.
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

        // Seed the Alibaton reference fleet before local scenario seeders select an asset.
        $this->call(AlibatonCraneFleetSeeder::class);
        $this->call(PhilippineSafetyOperationsSeeder::class);
        $this->call(OperationalTestSeeder::class);

        if (app()->environment('local')) {
            $this->replaceLegacyLocalAssets();
            $this->purgeLegacySafetyUsers();
        }

        $this->call(AlibatonPersonnelSeeder::class);
    }

    private function replaceLegacyLocalAssets(): void
    {
        DB::transaction(function (): void {
            $legacyAssets = OperationalAsset::withTrashed()
                ->whereIn('code', self::LEGACY_LOCAL_ASSET_CODES)
                ->get(['id', 'code']);

            if ($legacyAssets->isEmpty()) {
                return;
            }

            $legacyIds = $legacyAssets->pluck('id')->all();
            $replacementIds = [];

            foreach (self::LOCAL_ASSET_REPLACEMENTS as $legacyCode => $replacementCode) {
                $legacyAsset = $legacyAssets->firstWhere('code', $legacyCode);
                $replacementAsset = OperationalAsset::query()
                    ->where('code', $replacementCode)
                    ->first(['id']);

                if ($legacyAsset === null || $replacementAsset === null) {
                    continue;
                }

                $replacementIds[$legacyAsset->id] = $replacementAsset->id;
            }

            // Remove seeded legacy assignment history before purging assets because the
            // dispatch-asset foreign key intentionally restricts asset deletion.
            DB::table('dispatch_asset_assignments')
                ->whereIn('operational_asset_id', $legacyIds)
                ->delete();

            // Local fixture telemetry and seeded child records are replaceable.
            DB::table('location_updates')
                ->whereIn('operational_asset_id', $legacyIds)
                ->delete();

            DB::table('inspections')
                ->whereIn('operational_asset_id', $legacyIds)
                ->delete();

            foreach ($replacementIds as $legacyId => $replacementId) {
                DB::table('operator_shifts')
                    ->where('operational_asset_id', $legacyId)
                    ->update(['operational_asset_id' => $replacementId]);

                DB::table('operator_duty_logs')
                    ->where('operational_asset_id', $legacyId)
                    ->update(['operational_asset_id' => $replacementId]);

                DB::table('critical_lift_plans')
                    ->where('operational_asset_id', $legacyId)
                    ->update(['operational_asset_id' => $replacementId]);
            }

            OperationalAsset::withTrashed()
                ->whereIn('id', $legacyIds)
                ->forceDelete();
        });
    }

    private function purgeLegacySafetyUsers(): void
    {
        $legacyEmails = [
            'so.morales@core2.ph',
            'foreman.delacruz@core2.ph',
        ];

        $legacyUsers = User::query()->whereIn('email', $legacyEmails)->get();
        if ($legacyUsers->isEmpty()) {
            return;
        }

        $manager = User::query()->where('email', 'manager@example.com')->first();
        $operator = User::query()->where('email', 'operator@example.com')->first();

        foreach ($legacyUsers as $user) {
            $replacementId = $user->email === 'so.morales@core2.ph'
                ? $manager?->id
                : $operator?->id;

            if ($replacementId !== null) {
                DB::table('dispatch_jobs')->where('created_by', $user->id)->update(['created_by' => $replacementId]);
                DB::table('dispatch_personnel_assignments')->where('assigned_by', $user->id)->update(['assigned_by' => $replacementId]);
                DB::table('dispatch_personnel_assignments')->where('user_id', $user->id)->update(['user_id' => $replacementId]);
                DB::table('dispatch_asset_assignments')->where('assigned_by', $user->id)->update(['assigned_by' => $replacementId]);
                DB::table('toolbox_meetings')->where('safety_officer_id', $user->id)->update(['safety_officer_id' => $replacementId]);
                DB::table('toolbox_meetings')->where('conductor_id', $user->id)->update(['conductor_id' => $replacementId]);
                DB::table('critical_lift_plans')->where('foreman_id', $user->id)->update(['foreman_id' => $replacementId]);
                DB::table('site_hazard_tickets')->where('reporter_id', $user->id)->update(['reporter_id' => $replacementId]);
                DB::table('work_stoppage_notices')->where('issued_by', $user->id)->update(['issued_by' => $replacementId]);
                DB::table('work_stoppage_notices')->where('lifted_by', $user->id)->update(['lifted_by' => $replacementId]);
                DB::table('personnel_credentials')->where('user_id', $user->id)->update(['user_id' => $replacementId]);
            }

            $user->roles()->detach();
            $user->delete();
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
