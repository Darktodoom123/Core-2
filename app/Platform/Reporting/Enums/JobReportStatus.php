<?php

namespace App\Platform\Reporting\Enums;

enum JobReportStatus: string
{
    case Draft = 'draft';
    case Submitted = 'submitted';
    case Approved = 'approved';
    case Rejected = 'rejected';
}
