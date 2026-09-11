<?php

namespace App\Modules\Dispatch\Enums;

enum DispatchEmergencyOverrideStatus: string
{
    case Proposed = 'proposed';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case Expired = 'expired';
    case Consumed = 'consumed';

    public function terminal(): bool
    {
        return in_array($this, [self::Rejected, self::Expired, self::Consumed], true);
    }
}
