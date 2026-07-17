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
}
