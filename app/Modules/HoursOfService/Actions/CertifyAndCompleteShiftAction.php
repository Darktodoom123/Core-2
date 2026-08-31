<?php

namespace App\Modules\HoursOfService\Actions;

use App\Modules\HoursOfService\Enums\DutyStatus;
use App\Modules\HoursOfService\Enums\ShiftStatus;
use App\Modules\HoursOfService\Models\OperatorDutyLog;
use App\Modules\HoursOfService\Models\OperatorShift;
use App\Platform\Identity\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class CertifyAndCompleteShiftAction
{
    public function execute(
        User $user,
        string $certificationStatement,
        ?string $remarks = null,
    ): OperatorShift {
        return DB::transaction(function () use ($user, $certificationStatement, $remarks): OperatorShift {
            $now = Carbon::now();

            /** @var OperatorShift|null $shift */
            $shift = OperatorShift::query()
                ->where('user_id', $user->id)
                ->whereIn('status', [ShiftStatus::ACTIVE, ShiftStatus::ON_BREAK])
                ->latest('started_at')
                ->first();

            if ($shift === null) {
                /** @var OperatorShift $lastShift */
                $lastShift = OperatorShift::query()
                    ->where('user_id', $user->id)
                    ->latest('started_at')
                    ->firstOrFail();

                $lastShift->update([
                    'is_certified' => true,
                    'certified_at' => $now,
                    'certification_statement' => $certificationStatement,
                    'remarks' => $remarks ?? $lastShift->remarks,
                ]);

                return $lastShift->load(['dutyLogs', 'activeDutyLog']);
            }

            // Close active duty log
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

                $this->accumulateShiftMinutes($shift, $activeLog->duty_status, $duration);
            }

            $shift->update([
                'status' => ShiftStatus::COMPLETED,
                'ended_at' => $now,
                'is_certified' => true,
                'certified_at' => $now,
                'certification_statement' => $certificationStatement,
                'remarks' => $remarks ?? $shift->remarks,
            ]);

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
