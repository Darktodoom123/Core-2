<?php

namespace App\Shared\Assets\Enums;

enum UnitLinkReleaseReason: string
{
    case Released = 'released';
    case ShiftEnded = 'shift_ended';
    case Handover = 'handover';
    case SafetyLockout = 'safety_lockout';
}
