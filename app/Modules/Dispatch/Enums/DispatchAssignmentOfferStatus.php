<?php

namespace App\Modules\Dispatch\Enums;

enum DispatchAssignmentOfferStatus: string
{
    case Proposed = 'proposed';
    case Offered = 'offered';
    case Accepted = 'accepted';
    case Rejected = 'rejected';
    case Withdrawn = 'withdrawn';
    case Expired = 'expired';
}
