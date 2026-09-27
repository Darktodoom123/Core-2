<?php

namespace App\Modules\HoursOfService\Support;

use App\Modules\HoursOfService\Enums\DutyStatus;
use App\Modules\HoursOfService\Models\OperatorDutyLog;
use App\Modules\HoursOfService\Models\OperatorShift;
use Carbon\CarbonInterface;
use Illuminate\Validation\ValidationException;

/**
 * The DOLE-OSHC operating limit: operating + driving time in a shift, with a
 * warning at 9 hours and a hard stop at 10. Standby, breaks and going off
 * duty are always allowed.
 */
final class DoleOperatingLimit
{
    public const WARNING_MINUTES = 540;

    public const CAP_MINUTES = 600;

    /** Operating + driving minutes the shift has used up to $at. */
    public static function minutesUsed(OperatorShift $shift, ?OperatorDutyLog $activeLog, CarbonInterface $at): int
    {
        $running = $activeLog !== null
            && in_array($activeLog->duty_status, [DutyStatus::OPERATING, DutyStatus::DRIVING], true)
                ? (int) max(0, $activeLog->started_at->diffInMinutes($at))
                : 0;

        return (int) $shift->operating_minutes + (int) $shift->driving_minutes + $running;
    }

    public static function counts(DutyStatus $status): bool
    {
        return $status === DutyStatus::OPERATING || $status === DutyStatus::DRIVING;
    }

    /**
     * Refuse a switch to operating or driving once the shift has reached the
     * 10-hour cap.
     *
     * @throws ValidationException
     */
    public static function assertMayStart(DutyStatus $target, OperatorShift $shift, ?OperatorDutyLog $activeLog, CarbonInterface $at): void
    {
        if (! self::counts($target) || self::minutesUsed($shift, $activeLog, $at) < self::CAP_MINUTES) {
            return;
        }

        throw ValidationException::withMessages([
            'duty_status' => 'DOLE-OSHC 10-hour limit reached for this shift. Operating and driving are blocked; switch to standby or a break, or end your shift.',
        ]);
    }
}
