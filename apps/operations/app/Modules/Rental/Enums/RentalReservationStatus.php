<?php

namespace App\Modules\Rental\Enums;

enum RentalReservationStatus: string
{
    case Requested = 'requested';
    case Reserved = 'reserved';
    case CheckedOut = 'checked_out';
    case Returned = 'returned';
    case Closed = 'closed';

    public function canApprove(): bool
    {
        return $this === self::Requested;
    }

    public function canCheckout(): bool
    {
        return $this === self::Reserved;
    }

    public function canReturn(): bool
    {
        return $this === self::CheckedOut;
    }
}
