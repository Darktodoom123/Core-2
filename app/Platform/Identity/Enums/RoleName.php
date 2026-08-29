<?php

namespace App\Platform\Identity\Enums;

enum RoleName: string
{
    case SystemAdministrator = 'system_administrator';
    case OperationsManager = 'operations_manager';
    case SafetyOfficer = 'safety_officer';
    case FieldForeman = 'field_foreman';
    case CraneOperator = 'crane_operator';

    public function label(): string
    {
        return match ($this) {
            self::SystemAdministrator => 'System Administrator',
            self::OperationsManager => 'Operations Manager',
            self::SafetyOfficer => 'Safety Officer',
            self::FieldForeman => 'Field Foreman',
            self::CraneOperator => 'Operator',
        };
    }

    public function prototypeValue(): string
    {
        return match ($this) {
            self::SystemAdministrator => 'administrator',
            self::OperationsManager => 'manager',
            self::SafetyOfficer => 'safety_officer',
            self::FieldForeman => 'foreman',
            self::CraneOperator => 'operator',
        };
    }
}
