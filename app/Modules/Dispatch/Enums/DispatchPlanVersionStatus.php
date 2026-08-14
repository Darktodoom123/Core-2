<?php

namespace App\Modules\Dispatch\Enums;

enum DispatchPlanVersionStatus: string
{
    case Draft = 'draft';
    case Submitted = 'submitted';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case Superseded = 'superseded';
}
