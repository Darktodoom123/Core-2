<?php

namespace App\Modules\Dispatch\Enums;

enum DispatchAttemptStatus: string
{
    case Draft = 'draft';
    case Dispatched = 'dispatched';
    case EnRoute = 'en_route';
    case Arrived = 'arrived';
    case Working = 'working';
    case Completed = 'completed';
    case Cancelled = 'cancelled';
}
