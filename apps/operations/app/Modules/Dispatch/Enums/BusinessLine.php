<?php

namespace App\Modules\Dispatch\Enums;

enum BusinessLine: string
{
    case Rental = 'rental';
    case Sales = 'sales';
    case Service = 'service';
}
