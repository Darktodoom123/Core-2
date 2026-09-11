<?php

namespace App\Modules\Dvir\Enums;

enum DvirInspectionType: string
{
    case PRE_TRIP = 'pre_trip';
    case POST_TRIP = 'post_trip';

    public function label(): string
    {
        return match ($this) {
            self::PRE_TRIP => 'Pre-Trip',
            self::POST_TRIP => 'Post-Trip',
        };
    }
}
