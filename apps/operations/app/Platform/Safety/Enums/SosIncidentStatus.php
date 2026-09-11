<?php

namespace App\Platform\Safety\Enums;

enum SosIncidentStatus: string
{
    case Active = 'active';
    case Escalated = 'escalated';
    case Acknowledged = 'acknowledged';
    case Resolved = 'resolved';
    case Cancelled = 'cancelled';

    public function isTerminal(): bool
    {
        return in_array($this, [self::Resolved, self::Cancelled], true);
    }

    public function isUnresolved(): bool
    {
        return ! $this->isTerminal();
    }
}
