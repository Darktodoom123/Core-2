<?php

namespace App\Modules\Dvir\Enums;

enum DvirCheckStatus: string
{
    case GOOD = 'good';
    case ATTENTION = 'attention';
    case CRITICAL = 'critical';
    case PENDING = 'pending';

    public function isDefect(): bool
    {
        return match ($this) {
            self::ATTENTION, self::CRITICAL => true,
            self::GOOD, self::PENDING => false,
        };
    }
}
