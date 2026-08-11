<?php

namespace App\Modules\Rental\Actions;

use App\Modules\Rental\Enums\RentalReservationStatus;
use App\Modules\Rental\Models\RentalReservation;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class ApproveRentalReservation
{
    public function __construct(private readonly RecordAuditEvent $audit) {}

    public function handle(RentalReservation $reservation, User $actor): RentalReservation
    {
        return DB::transaction(function () use ($reservation, $actor): RentalReservation {
            $locked = RentalReservation::query()->with('items')->lockForUpdate()->findOrFail($reservation->id);
            $status = $locked->status;
            if (! $status->canApprove()) {
                throw ValidationException::withMessages(['status' => 'Only requested reservations can be approved.']);
            }
            $before = $locked->toArray();
            $locked->update(['status' => RentalReservationStatus::Reserved, 'approved_by' => $actor->id]);
            $this->audit->handle($actor, $locked, 'rental_reservation.approved', $before, $locked->fresh()->toArray());

            return $locked->fresh(['items.asset', 'client']);
        });
    }
}
