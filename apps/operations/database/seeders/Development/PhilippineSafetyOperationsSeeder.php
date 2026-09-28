<?php

namespace Database\Seeders\Development;

use App\Modules\Assignment\Models\DispatchAssetAssignment;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\PersonnelCredential;
use App\Platform\Identity\Models\User;
use App\Platform\Identity\Support\Username;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;

final class PhilippineSafetyOperationsSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Safety Officer (Dev Operations Manager)
        $safetyOfficer = User::query()->firstOrCreate(
            ['email' => 'manager@example.com'],
            [
                'name' => 'Dev Operations Manager',
                'username' => Username::fromEmail('manager@example.com'),
                'password' => Hash::make('password'),
                'is_active' => true,
                'email_verified_at' => Carbon::now(),
            ]
        );
        $safetyOfficer->syncRoles([RoleName::OperationsManager->value]);

        PersonnelCredential::query()->updateOrCreate(
            ['credential_number' => 'DOLE-BWC-SO3-2023-4412'],
            [
                'user_id' => $safetyOfficer->id,
                'kind' => 'qualification',
                'credential_type' => 'DOLE-BWC Certified Safety Officer 3 (40-hr COSH & 48-hr LCM)',
                'status' => 'active',
                'issued_at' => Carbon::now()->subYear(),
                'expires_at' => Carbon::now()->addYears(2),
            ]
        );

        // 2. Field Foreman (Dev Crane Operator)
        $foreman = User::query()->firstOrCreate(
            ['email' => 'operator@example.com'],
            [
                'name' => 'Dev Crane Operator',
                'username' => Username::fromEmail('operator@example.com'),
                'password' => Hash::make('password'),
                'is_active' => true,
                'email_verified_at' => Carbon::now(),
            ]
        );
        $foreman->syncRoles([RoleName::CraneOperator->value]);

        PersonnelCredential::query()->updateOrCreate(
            ['credential_number' => 'TESDA-RIG-2024-9912'],
            [
                'user_id' => $foreman->id,
                'kind' => 'operator_certification',
                'credential_type' => 'TESDA NC-II Heavy Equipment / Master Rigger',
                'status' => 'active',
                'issued_at' => Carbon::now()->subMonths(6),
                'expires_at' => Carbon::now()->addYears(2),
            ]
        );

        // Purge legacy fixture accounts if present
        $legacyUsers = User::query()->whereIn('email', [
            'so.morales@core2.ph',
            'foreman.delacruz@core2.ph',
        ])->get();

        foreach ($legacyUsers as $legacyUser) {
            $replacementId = $legacyUser->email === 'so.morales@core2.ph'
                ? $safetyOfficer->id
                : $foreman->id;

            DispatchJob::query()->where('created_by', $legacyUser->id)->update(['created_by' => $replacementId]);
            DispatchPersonnelAssignment::query()->where('assigned_by', $legacyUser->id)->update(['assigned_by' => $replacementId]);
            DispatchPersonnelAssignment::query()->where('user_id', $legacyUser->id)->update(['user_id' => $replacementId]);
            DispatchAssetAssignment::query()->where('assigned_by', $legacyUser->id)->update(['assigned_by' => $replacementId]);
            PersonnelCredential::query()->where('user_id', $legacyUser->id)->update(['user_id' => $replacementId]);
            $legacyUser->roles()->detach();
            $legacyUser->delete();
        }

        // 3. Operational Asset. Local development uses the Alibaton/XCMG reference fleet;
        // the original CR-501 fixture remains available to the testing environment.
        $usingAlibatonFleet = app()->environment('local');

        if ($usingAlibatonFleet && ! OperationalAsset::query()->where('code', 'MOB-CRN-402')->exists()) {
            $this->call(AlibatonCraneFleetSeeder::class);
        }

        $crane = $usingAlibatonFleet
            ? OperationalAsset::query()->where('code', 'MOB-CRN-402')->firstOrFail()
            : OperationalAsset::query()->firstOrCreate(
                ['code' => 'CR-501'],
                [
                    'name' => 'SANY SCC500TB (50T Crawler Crane)',
                    'kind' => 'crane',
                    'subtype' => 'telescopic_crawler',
                    'status' => AssetStatus::Available,
                    'location' => 'Makati Skysuites Tower Staging Yard',
                    'rated_capacity' => 50.00,
                    'capacity_unit' => 'metric_tons',
                ]
            );

        // 4. Philippine Dispatch Jobs
        $makatiJob = DispatchJob::query()->firstOrCreate(
            ['reference' => 'DSP-PH-2026-001'],
            [
                'client' => 'Makati Skysuites Corp & Megawide',
                'title' => 'Phase 3 Heavy Mechanical Tandem Lift',
                'site' => 'Makati Skysuites Tower (Site Grid B-4)',
                'priority' => DispatchPriority::Priority,
                'status' => DispatchStatus::Scheduled,
                'version' => 1,
                'created_by' => $safetyOfficer->id,
                'scheduled_start' => Carbon::now()->startOfDay()->addHours(7),
                'scheduled_end' => Carbon::now()->startOfDay()->addHours(17),
            ]
        );

        DispatchPersonnelAssignment::query()->firstOrCreate(
            ['dispatch_job_id' => $makatiJob->id, 'user_id' => $foreman->id],
            [
                'assignment_type' => 'foreman',
                'response_status' => 'accepted',
                'assigned_by' => $safetyOfficer->id,
                'active_from' => Carbon::now()->subHours(2),
            ]
        );

        DispatchAssetAssignment::query()->firstOrCreate(
            ['dispatch_job_id' => $makatiJob->id, 'operational_asset_id' => $crane->id],
            [
                'assignment_type' => 'crane',
                'assigned_by' => $safetyOfficer->id,
                'active_from' => Carbon::now()->subHours(2),
            ]
        );

    }
}
