<?php

namespace App\Platform\Identity\Enums;

enum RoleName: string
{
    case SystemAdministrator = 'system_administrator';
    case OperationsManager = 'operations_manager';
    case Driver = 'driver';
    case CraneOperator = 'crane_operator';

    public function label(): string
    {
        return match ($this) {
            self::SystemAdministrator => 'System Administrator',
            self::OperationsManager => 'Operations Manager',
            self::Driver => 'Driver',
            self::CraneOperator => 'Crane Operator',
        };
    }

    public function prototypeValue(): string
    {
        return match ($this) {
            self::SystemAdministrator => 'administrator',
            self::OperationsManager => 'manager',
            self::CraneOperator => 'operator',
            default => $this->value,
        };
    }
}
