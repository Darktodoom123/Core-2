<?php

namespace App\Enums;

enum DispatchStatus: string
{
    case Draft = 'draft';
    case PendingApproval = 'pending_approval';
    case Scheduled = 'scheduled';
    case Dispatched = 'dispatched';
    case Accepted = 'accepted';
    case EnRoute = 'en_route';
    case Arrived = 'arrived';
    case Working = 'working';
    case Completed = 'completed';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draft',
            self::PendingApproval => 'Pending approval',
            self::Scheduled => 'Scheduled',
            self::Dispatched => 'Dispatched',
            self::Accepted => 'Accepted',
            self::EnRoute => 'En route',
            self::Arrived => 'Arrived',
            self::Working => 'Working',
            self::Completed => 'Completed',
            self::Cancelled => 'Cancelled',
        };
    }
}
