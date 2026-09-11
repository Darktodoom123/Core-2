<?php

namespace App\Platform\Safety\Enums;

enum SosDeliveryAttemptStatus: string
{
    case Pending = 'pending';
    case Delivered = 'delivered';
    case Failed = 'failed';
    case Skipped = 'skipped';
}
