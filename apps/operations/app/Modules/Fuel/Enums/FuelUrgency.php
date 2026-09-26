<?php

namespace App\Modules\Fuel\Enums;

enum FuelUrgency: string
{
    case Normal = 'normal';
    case Urgent = 'urgent';
    case Critical = 'critical';

    public function label(): string
    {
        return match ($this) {
            self::Normal => 'Normal',
            self::Urgent => 'Urgent',
            self::Critical => 'Critical — work stopped',
        };
    }

    /** Lower values sort first in review queues. */
    public function rank(): int
    {
        return match ($this) {
            self::Critical => 0,
            self::Urgent => 1,
            self::Normal => 2,
        };
    }
}
