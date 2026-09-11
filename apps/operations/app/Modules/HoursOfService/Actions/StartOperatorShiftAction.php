<?php

namespace App\Modules\HoursOfService\Actions;

use App\Modules\HoursOfService\Enums\DutyStatus;
use App\Modules\HoursOfService\Enums\ShiftStatus;
use App\Modules\HoursOfService\Models\OperatorDutyLog;
use App\Modules\HoursOfService\Models\OperatorShift;
use App\Platform\Identity\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class StartOperatorShiftAction
{
    public function execute(
        User $user,
        ?int $operationalAssetId = null,
        ?int $dispatchJobId = null,
        DutyStatus $initialDutyStatus = DutyStatus::OPERATING,
        ?float $latitude = null,
        ?float $longitude = null,
        ?string $locationName = null,
        ?string $remarks = null,
    ): OperatorShift {
        return DB::transaction(function () use (
            $user,
            $operationalAssetId,
            $dispatchJobId,
            $initialDutyStatus,
            $latitude,
            $longitude,
            $locationName,
            $remarks,
        ): OperatorShift {
            $now = Carbon::now();

            // Pessimistic lock on user record to serialize concurrent shift operations per operator
            User::query()->whereKey($user->id)->lockForUpdate()->first();

            // End any existing active shift for this user to avoid dangling open shifts
            $existingShift = OperatorShift::query()
                ->where('user_id', $user->id)
                ->whereIn('status', [ShiftStatus::ACTIVE, ShiftStatus::ON_BREAK])
                ->latest('started_at')
                ->lockForUpdate()
                ->first();

            if ($existingShift !== null) {
                // If it already has an active duty log, return existing shift
                if ($existingShift->activeDutyLog !== null) {
                    return $existingShift->load(['dutyLogs', 'activeDutyLog']);
                }

                // If existing shift has no active log, set to completed
                $existingShift->update([
                    'status' => ShiftStatus::COMPLETED,
                    'ended_at' => $now,
                ]);
            }

            /** @var OperatorShift $shift */
            $shift = OperatorShift::create([
                'user_id' => $user->id,
                'operational_asset_id' => $operationalAssetId,
                'dispatch_job_id' => $dispatchJobId,
                'status' => ShiftStatus::ACTIVE,
                'started_at' => $now,
                'remarks' => $remarks,
            ]);

            OperatorDutyLog::create([
                'operator_shift_id' => $shift->id,
                'user_id' => $user->id,
                'duty_status' => $initialDutyStatus,
                'is_demurrage_billable' => false,
                'started_at' => $now,
                'latitude' => $latitude,
                'longitude' => $longitude,
                'location_name' => $locationName,
                'remarks' => $remarks,
            ]);

            return $shift->load(['dutyLogs', 'activeDutyLog']);
        });
    }
}
