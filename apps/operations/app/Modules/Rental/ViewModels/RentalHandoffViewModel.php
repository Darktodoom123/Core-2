<?php

namespace App\Modules\Rental\ViewModels;

use App\Modules\Rental\Models\RentalReservation;
use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

final class RentalHandoffViewModel
{
    /**
     * @param  Collection<int, RentalReservation>  $reservations
     * @return array<int, array<string, mixed>>
     */
    public static function collection(Collection $reservations): array
    {
        return $reservations->map(static fn (RentalReservation $reservation): array => self::single($reservation))->values()->all();
    }

    /**
     * @return array<string, mixed>
     */
    public static function single(RentalReservation $reservation): array
    {
        $status = $reservation->getAttribute('status');
        $statusValue = $status instanceof \BackedEnum ? (string) $status->value : (string) $status;
        $latestEvidence = $reservation->relationLoaded('latestHandoverEvidence')
            ? $reservation->getRelationValue('latestHandoverEvidence')
            : $reservation->latestHandoverEvidence;

        return [
            'id' => (int) $reservation->getKey(),
            'reference' => $reservation->reference,
            'client' => [
                'id' => (int) $reservation->client->getKey(),
                'code' => $reservation->client->code,
                'company_name' => $reservation->client->company_name,
            ],
            'status' => [
                'value' => $statusValue,
                'label' => self::humanizeStatus($statusValue),
            ],
            'fulfillment_mode' => $reservation->fulfillmentMode()->value,
            'location' => $reservation->delivery_location,
            'dispatch_job_id' => $reservation->dispatch_job_id,
            'ready' => $reservation->isReadyForDispatchHandoff(),
            'start_date' => self::dateOnly($reservation->getAttribute('start_date')),
            'end_date' => self::dateOnly($reservation->getAttribute('end_date')),
            'has_evidence' => $latestEvidence !== null,
            'evidence_signee' => $latestEvidence?->signee_name,
            'evidence_submitted_at' => $latestEvidence?->submitted_at?->toIso8601String(),
            'evidence_type' => $latestEvidence?->handover_type,
            'rental_items' => self::items($reservation),
        ];
    }

    private static function humanizeStatus(string $value): string
    {
        return str($value)->replace('_', ' ')->title()->toString();
    }

    private static function dateOnly(mixed $value): ?string
    {
        return $value === null ? null : Carbon::parse((string) $value)->toDateString();
    }

    /**
     * Reserved equipment and the operator each unit needs. Only filled when the
     * caller eager-loaded `items.asset`, so other lists stay query-free.
     *
     * @return list<array{id: int, name: string, quantity: int, operator: string|null}>
     */
    private static function items(RentalReservation $reservation): array
    {
        if (! $reservation->relationLoaded('items')) {
            return [];
        }

        $items = [];

        foreach ($reservation->items as $item) {
            $asset = $item->asset;

            if ($asset === null) {
                continue;
            }

            $items[] = [
                'id' => (int) $item->getKey(),
                'name' => "{$asset->code} · {$asset->name}",
                'quantity' => (int) $item->quantity,
                'operator' => self::operatorLabel($asset),
            ];
        }

        return $items;
    }

    /**
     * Cranes, machines and trucks all go out with an operator. Operators are
     * flexible across unit types, so the need is simply "Operator".
     */
    public static function operatorLabel(OperationalAsset $asset): ?string
    {
        return in_array($asset->kind, ['crane', 'mobile_crane', 'equipment', 'truck', 'vehicle'], true)
            ? 'Operator'
            : null;
    }
}
