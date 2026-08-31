<?php

namespace App\Modules\HoursOfService\Enums;

enum ShiftStatus: string
{
    case ACTIVE = 'active';
    case ON_BREAK = 'on_break';
    case COMPLETED = 'completed';
    case LOCKED_OUT = 'locked_out';

    public function label(): string
    {
        return match ($this) {
            self::ACTIVE => 'Active Shift',
            self::ON_BREAK => 'On Break',
            self::COMPLETED => 'Shift Completed',
            self::LOCKED_OUT => 'Rest Lockout Active',
        };
    }
}
