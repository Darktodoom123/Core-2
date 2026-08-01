<?php

namespace App\Modules\Fuel\Enums;

enum FuelRequestStatus: string
{
    case Submitted = 'submitted';
    case Forwarded = 'forwarded';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case Verified = 'verified';
    case Logged = 'logged';

    public function label(): string
    {
        return match ($this) {
            self::Submitted => 'Submitted',
            self::Forwarded => 'Forwarded',
            self::Approved => 'Approved',
            self::Rejected => 'Rejected',
            self::Verified => 'Verified',
            self::Logged => 'Logged',
        };
    }
}
