<?php

namespace App\Modules\Rental\Actions;

use App\Modules\Rental\Enums\RentalReservationStatus;
use App\Modules\Rental\Models\RentalReservation;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Models\OperationalAsset;
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
            foreach ($locked->items as $item) {
                $asset = OperationalAsset::query()->lockForUpdate()->find($item->operational_asset_id);
                if ($asset === null || ! $asset->status->dispatchable()) {
                    throw ValidationException::withMessages(['status' => 'One or more reserved equipment units are no longer available.']);
                }
                if (DB::table('sales_catalog_items')->where('operational_asset_id', $asset->id)->where('quantity_reserved', '>', 0)->exists()) {
                    throw ValidationException::withMessages(['status' => "Equipment {$asset->code} is reserved for a sale and cannot be rented."]);
                }

                $conflict = $item->newQuery()
                    ->where('operational_asset_id', $asset->id)
                    ->where('id', '<>', $item->id)
                    ->whereHas('reservation', fn ($query) => $query
                        ->whereIn('status', [
                            RentalReservationStatus::Requested->value,
                            RentalReservationStatus::Reserved->value,
                            RentalReservationStatus::CheckedOut->value,
                        ])
                        ->whereDate('start_date', '<=', $locked->end_date)
                        ->whereDate('end_date', '>=', $locked->start_date))
                    ->exists();

                if ($conflict) {
                    throw ValidationException::withMessages(['status' => 'One or more equipment units conflict with another reservation.']);
                }
            }
            $before = $locked->toArray();
            $locked->update(['status' => RentalReservationStatus::Reserved, 'approved_by' => $actor->id]);
            $this->audit->handle($actor, $locked, 'rental_reservation.approved', $before, $locked->fresh()->toArray());

            return $locked->fresh(['items.asset', 'client']);
        });
    }
}
