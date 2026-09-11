<?php

namespace App\Modules\Dispatch\Enums;

enum DispatchReconciliationRunStatus: string
{
    case Running = 'running';
    case Completed = 'completed';
    case Failed = 'failed';
}
