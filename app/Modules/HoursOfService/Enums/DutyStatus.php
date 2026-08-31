<?php

namespace App\Modules\HoursOfService\Enums;

enum DutyStatus: string
{
    case OPERATING = 'operating';
    case DRIVING = 'driving';
    case STANDBY = 'standby';
    case ON_BREAK = 'on_break';
    case OFF_DUTY = 'off_duty';

    public function label(): string
    {
        return match ($this) {
            self::OPERATING => 'On Duty — Crane / Machine Operating',
            self::DRIVING => 'On Duty — Driving / Transit',
            self::STANDBY => 'On Duty — Standby / Delay (Demurrage)',
            self::ON_BREAK => 'On Break — 30-min Meal / Rest Period',
            self::OFF_DUTY => 'Off Duty — Shift Complete',
        };
    }

    public function isWorkingDuty(): bool
    {
        return match ($this) {
            self::OPERATING, self::DRIVING, self::STANDBY => true,
            self::ON_BREAK, self::OFF_DUTY => false,
        };
    }
}
