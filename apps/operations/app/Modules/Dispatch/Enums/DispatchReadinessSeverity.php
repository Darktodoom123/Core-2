<?php

namespace App\Modules\Dispatch\Enums;

enum DispatchReadinessSeverity: string
{
    case Blocking = 'blocking';
    case Warning = 'warning';
}
