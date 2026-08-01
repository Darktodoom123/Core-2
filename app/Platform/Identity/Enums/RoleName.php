<?php

namespace App\Platform\Identity\Enums;

enum RoleName: string
{
    case SystemAdministrator = 'system_administrator';
    case Dispatcher = 'dispatcher';
    case OperationsManager = 'operations_manager';
    case Driver = 'driver';
    case CraneOperator = 'crane_operator';
    case FieldTechnician = 'field_technician';

    public function label(): string
    {
        return match ($this) {
            self::SystemAdministrator => 'System Administrator',
            self::Dispatcher => 'Dispatcher',
            self::OperationsManager => 'Operations Manager',
            self::Driver => 'Driver',
            self::CraneOperator => 'Crane Operator',
            self::FieldTechnician => 'Field Technician',
        };
    }

    public function prototypeValue(): string
    {
        return match ($this) {
            self::SystemAdministrator => 'administrator',
            self::OperationsManager => 'manager',
            self::CraneOperator => 'operator',
            self::FieldTechnician => 'technician',
            default => $this->value,
        };
    }
}
