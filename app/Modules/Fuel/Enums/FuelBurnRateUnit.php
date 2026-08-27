<?php

namespace App\Modules\Fuel\Enums;

enum FuelBurnRateUnit: string
{
    case LitresPerKm = 'L/km';
    case LitresPerHour = 'L/hr';

    public function label(): string
    {
        return match ($this) {
            self::LitresPerKm => 'Litres per Kilometre (L/km)',
            self::LitresPerHour => 'Litres per Hour (L/hr)',
        };
    }
}
