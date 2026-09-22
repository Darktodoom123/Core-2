<?php

namespace App\Modules\HoursOfService\Queries;

use App\Modules\HoursOfService\Enums\DutyStatus;
use App\Modules\HoursOfService\Enums\ShiftStatus;
use App\Modules\HoursOfService\Models\OperatorDutyLog;
use App\Modules\HoursOfService\Models\OperatorShift;
use App\Platform\Identity\Models\User;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Collection;

class CalculateHosClocksQuery
{
    public const MAX_DRIVE_MINUTES = 660; // 11 Hours

    public const MAX_SHIFT_WINDOW_MINUTES = 840; // 14 Hours

    public const DOLE_WARNING_MINUTES = 540; // 9 Hours of operating + driving

    public const DOLE_CAP_MINUTES = 600; // 10 Hours of operating + driving

    public const MAX_CONTINUOUS_WORK_BEFORE_BREAK_MINUTES = 480; // 8 Hours

    public const MAX_CYCLE_MINUTES = 4200; // 70 Hours in 8 Days

    /**
     * @return array{
     *     shift_active: bool,
     *     shift_status: string,
     *     current_duty_status: string,
     *     current_duty_status_label: string,
     *     duty_status: string,
     *     duty_status_label: string,
     *     started_at: string|null,
     *     current_duty_started_at: string|null,
     *     last_accepted_duty_at: string|null,
     *     shift_elapsed_minutes: int,
     *     hours_elapsed: float,
     *     operating_minutes: int|null,
     *     driving_minutes: int|null,
     *     standby_minutes: int|null,
     *     break_minutes: int|null,
     *     daily_operating_hours: float|null,
     *     limit_counter_minutes: int|null,
     *     limit_counter_label: string,
     *     drive_remaining_minutes: int,
     *     shift_window_remaining_minutes: int,
     *     break_countdown_minutes: int,
     *     cycle_remaining_minutes: int|null,
     *     cycle_accumulated_minutes: int|null,
     *     cycle_limit_minutes: int,
     *     timeline_segments: array<int, array<string, mixed>>,
     *     recent_logs: array<int, array<string, mixed>>,
     *     active_demurrage: bool,
     *     is_certified: bool,
     *     fatigue_status: string,
     *     dole_warning: bool,
     *     duty_history: array<int, array<string, mixed>>,
     *     equipment_usage: array<string, mixed>
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

            return (int) max(0, $log->started_at->diffInMinutes($end));
        });

        $cycleRemainingMinutes = max(0, self::MAX_CYCLE_MINUTES - $cycleMinutesLogged);

        if ($activeShift === null) {
            /** @var OperatorShift|null $lastShift */
            $lastShift = OperatorShift::query()
                ->with(['dutyLogs'])
                ->where('user_id', $user->id)
                ->latest('started_at')
                ->first();

            $shiftStart = $lastShift?->started_at;
            if ($lastShift !== null && $lastShift->dutyLogs->isNotEmpty()) {
                $earliestDutyLog = $lastShift->dutyLogs->sortBy('started_at')->first();
                if ($earliestDutyLog !== null && $earliestDutyLog->started_at->lt($shiftStart)) {
                    $shiftStart = $earliestDutyLog->started_at;
                }
            }

            $timelineStart = ($shiftStart !== null && ($lastShift?->ended_at === null || $lastShift->ended_at->gte($todayStart)) && $shiftStart->lt($todayStart))
                ? $shiftStart
                : $todayStart;

