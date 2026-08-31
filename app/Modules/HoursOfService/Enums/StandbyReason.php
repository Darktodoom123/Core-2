<?php

namespace App\Modules\HoursOfService\Enums;

enum StandbyReason: string
{
    case WAITING_ON_CLIENT = 'waiting_on_client';
    case WAITING_ON_CONCRETE = 'waiting_on_concrete';
    case WEATHER_HOLD = 'weather_hold';
    case SITE_ACCESS_BLOCKED = 'site_access_blocked';
    case RIGGING_RECHECK = 'rigging_recheck';
    case INSPECTION_HOLD = 'inspection_hold';
    case OTHER = 'other';

    public function label(): string
    {
        return match ($this) {
            self::WAITING_ON_CLIENT => 'Client Site Delay (Billable Demurrage)',
            self::WAITING_ON_CONCRETE => 'Waiting on Concrete Mixer Pour',
            self::WEATHER_HOLD => 'Weather Hold (High Wind Anemometer Cutoff)',
            self::SITE_ACCESS_BLOCKED => 'Site Access / Road Ingress Blocked',
            self::RIGGING_RECHECK => 'Rigging & Outrigger Ground Re-checking',
            self::INSPECTION_HOLD => 'Mechanical Safety Walkaround Inspection',
            self::OTHER => 'Other Operational Standby Reason',
        };
    }

    public function isDemurrageBillable(): bool
    {
        return match ($this) {
            self::WAITING_ON_CLIENT, self::WAITING_ON_CONCRETE, self::SITE_ACCESS_BLOCKED => true,
            self::WEATHER_HOLD, self::RIGGING_RECHECK, self::INSPECTION_HOLD, self::OTHER => false,
        };
    }
}
