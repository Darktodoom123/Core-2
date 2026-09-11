<?php

namespace App\Modules\Dispatch\Enums;

enum DispatchReconciliationFindingSeverity: string
{
    case Warning = 'warning';
    case Blocker = 'blocker';
}
