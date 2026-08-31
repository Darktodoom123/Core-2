<?php

namespace App\Modules\HoursOfService\Actions;

use App\Modules\HoursOfService\Enums\DutyStatus;
use App\Modules\HoursOfService\Enums\ShiftStatus;
use App\Modules\HoursOfService\Enums\StandbyReason;
use App\Modules\HoursOfService\Models\OperatorDutyLog;
use App\Modules\HoursOfService\Models\OperatorShift;
use App\Platform\Identity\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class RecordDutyStatusTransitionAction
{
    public function __construct(
        private readonly StartOperatorShiftAction $startShiftAction,
    ) {}

    public function execute(
        User $user,
        DutyStatus $nextStatus,
        ?StandbyReason $standbyReason = null,
        ?float $latitude = null,
        ?float $longitude = null,
        ?string $locationName = null,
        ?string $remarks = null,
    ): OperatorShift {
        return DB::transaction(function () use (
            $user,
            $nextStatus,
            $standbyReason,
            $latitude,
            $longitude,
            $locationName,
            $remarks,
        ): OperatorShift {
            $now = Carbon::now();

            /** @var OperatorShift|null $shift */
            $shift = OperatorShift::query()
                ->where('user_id', $user->id)
                ->whereIn('status', [ShiftStatus::ACTIVE, ShiftStatus::ON_BREAK])
                ->latest('started_at')
                ->first();

            // If no active shift exists and nextStatus is not off_duty, start a shift
            if ($shift === null) {
                if ($nextStatus === DutyStatus::OFF_DUTY) {
                    // Return latest completed shift or create completed snapshot
                    /** @var OperatorShift $lastShift */
                    $lastShift = OperatorShift::query()
                        ->where('user_id', $user->id)
                        ->latest('started_at')
                        ->firstOr(function () use ($user, $now): OperatorShift {
                            return OperatorShift::create([
                                'user_id' => $user->id,
                                'status' => ShiftStatus::COMPLETED,
                                'started_at' => $now,
                                'ended_at' => $now,
                            ]);
                        });

                    return $lastShift->load(['dutyLogs', 'activeDutyLog']);
                }

                return $this->startShiftAction->execute(
                    user: $user,
                    initialDutyStatus: $nextStatus,
                    latitude: $latitude,
                    longitude: $longitude,
                    locationName: $locationName,
                    remarks: $remarks,
                );
            }

            // Close the currently active duty log
            /** @var OperatorDutyLog|null $activeLog */
            $activeLog = OperatorDutyLog::query()
                ->where('operator_shift_id', $shift->id)
                ->whereNull('ended_at')
                ->latest('started_at')
                ->first();

            if ($activeLog !== null) {
                $duration = (int) max(0, $now->diffInMinutes($activeLog->started_at));
                $activeLog->update([
                    'ended_at' => $now,
                    'duration_minutes' => $duration,
                ]);

                // Update cumulative bucket on shift
                $this->accumulateShiftMinutes($shift, $activeLog->duty_status, $duration);
            }

            // If transitioning to off_duty, complete shift
            if ($nextStatus === DutyStatus::OFF_DUTY) {
                $shift->update([
                    'status' => ShiftStatus::COMPLETED,
                    'ended_at' => $now,
                ]);
            } else {
                // Update shift status (e.g. on_break vs active)
                $shiftStatus = $nextStatus === DutyStatus::ON_BREAK
                    ? ShiftStatus::ON_BREAK
                    : ShiftStatus::ACTIVE;

                $shift->update([
                    'status' => $shiftStatus,
                ]);

                // Create new duty log
                $isBillable = $nextStatus === DutyStatus::STANDBY && $standbyReason !== null
                    ? $standbyReason->isDemurrageBillable()
                    : false;

                OperatorDutyLog::create([
                    'operator_shift_id' => $shift->id,
                    'user_id' => $user->id,
                    'duty_status' => $nextStatus,
                    'standby_reason' => $standbyReason,
                    'is_demurrage_billable' => $isBillable,
                    'started_at' => $now,
                    'latitude' => $latitude,
                    'longitude' => $longitude,
                    'location_name' => $locationName,
                    'remarks' => $remarks,
                ]);
            }

            return $shift->fresh(['dutyLogs', 'activeDutyLog']);
        });
    }

    private function accumulateShiftMinutes(OperatorShift $shift, DutyStatus $dutyStatus, int $minutes): void
    {
        match ($dutyStatus) {
            DutyStatus::OPERATING => $shift->increment('operating_minutes', $minutes),
            DutyStatus::DRIVING => $shift->increment('driving_minutes', $minutes),
            DutyStatus::STANDBY => $shift->increment('standby_minutes', $minutes),
            DutyStatus::ON_BREAK => $shift->increment('break_minutes', $minutes),
            DutyStatus::OFF_DUTY => null,
        };
    }
}
