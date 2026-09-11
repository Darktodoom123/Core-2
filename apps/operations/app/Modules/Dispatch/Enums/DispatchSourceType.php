<?php

namespace App\Modules\Dispatch\Enums;

enum DispatchSourceType: string
{
    case Manual = 'manual';
    case ServiceRequest = 'service_request';
    case RentalReservation = 'rental_reservation';
    case SalesOrder = 'sales_order';

    public function label(): string
    {
        return match ($this) {
            self::Manual => 'Manual',
            self::ServiceRequest => 'Service',
            self::RentalReservation => 'Rental',
            self::SalesOrder => 'Sale',
        };
    }
}