            return [
                'shift_active' => false,
                'shift_status' => ShiftStatus::COMPLETED->value,
                'current_duty_status' => DutyStatus::OFF_DUTY->value,
                'current_duty_status_label' => DutyStatus::OFF_DUTY->label(),
                'duty_status' => DutyStatus::OFF_DUTY->value,
                'duty_status_label' => $this->shortDutyStatusLabel(DutyStatus::OFF_DUTY),
                'started_at' => $lastShift?->started_at?->toIso8601String(),
                'current_duty_started_at' => null,
                'last_accepted_duty_at' => $lastShift?->updated_at?->toIso8601String(),
                'shift_elapsed_minutes' => 0,
                'hours_elapsed' => 0.0,
                'operating_minutes' => null,
                'driving_minutes' => null,
                'standby_minutes' => null,
                'break_minutes' => null,
                'daily_operating_hours' => null,
                'limit_counter_minutes' => null,
                'limit_counter_label' => 'Operating + driving',
                'drive_remaining_minutes' => self::MAX_DRIVE_MINUTES,
                'shift_window_remaining_minutes' => self::MAX_SHIFT_WINDOW_MINUTES,
                'break_countdown_minutes' => self::MAX_CONTINUOUS_WORK_BEFORE_BREAK_MINUTES,
                'cycle_remaining_minutes' => $cycleRemainingMinutes,
                'cycle_accumulated_minutes' => $cycleMinutesLogged,
                'cycle_limit_minutes' => self::MAX_CYCLE_MINUTES,
                'timeline_segments' => $this->buildTimelineSegments($user, $timelineStart, $now),
                'recent_logs' => $this->buildRecentLogs($user, $timelineStart),
                'active_demurrage' => false,
                'is_certified' => $lastShift !== null ? $lastShift->is_certified : false,
                'fatigue_status' => 'normal',
                'dole_warning' => false,
                'duty_history' => [],
                'equipment_usage' => [
                    'policy_applied' => false,
                    'policy_key' => null,
                    'allowed_duty_statuses' => [],
                    'estimated_minutes' => null,
                    'estimated_hours' => null,
                    'source' => 'No active shift',
                    'operating_minutes' => 0,
                    'driving_minutes' => 0,
                    'standby_minutes' => 0,
                    'break_minutes' => 0,
                ],
            ];
        }

        $shiftStart = $activeShift->started_at;
        if ($activeShift->dutyLogs->isNotEmpty()) {
            $earliestDutyLog = $activeShift->dutyLogs->sortBy('started_at')->first();
            if ($earliestDutyLog !== null && $earliestDutyLog->started_at->lt($shiftStart)) {
                $shiftStart = $earliestDutyLog->started_at;
            }
        }
        $timelineStart = $shiftStart->lt($todayStart) ? $shiftStart : $todayStart;

        return array_merge($this->activeShiftSummary($activeShift, $cycleMinutesLogged), [
            'cycle_remaining_minutes' => $cycleRemainingMinutes,
            'cycle_accumulated_minutes' => $cycleMinutesLogged,
            'cycle_limit_minutes' => self::MAX_CYCLE_MINUTES,
            'timeline_segments' => $this->buildTimelineSegments($user, $timelineStart, $now),
            'recent_logs' => $this->buildRecentLogs($user, $timelineStart),
        ]);
    }

    /**
     * Calculate the canonical live summary for an already-loaded active shift.
     * This is shared by the operator HOS endpoint and the asset workspace view.
     *
     * @return array{
     *     shift_active: bool,
     *     shift_status: string,
     *     current_duty_status: string,
     *     current_duty_status_label: string,
     *     duty_status: string,
     *     duty_status_label: string,
     *     started_at: string,
     *     current_duty_started_at: string|null,
     *     last_accepted_duty_at: string,
     *     server_time: string,
     *     shift_elapsed_minutes: int,
     *     hours_elapsed: float,
     *     operating_minutes: int,
     *     driving_minutes: int,
     *     standby_minutes: int,
     *     break_minutes: int,
     *     daily_operating_hours: float,
     *     limit_counter_minutes: int,
     *     limit_counter_label: string,
     *     drive_remaining_minutes: int,
     *     shift_window_remaining_minutes: int,
     *     break_countdown_minutes: int,
     *     cycle_remaining_minutes: int|null,
     *     cycle_accumulated_minutes: int|null,
     *     cycle_limit_minutes: int,
     *     active_demurrage: bool,
     *     is_certified: bool,
     *     fatigue_status: string,
     *     dole_warning: bool,
     *     duty_history: array<int, array<string, mixed>>,
     *     equipment_usage: array<string, mixed>
     * }
     */
    public function activeShiftSummary(OperatorShift $activeShift, ?int $cycleMinutesLogged = null): array
    {
        $now = Carbon::now();
        $activeShift->loadMissing([
            'activeDutyLog.operationalAsset',
            'dutyLogs.operationalAsset',
            'operationalAsset',
        ]);

        /** @var OperatorDutyLog|null $activeDutyLog */
        $activeDutyLog = $activeShift->activeDutyLog;
        $currentDuty = $activeDutyLog !== null
            ? $activeDutyLog->duty_status
            : DutyStatus::OFF_DUTY;
        $activeDutyDuration = $activeDutyLog !== null
            ? (int) max(0, $activeDutyLog->started_at->diffInMinutes($now))
            : 0;
        $shiftElapsedMinutes = (int) max(0, $activeShift->started_at->diffInMinutes($now));
        $hoursElapsed = round($shiftElapsedMinutes / 60, 2);

        $operatingMinutes = $activeShift->operating_minutes
            + ($currentDuty === DutyStatus::OPERATING ? $activeDutyDuration : 0);
        $drivingMinutes = $activeShift->driving_minutes
            + ($currentDuty === DutyStatus::DRIVING ? $activeDutyDuration : 0);
        $standbyMinutes = $activeShift->standby_minutes
            + ($currentDuty === DutyStatus::STANDBY ? $activeDutyDuration : 0);
        $breakMinutes = $activeShift->break_minutes
            + ($currentDuty === DutyStatus::ON_BREAK ? $activeDutyDuration : 0);
        $driveOperatingTotal = $operatingMinutes + $drivingMinutes;

        $driveRemainingMinutes = max(0, self::MAX_DRIVE_MINUTES - $driveOperatingTotal);
        $shiftWindowRemainingMinutes = max(0, self::MAX_SHIFT_WINDOW_MINUTES - $shiftElapsedMinutes);
        $continuousWork = $breakMinutes > 0
            ? max(0, $shiftElapsedMinutes - ($breakMinutes * 2))
            : $shiftElapsedMinutes;
        $breakCountdownMinutes = max(0, self::MAX_CONTINUOUS_WORK_BEFORE_BREAK_MINUTES - $continuousWork);
        $cycleRemainingMinutes = $cycleMinutesLogged === null
            ? null
            : max(0, self::MAX_CYCLE_MINUTES - $cycleMinutesLogged);
        $lastAcceptedDutyAt = $activeDutyLog !== null
            ? ($activeDutyLog->accepted_at ?? $activeDutyLog->created_at)
            : null;
        $lastAcceptedDutyAt ??= $activeShift->updated_at;

        $doleWarning = $driveOperatingTotal >= self::DOLE_WARNING_MINUTES;
        $fatigueStatus = match (true) {
            $shiftWindowRemainingMinutes <= 0
                || $driveRemainingMinutes <= 0
                || $breakCountdownMinutes <= 0
                || ($cycleRemainingMinutes !== null && $cycleRemainingMinutes <= 0)
                || $driveOperatingTotal > self::DOLE_CAP_MINUTES => 'violation',
            $shiftWindowRemainingMinutes <= 60
                || $driveRemainingMinutes <= 60
                || $breakCountdownMinutes <= 30
                || $driveOperatingTotal >= self::DOLE_CAP_MINUTES => 'critical',
            $shiftWindowRemainingMinutes <= 120
                || $driveRemainingMinutes <= 120
                || $breakCountdownMinutes <= 60
                || $driveOperatingTotal >= self::DOLE_WARNING_MINUTES => 'warning',
            default => 'normal',
        };

        return [
            'shift_active' => true,
            'shift_status' => $activeShift->status->value,
            'current_duty_status' => $currentDuty->value,
            'current_duty_status_label' => $currentDuty->label(),
            'duty_status' => $currentDuty->value,
            'duty_status_label' => $this->shortDutyStatusLabel($currentDuty),
            'started_at' => $activeShift->started_at->toIso8601String(),
            'current_duty_started_at' => $activeDutyLog?->started_at?->toIso8601String(),
            'last_accepted_duty_at' => $lastAcceptedDutyAt->toIso8601String(),
            'server_time' => $now->toIso8601String(),
            'shift_elapsed_minutes' => $shiftElapsedMinutes,
            'hours_elapsed' => $hoursElapsed,
            'operating_minutes' => $operatingMinutes,
            'driving_minutes' => $drivingMinutes,
            'standby_minutes' => $standbyMinutes,
            'break_minutes' => $breakMinutes,
            'daily_operating_hours' => round($driveOperatingTotal / 60, 2),
            'limit_counter_minutes' => $driveOperatingTotal,
            'limit_counter_label' => 'Operating + driving',
            'drive_remaining_minutes' => $driveRemainingMinutes,
            'shift_window_remaining_minutes' => $shiftWindowRemainingMinutes,
            'break_countdown_minutes' => $breakCountdownMinutes,
            'cycle_remaining_minutes' => $cycleRemainingMinutes,
            'cycle_accumulated_minutes' => $cycleMinutesLogged,
            'cycle_limit_minutes' => self::MAX_CYCLE_MINUTES,
            'active_demurrage' => $currentDuty === DutyStatus::STANDBY
                && $activeDutyLog !== null
                && $activeDutyLog->is_demurrage_billable,
            'is_certified' => $activeShift->is_certified,
            'fatigue_status' => $fatigueStatus,
            'dole_warning' => $doleWarning,
            'duty_history' => $this->serializeDutyHistory($activeShift->dutyLogs, $now),
            'equipment_usage' => $this->equipmentUsageSummary($activeShift, $now),
        ];
    }

    /**
     * Keep the event audit trail separate from the live HOS counters. Every
     * item here is a server-accepted duty log; pending mobile commands never
     * reach this query.
     *
     * @param  Collection<int, OperatorDutyLog>  $logs
     * @return array<int, array<string, mixed>>
     */
    private function serializeDutyHistory(Collection $logs, CarbonInterface $now): array
    {
        return $logs
            ->sortBy('started_at')
            ->values()
            ->map(function (OperatorDutyLog $log) use ($now): array {
                $duration = $log->duration_minutes ?? (int) max(0, $log->started_at->diffInMinutes($log->ended_at ?? $now));
                $freshness = $log->location_freshness
                    ?? ($log->latitude !== null && $log->longitude !== null ? 'last_known' : 'unavailable');

                return [
                    'id' => $log->id,
                    'previous_duty_status' => $log->previous_duty_status?->value,
                    'previous_duty_status_label' => $log->previous_duty_status?->label(),
                    'new_duty_status' => $log->duty_status->value,
                    'new_duty_status_label' => $log->duty_status->label(),
                    'duty_status' => $log->duty_status->value,
                    'duty_status_label' => $log->duty_status->label(),
                    'started_at' => $log->started_at->toIso8601String(),
                    'ended_at' => $log->ended_at?->toIso8601String(),
                    'occurred_at' => ($log->occurred_at ?? $log->started_at)->toIso8601String(),
                    'accepted_at' => ($log->accepted_at ?? $log->created_at)->toIso8601String(),
                    'duration_minutes' => $duration,
                    'operational_asset_id' => $log->operational_asset_id,
                    'dispatch_job_id' => $log->dispatch_job_id,
                    'equipment_code' => $log->operationalAsset?->code,
                    'equipment_name' => $log->operationalAsset?->name,
                    'standby_reason' => $log->standby_reason?->value,
                    'standby_reason_label' => $log->standby_reason?->label(),
                    'is_demurrage_billable' => $log->is_demurrage_billable,
                    'latitude' => $log->latitude,
                    'longitude' => $log->longitude,
                    'accuracy_metres' => $log->accuracy_metres,
                    'location_observed_at' => $log->location_observed_at?->toIso8601String(),
                    'location_source' => $log->location_source,
                    'location_freshness' => $freshness,
                    'location_label' => match ($freshness) {
                        'fresh' => $log->location_name ?? 'GPS position',
                        'last_known' => 'Last known location',
                        default => 'Location unavailable',
                    },
                    'location_name' => $log->location_name,
                    'remarks' => $log->remarks,
                ];
            })
            ->all();
    }

    /**
     * Estimate equipment use only when a configured equipment-kind policy
     * explicitly names the duty statuses that count. The official meter is
     * deliberately absent from this calculation.
     *
     * @return array<string, mixed>
     */
    private function equipmentUsageSummary(OperatorShift $shift, CarbonInterface $now): array
    {
        $buckets = [
            DutyStatus::OPERATING->value => 0,
            DutyStatus::DRIVING->value => 0,
            DutyStatus::STANDBY->value => 0,
            DutyStatus::ON_BREAK->value => 0,
        ];

        foreach ($shift->dutyLogs as $log) {
            // A policy cannot turn an operator-only event into equipment use.
            if ($log->operational_asset_id === null || $log->operational_asset_id !== $shift->operational_asset_id) {
                continue;
            }

            // New rows always have accepted_at. The migration backfills that
            // field for legacy rows, so a null value is not server-accepted.
            if ($log->accepted_at === null) {
                continue;
            }

            $status = $log->duty_status->value;
            if (! array_key_exists($status, $buckets)) {
                continue;
            }

            $buckets[$status] += $log->duration_minutes
                ?? (int) max(0, $log->started_at->diffInMinutes($log->ended_at ?? $now));
        }

        $kind = $shift->operationalAsset?->kind;
        $policies = config('hours_of_service.equipment_usage_policies', []);
        $policy = is_array($policies) && $kind !== null && is_array($policies[$kind] ?? null)
            ? $policies[$kind]
            : null;
        $allowedStatuses = is_array($policy) && is_array($policy['statuses'] ?? null)
            ? array_values(array_intersect(array_keys($buckets), $policy['statuses']))
            : [];

        $estimatedMinutes = $policy !== null
            ? array_sum(array_intersect_key($buckets, array_flip($allowedStatuses)))
            : null;

        return [
            'policy_applied' => $policy !== null,
            'policy_key' => $kind,
            'allowed_duty_statuses' => $allowedStatuses,
            'estimated_minutes' => $estimatedMinutes,
            'estimated_hours' => $estimatedMinutes === null ? null : round($estimatedMinutes / 60, 2),
            'source' => $policy === null
                ? 'Accepted linked intervals; no equipment usage policy configured'
                : 'Accepted linked intervals only',
            'operating_minutes' => $buckets[DutyStatus::OPERATING->value],
            'driving_minutes' => $buckets[DutyStatus::DRIVING->value],
            'standby_minutes' => $buckets[DutyStatus::STANDBY->value],
            'break_minutes' => $buckets[DutyStatus::ON_BREAK->value],
        ];
    }

    private function shortDutyStatusLabel(DutyStatus $status): string
    {
        return match ($status) {
            DutyStatus::OPERATING => 'Operating',
            DutyStatus::DRIVING => 'Driving',
            DutyStatus::STANDBY => 'Standby',
            DutyStatus::ON_BREAK => 'On Break',
            DutyStatus::OFF_DUTY => 'Off Duty',
        };
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function buildTimelineSegments(User $user, CarbonInterface $startOfDay, CarbonInterface $now): array
    {
        $logs = OperatorDutyLog::query()
            ->where('user_id', $user->id)
            ->where('started_at', '>=', $startOfDay)
            ->orderBy('started_at', 'asc')
            ->get();

        $segments = [];

        foreach ($logs as $log) {
            $endTime = $log->ended_at ?? $now;
            $duration = $log->duration_minutes ?? (int) max(0, $log->started_at->diffInMinutes($endTime));

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
                'occurred_at' => ($log->occurred_at ?? $log->started_at)->toIso8601String(),
                'accepted_at' => ($log->accepted_at ?? $log->created_at)->toIso8601String(),
                'previous_duty_status' => $log->previous_duty_status?->value,
                'latitude' => $log->latitude,
                'longitude' => $log->longitude,
                'accuracy_metres' => $log->accuracy_metres,
                'location_observed_at' => $log->location_observed_at?->toIso8601String(),
                'location_source' => $log->location_source,
                'location_freshness' => $log->location_freshness
                    ?? ($log->latitude !== null && $log->longitude !== null ? 'last_known' : 'unavailable'),
                'location_name' => $log->location_name,
                'remarks' => $log->remarks,
            ];
        }

        return $segments;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function buildRecentLogs(User $user, CarbonInterface $startOfDay): array
    {
        $now = Carbon::now();

        return OperatorDutyLog::query()
            ->where('user_id', $user->id)
            ->where('started_at', '>=', $startOfDay)
            ->orderBy('started_at', 'desc')
            ->limit(10)
            ->get()
            ->map(function (OperatorDutyLog $log) use ($now): array {
                $durationMinutes = $log->duration_minutes ?? (int) max(0, $log->started_at->diffInMinutes($log->ended_at ?? $now));

                return [
                    'id' => $log->id,
                    'duty_status' => $log->duty_status->value,
                    'duty_label' => $log->duty_status->label(),
                    'standby_reason' => $log->standby_reason?->value,
                    'is_demurrage_billable' => $log->is_demurrage_billable,
                    'started_at' => $log->started_at->format('h:i A'),
                    'ended_at' => $log->ended_at ? $log->ended_at->format('h:i A') : 'Current',
                    'duration_formatted' => sprintf(
                        '%dh %02dm',
                        floor($durationMinutes / 60),
                        $durationMinutes % 60,
                    ),
                    'occurred_at' => ($log->occurred_at ?? $log->started_at)->toIso8601String(),
                    'accepted_at' => ($log->accepted_at ?? $log->created_at)->toIso8601String(),
                    'location_freshness' => $log->location_freshness
                        ?? ($log->latitude !== null && $log->longitude !== null ? 'last_known' : 'unavailable'),
                    'location_label' => $log->location_freshness === 'fresh'
                        ? ($log->location_name ?? 'GPS position')
                        : ($log->latitude !== null && $log->longitude !== null ? 'Last known location' : 'Location unavailable'),
                    'location_name' => $log->location_name ?? 'Active Site',
                    'remarks' => $log->remarks,
                ];
            })
            ->all();
    }
}
