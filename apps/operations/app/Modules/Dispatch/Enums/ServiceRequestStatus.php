<?php

namespace App\Modules\Dispatch\Enums;

enum ServiceRequestStatus: string
{
    case Submitted = 'submitted';
    case Dispatching = 'dispatching';

    public function canCreateDispatch(): bool
    {
        return in_array($this, [self::Submitted, self::Dispatching], true);
    }

    public function label(): string
    {
        return match ($this) {
            self::Submitted => 'Submitted',
            self::Dispatching => 'Dispatching',
        };
    }
}
