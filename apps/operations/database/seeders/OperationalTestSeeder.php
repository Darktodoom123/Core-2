<?php

namespace Database\Seeders;

use App\Modules\Assignment\Enums\AssignmentResponse;
use App\Modules\Assignment\Models\DispatchAssetAssignment;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\HoursOfService\Enums\DutyStatus;
use App\Modules\HoursOfService\Enums\ShiftStatus;
use App\Modules\HoursOfService\Models\OperatorDutyLog;
use App\Modules\HoursOfService\Models\OperatorShift;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Identity\Support\Username;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Hash;

final class OperationalTestSeeder extends Seeder
{
    public function run(): void
    {
        Event::fake();
        $now = Carbon::now();

        // 1. Operator User (user_id: 4 / operator@example.com)
        $operator = User::query()->firstOrCreate(
            ['email' => 'operator@example.com'],
            [
                'name' => 'Dev Crane Operator',
                'username' => Username::fromEmail('operator@example.com'),
                'password' => Hash::make('password'),
                'is_active' => true,
                'email_verified_at' => $now,
            ]
        );
        $operator->syncRoles([RoleName::CraneOperator->value]);

        // Manager / Creator User
        $creator = User::query()->where('email', 'manager@example.com')->first()
            ?? User::query()->where('email', 'admin@example.com')->first()
            ?? $operator;

        // 2. Heavy Crane Asset (CRN-101)
        $crane = OperationalAsset::query()->updateOrCreate(
            ['code' => 'CRN-101'],
            [
                'name' => '50T Tadano All-Terrain Crane',
                'kind' => 'crane',
                'subtype' => 'All-Terrain',
                'status' => AssetStatus::Assigned->value,
                'registration_number' => 'CRN-5501-PH',
                'manufacturer' => 'Tadano',
                'model' => 'ATF 50G-3',
                'rated_capacity' => 50.00,
                'capacity_unit' => 'tonnes',
                'meter_type' => 'hour_meter',
                'meter_value' => 1420.50,
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
            ]
        );

        // 3. Active Heavy Crane Dispatch Job (DSP-2026-0891)
        $job = DispatchJob::query()->updateOrCreate(
            ['reference' => 'DSP-2026-0891'],
            [
                'client' => 'Megawide - Metro Manila Subway Project',
                'title' => '50T Tandem Lift & Structural Steel Erection',
                'site' => 'North Staging Terminal - Pier 4',
                'site_notes' => 'Tandem lift with secondary 80T crane. Outrigger ground compaction verified. Radio channel 4.',
                'site_latitude' => 14.5547000,
                'site_longitude' => 121.0244000,
                'priority' => DispatchPriority::Priority,
                'status' => DispatchStatus::Working,
                'version' => 1,
                'created_by' => $creator->id,
                'scheduled_start' => Carbon::today()->addHours(7),
                'scheduled_end' => Carbon::today()->addHours(17),
            ]
        );

        // 4. Personnel Assignment for User 4
        DispatchPersonnelAssignment::query()->updateOrCreate(
            [
                'dispatch_job_id' => $job->id,
                'user_id' => $operator->id,
            ],
            [
                'assignment_type' => 'crane_operator',
                'response_status' => AssignmentResponse::Accepted,
                'assigned_by' => $creator->id,
                'active_from' => $now->copy()->subHours(4)->subMinutes(30),
                'active_until' => null,
            ]
        );

        // 5. Asset Assignment for CRN-101 on Job
        DispatchAssetAssignment::query()->updateOrCreate(
            [
                'dispatch_job_id' => $job->id,
                'operational_asset_id' => $crane->id,
            ],
            [
                'assignment_type' => 'crane',
                'assigned_by' => $creator->id,
                'active_from' => $now->copy()->subHours(4)->subMinutes(30),
                'active_until' => null,
                'site_latitude' => 14.5547000,
                'site_longitude' => 121.0244000,
            ]
        );

        // 6. Active Hours of Service (HoS) Shift for User 4
        $shift = OperatorShift::query()->updateOrCreate(
            [
                'user_id' => $operator->id,
                'dispatch_job_id' => $job->id,
                'status' => ShiftStatus::ACTIVE,
            ],
            [
                'operational_asset_id' => $crane->id,
                'started_at' => $now->copy()->subHours(4)->subMinutes(30),
                'operating_minutes' => 0,
                'driving_minutes' => 30,
                'standby_minutes' => 0,
                'break_minutes' => 0,
                'is_certified' => false,
            ]
        );

        // 7. Completed Driving Duty Log
        OperatorDutyLog::query()->updateOrCreate(
            [
                'operator_shift_id' => $shift->id,
                'user_id' => $operator->id,
                'duty_status' => DutyStatus::DRIVING,
            ],
            [
                'started_at' => $now->copy()->subHours(4)->subMinutes(30),
                'ended_at' => $now->copy()->subHours(4),
                'duration_minutes' => 30,
                'latitude' => 14.5995000,
                'longitude' => 121.0142000,
                'location_name' => 'Central Depot Yard to Site',
                'remarks' => 'Transit to Pier 4 site',
            ]
        );

        // 8. Active Operating Duty Log
        OperatorDutyLog::query()->updateOrCreate(
            [
                'operator_shift_id' => $shift->id,
                'user_id' => $operator->id,
                'ended_at' => null,
            ],
            [
                'duty_status' => DutyStatus::OPERATING,
                'started_at' => $now->copy()->subHours(4),
                'latitude' => 14.5547000,
                'longitude' => 121.0244000,
                'location_name' => 'North Staging Terminal - Pier 4',
                'remarks' => 'Operating 50T crane for structural tandem lift',
            ]
        );

        // 9. Fleet Telemetry Location Update
        DB::table('location_updates')->updateOrInsert(
            ['user_id' => $operator->id, 'operational_asset_id' => $crane->id],
            [
                'dispatch_job_id' => $job->id,
                'latitude' => 14.5547000,
                'longitude' => 121.0244000,
                'accuracy_metres' => 2.5,
                'speed' => 0.0,
                'remarks' => 'Active tandem lift operations at Pier 4',
                'sharing_enabled' => true,
                'source' => 'field_mobile',
                'captured_at' => $now,
                'received_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ]
        );
    }
}
