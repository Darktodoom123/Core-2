<?php

namespace App\Modules\Rental\Support;

use App\Modules\Rental\Models\RentalReservation;
use Illuminate\Support\Arr;

final class RentalAuditSnapshot
{
    /** @return array<string, mixed> */
    public static function fromReservation(RentalReservation $reservation): array
    {
        return Arr::only($reservation->toArray(), [
            'id',
            'reference',
            'client_id',
            'created_by',
            'approved_by',
            'dispatch_job_id',
            'status',
            'start_date',
            'end_date',
            'fulfillment_mode',
            'total_cents',
            'created_at',
            'updated_at',
            'deleted_at',
        ]);
    }
}
