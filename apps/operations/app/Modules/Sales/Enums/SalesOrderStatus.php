<?php

namespace App\Modules\Sales\Enums;

enum SalesOrderStatus: string
{
    case Confirmed = 'confirmed';
    case Fulfilled = 'fulfilled';
    case Transferred = 'transferred';
    case Cancelled = 'cancelled';
}
