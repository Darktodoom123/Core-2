<?php

namespace App\Modules\Rental\Actions;

use App\Modules\Rental\Enums\RentalReservationStatus;
use App\Modules\Rental\Models\RentalCheckout;
use App\Modules\Rental\Models\RentalReservation;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Enums\AssetStatus;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class CheckoutRental
{
    public function __construct(private readonly RecordAuditEvent $audit) {}

    /** @param array<string, mixed> $attributes */
    public function handle(RentalReservation $reservation, User $actor, array $attributes): RentalReservation
    {
        return DB::transaction(function () use ($reservation, $actor, $attributes): RentalReservation {
            $locked = RentalReservation::query()->with('items')->lockForUpdate()->findOrFail($reservation->id);
            if (! $locked->status->canCheckout() || $locked->checkout()->exists()) {
                throw ValidationException::withMessages(['status' => 'Only reserved rentals can be checked out once.']);
            }
            $before = $locked->toArray();
            RentalCheckout::query()->create([
                'rental_reservation_id' => $locked->id,
                'checked_out_by' => $actor->id,
                'checked_out_at' => now(),
                'condition_before' => $attributes['condition'] ?? null,
                'notes' => $attributes['notes'] ?? null,
            ]);
            foreach ($locked->items as $item) {
                $asset = $item->asset()->lockForUpdate()->first();
                if ($asset !== null && $asset->status->dispatchable()) {
                    $asset->update(['status' => AssetStatus::Assigned]);
                }
            }
            $locked->update(['status' => RentalReservationStatus::CheckedOut]);
            $this->audit->handle($actor, $locked, 'rental_reservation.checked_out', $before, $locked->fresh()->toArray());

            return $locked->fresh(['items.asset', 'checkout', 'client']);
        });
    }
}
