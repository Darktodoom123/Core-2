<?php

namespace Database\Seeders;

use App\Modules\Assignment\Models\DispatchAssetAssignment;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\PersonnelCredential;
use App\Platform\Identity\Models\User;
use App\Platform\Identity\Support\Username;
use App\Platform\Safety\Models\CriticalLiftPlan;
use App\Platform\Safety\Models\SiteHazardTicket;
use App\Platform\Safety\Models\ToolboxMeeting;
use App\Platform\Safety\Models\WorkStoppageNotice;
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
            ToolboxMeeting::query()->where('safety_officer_id', $legacyUser->id)->update(['safety_officer_id' => $replacementId]);
            ToolboxMeeting::query()->where('conductor_id', $legacyUser->id)->update(['conductor_id' => $replacementId]);
            CriticalLiftPlan::query()->where('foreman_id', $legacyUser->id)->update(['foreman_id' => $replacementId]);
            SiteHazardTicket::query()->where('reporter_id', $legacyUser->id)->update(['reporter_id' => $replacementId]);
            WorkStoppageNotice::query()->where('issued_by', $legacyUser->id)->update(['issued_by' => $replacementId]);
            WorkStoppageNotice::query()->where('lifted_by', $legacyUser->id)->update(['lifted_by' => $replacementId]);
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

        // 5. DOLE Toolbox Meeting (TBM)
        ToolboxMeeting::query()->firstOrCreate(
            ['audit_hash' => 'PH-DOLE-CSHP-2026-TBM-8842'],
            [
                'project_site' => 'Makati Skysuites Tower (Site Grid B-4)',
                'topic_id' => 'tbm-01',
                'topic_title' => 'DOLE D.O. 13: Critical Lifting & Swing Radius Clearance',
                'topic_category' => 'lifting_rigging',
                'conductor_id' => $foreman->id,
                'conductor_role' => 'Field Foreman',
                'attendee_ids' => ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8', 'w9', 'w10', 'w11', 'w12'],
                'attendee_count' => 12,
                'photo_evidence_url' => 'https://storage.core2-ph.com/tbm/site-grid-b4.jpg',
                'photo_timestamp' => Carbon::now()->startOfDay()->addHours(7)->addMinutes(15),
                'notes' => 'Pre-shift safety briefing covering tag line controls, swing pinch points, and 100% harness hookup.',
                'safety_officer_id' => $safetyOfficer->id,
                'safety_officer_signed_at' => Carbon::now()->startOfDay()->addHours(7)->addMinutes(30),
            ]
        );

        // 6. Critical Lift Plan
        CriticalLiftPlan::query()->updateOrCreate(
            ['lift_reference' => 'CR-LIFT-2026-089'],
            [
                'dispatch_job_id' => $makatiJob->id,
                'operational_asset_id' => $crane->id,
                'project_site' => 'Makati Skysuites Tower (Site Grid B-4)',
                'foreman_id' => $foreman->id,
                'rigger_tesda_nc_number' => 'TESDA-RIG-2024-9912',
                'risk_level' => 'critical',
                'gross_load_weight_tons' => 28.50,
                'crane_rated_capacity_tons' => $usingAlibatonFleet ? 55.00 : 34.00,
                'load_percentage_of_capacity' => $usingAlibatonFleet ? 51.82 : 83.82,
                'boom_length_meters' => $usingAlibatonFleet ? 36.50 : 38.00,
                'working_radius_meters' => 14.50,
                'ground_bearing_condition' => 'Engineered Timber Pads (4 Layers Hardwood)',
                'weather_wind_speed_kph' => 14.00,
                'status' => 'pending_so_review',
            ]
        );

        // 7. Site Hazard Tickets
        SiteHazardTicket::query()->firstOrCreate(
            ['ticket_code' => 'HAZ-2026-042'],
            [
                'project_site' => 'Makati Skysuites Tower (Site Grid B-4)',
                'reporter_id' => $safetyOfficer->id,
                'category' => 'rigging_tackle',
                'severity' => 'medium',
                'description' => 'Webbing sling with 5mm edge tear found in secondary rigger staging box.',
                'location_detail' => 'Rigging Staging Area, Bay 2',
                'corrective_action_required' => 'Tag out and cut destroyed sling immediately. Replace with certified stock.',
                'status' => 'open',
                'work_stoppage_issued' => false,
            ]
        );

        SiteHazardTicket::query()->firstOrCreate(
            ['ticket_code' => 'HAZ-2026-043'],
            [
                'project_site' => 'BGC Corporate Center Phase 3',
                'reporter_id' => $foreman->id,
                'category' => 'housekeeping_fire',
                'severity' => 'low',
                'description' => 'Empty hydraulic fluid containers left unbundled near diesel generator shed.',
                'location_detail' => 'North Gate Generator Shed',
                'corrective_action_required' => 'Transfer to designated hazardous waste bunded palette.',
                'status' => 'rectified',
                'work_stoppage_issued' => false,
            ]
        );

        // 8. Work Stoppage Notice (Historical Lifted Notice)
        WorkStoppageNotice::query()->firstOrCreate(
            ['notice_number' => 'WSO-20260829-MKT1'],
            [
                'project_site' => 'Makati Skysuites Tower (Site Grid B-4)',
                'issued_by' => $safetyOfficer->id,
                'dole_regulation_reference' => 'DOLE D.O. 13 s. 1998 Section 8 & RA 11058 Section 20',
                'reason' => 'Ground settlement observed on outrigger pad following heavy overnight monsoon rains.',
                'affected_area' => 'Site Grid B-4 Heavy Lift Zone',
                'is_active' => false,
                'lifted_by' => $safetyOfficer->id,
                'lifted_at' => Carbon::now()->subHour(),
                'lift_reason' => 'Sub-base soil compaction test passed; 35mm steel road plate foundation installed.',
            ]
        );
    }
}
