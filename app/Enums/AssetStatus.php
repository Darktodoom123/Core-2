<?php

namespace App\Enums;

enum AssetStatus: string
{
    case Available = 'available';
    case Assigned = 'assigned';
    case Working = 'working';
    case UnderInspection = 'under_inspection';
    case UnderMaintenance = 'under_maintenance';
    case AwaitingParts = 'awaiting_parts';
    case ReadyForService = 'ready_for_service';
    case Unavailable = 'unavailable';

    public function dispatchable(): bool
    {
        return in_array($this, [self::Available, self::ReadyForService], true);
    }
}
