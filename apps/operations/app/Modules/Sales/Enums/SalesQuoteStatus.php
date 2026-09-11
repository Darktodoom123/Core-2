<?php

namespace App\Modules\Sales\Enums;

enum SalesQuoteStatus: string
{
    case Draft = 'draft';
    case Accepted = 'accepted';
    case Rejected = 'rejected';
    case Expired = 'expired';
}
