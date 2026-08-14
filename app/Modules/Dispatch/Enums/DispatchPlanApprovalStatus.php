<?php

namespace App\Modules\Dispatch\Enums;

enum DispatchPlanApprovalStatus: string
{
    case Pending = 'pending';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case Superseded = 'superseded';
}
