<?php

namespace App\Modules\Dispatch\Enums;

enum DispatchPriority: string
{
    case Routine = 'routine';
    case Priority = 'priority';
    case Emergency = 'emergency';

    public function requiresApproval(): bool
    {
        return true;
    }

    public function label(): string
    {
        return match ($this) {
            self::Routine => 'Routine',
            self::Priority => 'Priority',
            self::Emergency => 'Emergency',
        };
    }
}
