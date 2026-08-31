<?php

namespace App\Modules\HoursOfService\Queries;

use App\Modules\HoursOfService\Enums\DutyStatus;
use App\Modules\HoursOfService\Enums\ShiftStatus;
use App\Modules\HoursOfService\Models\OperatorDutyLog;
use App\Modules\HoursOfService\Models\OperatorShift;
use App\Platform\Identity\Models\User;
use Carbon\Carbon;

class CalculateHosClocksQuery
{
    public const MAX_DRIVE_MINUTES = 660; // 11 Hours

    public const MAX_SHIFT_WINDOW_MINUTES = 840; // 14 Hours

    public const MAX_CONTINUOUS_WORK_BEFORE_BREAK_MINUTES = 480; // 8 Hours

    public const MAX_CYCLE_MINUTES = 4200; // 70 Hours in 8 Days

    /**
     * @return array{
     *     shift_active: bool,
     *     shift_status: string,
     *     current_duty_status: string,
     *     started_at: string|null,
     *     hours_elapsed: float,
     *     drive_remaining_minutes: int,
     *     shift_window_remaining_minutes: int,
     *     break_countdown_minutes: int,
     *     cycle_remaining_minutes: int,
     *     cycle_accumulated_minutes: int,
     *     cycle_limit_minutes: int,
     *     timeline_segments: array<int, array<string, mixed>>,
     *     recent_logs: array<int, array<string, mixed>>,
     *     active_demurrage: bool,
     *     is_certified: bool
     * }
     */
    public function execute(User $user): array
    {
        $now = Carbon::now();
        $todayStart = Carbon::today();
        $eightDaysAgo = Carbon::now()->subDays(8)->startOfDay();

        /** @var OperatorShift|null $activeShift */
        $activeShift = OperatorShift::query()
            ->with(['dutyLogs', 'activeDutyLog'])
            ->where('user_id', $user->id)
            ->whereIn('status', [ShiftStatus::ACTIVE, ShiftStatus::ON_BREAK])
            ->latest('started_at')
            ->first();

        // 8-Day rolling cycle calculation
        $cycleDutyLogs = OperatorDutyLog::query()
            ->where('user_id', $user->id)
            ->whereIn('duty_status', [DutyStatus::OPERATING, DutyStatus::DRIVING, DutyStatus::STANDBY])
            ->where('started_at', '>=', $eightDaysAgo)
            ->get();

        $cycleMinutesLogged = (int) $cycleDutyLogs->sum(function (OperatorDutyLog $log) use ($now): int {
            if ($log->duration_minutes !== null) {
                return $log->duration_minutes;
            }

            $end = $log->ended_at ?? $now;

            return (int) max(0, $end->diffInMinutes($log->started_at));
        });

        $cycleRemainingMinutes = max(0, self::MAX_CYCLE_MINUTES - $cycleMinutesLogged);

        if ($activeShift === null) {
            /** @var OperatorShift|null $lastShift */
            $lastShift = OperatorShift::query()
                ->with(['dutyLogs'])
                ->where('user_id', $user->id)
                ->latest('started_at')
                ->first();

            return [
                'shift_active' => false,
                'shift_status' => ShiftStatus::COMPLETED->value,
                'current_duty_status' => DutyStatus::OFF_DUTY->value,
                'started_at' => $lastShift?->started_at?->toIso8601String(),
                'hours_elapsed' => 0.0,
                'drive_remaining_minutes' => self::MAX_DRIVE_MINUTES,
                'shift_window_remaining_minutes' => self::MAX_SHIFT_WINDOW_MINUTES,
                'break_countdown_minutes' => self::MAX_CONTINUOUS_WORK_BEFORE_BREAK_MINUTES,
                'cycle_remaining_minutes' => $cycleRemainingMinutes,
                'cycle_accumulated_minutes' => $cycleMinutesLogged,
                'cycle_limit_minutes' => self::MAX_CYCLE_MINUTES,
                'timeline_segments' => $this->buildTimelineSegments($user, $todayStart, $now),
                'recent_logs' => $this->buildRecentLogs($user, $todayStart),
                'active_demurrage' => false,
                'is_certified' => $lastShift !== null ? $lastShift->is_certified : false,
            ];
        }

        $shiftElapsedMinutes = (int) max(0, $now->diffInMinutes($activeShift->started_at));
        $hoursElapsed = round($shiftElapsedMinutes / 60, 2);

        // Active duty
        /** @var OperatorDutyLog|null $activeDutyLog */
        $activeDutyLog = $activeShift->activeDutyLog;
        $currentDuty = $activeDutyLog !== null ? $activeDutyLog->duty_status : DutyStatus::OPERATING;
        $activeDutyDuration = $activeDutyLog !== null ? (int) max(0, $now->diffInMinutes($activeDutyLog->started_at)) : 0;

        // Current drive/operating sum
        $operatingMinutes = $activeShift->operating_minutes + ($currentDuty === DutyStatus::OPERATING ? $activeDutyDuration : 0);
        $drivingMinutes = $activeShift->driving_minutes + ($currentDuty === DutyStatus::DRIVING ? $activeDutyDuration : 0);
        $driveOperatingTotal = $operatingMinutes + $drivingMinutes;

        $driveRemainingMinutes = max(0, self::MAX_DRIVE_MINUTES - $driveOperatingTotal);
        $shiftWindowRemainingMinutes = max(0, self::MAX_SHIFT_WINDOW_MINUTES - $shiftElapsedMinutes);

        // Break countdown (8 hours continuous work before break)
        $breakMinutesLogged = $activeShift->break_minutes;
        $continuousWork = $breakMinutesLogged > 0 ? max(0, $shiftElapsedMinutes - ($breakMinutesLogged * 2)) : $shiftElapsedMinutes;
        $breakCountdownMinutes = max(0, self::MAX_CONTINUOUS_WORK_BEFORE_BREAK_MINUTES - $continuousWork);

        return [
            'shift_active' => true,
            'shift_status' => $activeShift->status->value,
            'current_duty_status' => $currentDuty->value,
            'started_at' => $activeShift->started_at->toIso8601String(),
            'hours_elapsed' => $hoursElapsed,
            'drive_remaining_minutes' => $driveRemainingMinutes,
            'shift_window_remaining_minutes' => $shiftWindowRemainingMinutes,
            'break_countdown_minutes' => $breakCountdownMinutes,
            'cycle_remaining_minutes' => $cycleRemainingMinutes,
            'cycle_accumulated_minutes' => $cycleMinutesLogged,
            'cycle_limit_minutes' => self::MAX_CYCLE_MINUTES,
            'timeline_segments' => $this->buildTimelineSegments($user, $todayStart, $now),
            'recent_logs' => $this->buildRecentLogs($user, $todayStart),
            'active_demurrage' => $currentDuty === DutyStatus::STANDBY && ($activeDutyLog !== null && $activeDutyLog->is_demurrage_billable),
            'is_certified' => $activeShift->is_certified,
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function buildTimelineSegments(User $user, Carbon $startOfDay, Carbon $now): array
    {
        $logs = OperatorDutyLog::query()
            ->where('user_id', $user->id)
            ->where('started_at', '>=', $startOfDay)
            ->orderBy('started_at', 'asc')
            ->get();

        $segments = [];

        foreach ($logs as $log) {
            $endTime = $log->ended_at ?? $now;
            $duration = $log->duration_minutes ?? (int) max(0, $endTime->diffInMinutes($log->started_at));

            $segments[] = [
                'id' => $log->id,
                'status' => $log->duty_status->value,
                'status_label' => $log->duty_status->label(),
                'standby_reason' => $log->standby_reason?->value,
                'standby_reason_label' => $log->standby_reason?->label(),
                'is_demurrage_billable' => $log->is_demurrage_billable,
                'started_at' => $log->started_at->toIso8601String(),
                'ended_at' => $log->ended_at?->toIso8601String(),
                'duration_minutes' => $duration,
                'latitude' => $log->latitude,
                'longitude' => $log->longitude,
                'location_name' => $log->location_name,
                'remarks' => $log->remarks,
            ];
        }

        return $segments;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function buildRecentLogs(User $user, Carbon $startOfDay): array
    {
        return OperatorDutyLog::query()
            ->where('user_id', $user->id)
            ->where('started_at', '>=', $startOfDay)
            ->orderBy('started_at', 'desc')
            ->limit(10)
            ->get()
            ->map(fn (OperatorDutyLog $log): array => [
                'id' => $log->id,
                'duty_status' => $log->duty_status->value,
                'duty_label' => $log->duty_status->label(),
                'standby_reason' => $log->standby_reason?->value,
                'is_demurrage_billable' => $log->is_demurrage_billable,
                'started_at' => $log->started_at->format('h:i A'),
                'ended_at' => $log->ended_at ? $log->ended_at->format('h:i A') : 'Current',
                'duration_formatted' => sprintf(
                    '%dh %02dm',
                    floor(($log->duration_minutes ?? 0) / 60),
                    ($log->duration_minutes ?? 0) % 60,
                ),
                'location_name' => $log->location_name ?? 'Active Site',
                'remarks' => $log->remarks,
            ])
            ->all();
    }
}
