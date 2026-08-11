<?php

namespace App\Modules\Rental\Actions;

use App\Modules\Rental\Enums\RentalReservationStatus;
use App\Modules\Rental\Models\RentalReservation;
use App\Modules\Rental\Models\RentalReturnRecord;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Enums\AssetStatus;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class ReturnRental
{
    public function __construct(private readonly RecordAuditEvent $audit) {}

    /** @param array<string, mixed> $attributes */
    public function handle(RentalReservation $reservation, User $actor, array $attributes): RentalReservation
    {
        return DB::transaction(function () use ($reservation, $actor, $attributes): RentalReservation {
            $locked = RentalReservation::query()->with('items')->lockForUpdate()->findOrFail($reservation->id);
            if (! $locked->status->canReturn() || $locked->returnRecord()->exists()) {
                throw ValidationException::withMessages(['status' => 'Only checked-out rentals can be returned once.']);
            }
            $before = $locked->toArray();
            RentalReturnRecord::query()->create([
                'rental_reservation_id' => $locked->id,
                'returned_by' => $actor->id,
                'returned_at' => now(),
                'condition_after' => $attributes['condition'] ?? null,
                'damage_notes' => $attributes['damage_notes'] ?? null,
            ]);
            foreach ($locked->items as $item) {
                $asset = $item->asset()->lockForUpdate()->first();
                if ($asset !== null && $asset->status === AssetStatus::Assigned) {
                    $asset->update(['status' => AssetStatus::Available]);
                }
            }
            $locked->update(['status' => RentalReservationStatus::Returned]);
            $this->audit->handle($actor, $locked, 'rental_reservation.returned', $before, $locked->fresh()->toArray());

            return $locked->fresh(['items.asset', 'returnRecord', 'client']);
        });
    }
}
