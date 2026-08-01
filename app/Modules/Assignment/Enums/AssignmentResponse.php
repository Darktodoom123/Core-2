<?php

namespace App\Modules\Assignment\Enums;

enum AssignmentResponse: string
{
    case Pending = 'pending';
    case Accepted = 'accepted';
    case Rejected = 'rejected';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Pending response',
            self::Accepted => 'Accepted',
            self::Rejected => 'Rejected',
        };
    }
}
