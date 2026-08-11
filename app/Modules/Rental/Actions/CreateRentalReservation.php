<?php

namespace App\Modules\Rental\Actions;

use App\Modules\Rental\Enums\RentalReservationStatus;
use App\Modules\Rental\Models\RentalReservation;
use App\Modules\Rental\Models\RentalReservationItem;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Models\OperationalAsset;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class CreateRentalReservation
{
    public function __construct(private readonly RecordAuditEvent $audit) {}

    /** @param array<string, mixed> $attributes */
    public function handle(User $actor, array $attributes): RentalReservation
    {
        return DB::transaction(function () use ($actor, $attributes): RentalReservation {
            $start = CarbonImmutable::parse((string) $attributes['start_date'])->startOfDay();
            $end = CarbonImmutable::parse((string) $attributes['end_date'])->startOfDay();
            $days = $start->diffInDays($end) + 1;
            $total = 0;
            $items = (array) $attributes['items'];

            $reservation = RentalReservation::query()->create([
                'reference' => $attributes['reference'],
                'client_id' => $attributes['client_id'],
                'created_by' => $actor->id,
                'status' => RentalReservationStatus::Requested,
                'start_date' => $start,
                'end_date' => $end,
                'delivery_location' => $attributes['delivery_location'] ?? null,
                'fulfillment_mode' => $attributes['fulfillment_mode'] ?? 'delivery',
                'notes' => $attributes['notes'] ?? null,
            ]);

            foreach ($items as $item) {
                $asset = OperationalAsset::query()->lockForUpdate()->find((int) $item['operational_asset_id']);
                if ($asset === null || ! $asset->status->dispatchable()) {
                    throw ValidationException::withMessages(['items' => 'One or more selected equipment units are not available.']);
                }

                $conflict = RentalReservationItem::query()
                    ->where('operational_asset_id', $asset->id)
                    ->whereHas('reservation', fn ($query) => $query
                        ->whereIn('status', [RentalReservationStatus::Requested->value, RentalReservationStatus::Reserved->value, RentalReservationStatus::CheckedOut->value])
                        ->whereDate('start_date', '<=', $end)
                        ->whereDate('end_date', '>=', $start))
                    ->exists();

                if ($conflict) {
                    throw ValidationException::withMessages(['items' => "Equipment {$asset->code} is already reserved for the requested dates."]);
                }

                $quantity = (int) $item['quantity'];
                $rate = (int) $item['rate_cents'];
                $line = $quantity * $rate * $days;
                $total += $line;
                $reservation->items()->create([
                    'operational_asset_id' => $asset->id,
                    'quantity' => $quantity,
                    'rate_cents' => $rate,
                    'line_total_cents' => $line,
                ]);
            }

            $reservation->update(['total_cents' => $total]);
            $this->audit->handle($actor, $reservation, 'rental_reservation.created', null, $reservation->fresh()->toArray());

            return $reservation->fresh(['items.asset', 'client']);
        });
    }
}
