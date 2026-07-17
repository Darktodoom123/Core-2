<?php

namespace App\Enums;

enum FuelRequestStatus: string
{
    case Submitted = 'submitted';
    case Forwarded = 'forwarded';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case Verified = 'verified';
    case Logged = 'logged';
}
