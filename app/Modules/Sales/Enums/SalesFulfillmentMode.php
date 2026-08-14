<?php

namespace App\Modules\Sales\Enums;

enum SalesFulfillmentMode: string
{
    case Delivery = 'delivery';
    case Pickup = 'pickup';

    public function requiresDispatch(): bool
    {
        return $this === self::Delivery;
    }
}
