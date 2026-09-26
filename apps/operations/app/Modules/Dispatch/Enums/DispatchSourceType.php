<?php

namespace App\Modules\Dispatch\Enums;

enum DispatchSourceType: string
{
    case Manual = 'manual';
    case ServiceRequest = 'service_request';
    case RentalReservation = 'rental_reservation';

    public function label(): string
    {
        return match ($this) {
            self::Manual => 'Manual',
            self::ServiceRequest => 'Service',
            self::RentalReservation => 'Rental',
        };
    }
}
