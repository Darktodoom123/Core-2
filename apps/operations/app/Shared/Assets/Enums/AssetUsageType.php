<?php

namespace App\Shared\Assets\Enums;

enum AssetUsageType: string
{
    case RentalCreate = 'rental.create';
    case RentalApprove = 'rental.approve';
    case RentalCheckout = 'rental.checkout';
    case RentalReturn = 'rental.return';
    case DispatchAssign = 'dispatch.assign';
    case DispatchReassign = 'dispatch.reassign';
    case DispatchActivate = 'dispatch.activate';
    case AssetStatusChange = 'asset.status_change';

    public function requiresDispatchableAsset(): bool
    {
        return match ($this) {
            self::RentalCreate,
            self::RentalApprove,
            self::RentalCheckout,
            self::DispatchAssign,
            self::DispatchReassign,
            self::DispatchActivate => true,
            self::RentalReturn,
            self::AssetStatusChange => false,
        };
    }

    public function usesTimeWindow(): bool
    {
        return match ($this) {
            self::RentalCreate,
            self::RentalApprove,
            self::RentalCheckout,
            self::DispatchAssign,
            self::DispatchReassign,
            self::DispatchActivate => true,
            default => false,
        };
    }
}
