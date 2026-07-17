<?php

namespace App\Enums;

enum DispatchPriority: string
{
    case Routine = 'routine';
    case Priority = 'priority';
    case Emergency = 'emergency';

    public function requiresApproval(): bool
    {
        return $this !== self::Routine;
    }
}
