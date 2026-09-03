<?php

namespace App\Platform\Identity\Enums;

enum RoleName: string
{
    case SystemAdministrator = 'system_administrator';
    case OperationsManager = 'operations_manager';
    case CraneOperator = 'crane_operator';
    case Rigger = 'rigger';

    public function label(): string
    {
        return match ($this) {
            self::SystemAdministrator => 'System Administrator',
            self::OperationsManager => 'Operations Manager',
            self::CraneOperator => 'Operator',
            self::Rigger => 'Rigger / Signalperson',
        };
    }

    public function prototypeValue(): string
    {
        return match ($this) {
            self::SystemAdministrator => 'administrator',
            self::OperationsManager => 'manager',
            self::CraneOperator => 'operator',
            self::Rigger => 'rigger',
        };
    }
}
