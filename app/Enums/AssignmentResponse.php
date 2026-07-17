<?php

namespace App\Enums;

enum AssignmentResponse: string
{
    case Pending = 'pending';
    case Accepted = 'accepted';
    case Rejected = 'rejected';
}
