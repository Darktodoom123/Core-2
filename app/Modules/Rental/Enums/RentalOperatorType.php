<?php

namespace App\Modules\Rental\Enums;

use App\Platform\Identity\Enums\RoleName;
use App\Shared\Assets\Models\OperationalAsset;

enum RentalOperatorType: string
{
    case Driver = 'driver';
    case CraneOperator = 'crane_operator';

    public function role(): RoleName
    {
        return match ($this) {
            self::Driver => RoleName::Driver,
            self::CraneOperator => RoleName::CraneOperator,
        };
    }

    public function credentialKind(): string
    {
        return match ($this) {
            self::Driver => 'driver_license',
            self::CraneOperator => 'operator_certification',
        };
    }

    public static function forAsset(OperationalAsset $asset): ?self
    {
        return match ($asset->kind) {
            'truck', 'vehicle' => self::Driver,
            'crane', 'equipment' => self::CraneOperator,
            default => null,
        };
    }
}
