<?php

namespace App\Modules\Rental\Enums;

enum RentalFulfillmentMode: string
{
    case Delivery = 'delivery';
    case Pickup = 'pickup';

    public function requiresDispatch(): bool
    {
        return $this === self::Delivery;
    }
}
