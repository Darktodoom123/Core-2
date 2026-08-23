<?php

namespace App\Modules\Rental\ViewModels;

use App\Modules\Rental\Models\RentalReservation;
use BackedEnum;
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
        $statusValue = $status instanceof BackedEnum ? (string) $status->value : (string) $status;

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
}
