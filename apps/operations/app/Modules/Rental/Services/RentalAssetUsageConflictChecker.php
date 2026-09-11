<?php

namespace App\Modules\Rental\Services;

use App\Modules\Rental\Enums\RentalReservationStatus;
use App\Modules\Rental\Models\RentalReservationItem;
use App\Shared\Assets\Contracts\AssetUsageConflictChecker;
use App\Shared\Assets\Data\AssetUsageConflict;
use App\Shared\Assets\Data\AssetUsageRequest;
use App\Shared\Assets\Data\AssetUsageSource;
use App\Shared\Assets\Enums\AssetUsageType;
use Carbon\CarbonImmutable;

final class RentalAssetUsageConflictChecker implements AssetUsageConflictChecker
{
    public function conflicts(AssetUsageRequest $request): iterable
    {
        if (in_array($request->usageType, [AssetUsageType::RentalReturn, AssetUsageType::AssetStatusChange], true)) {
            return [];
        }

        $query = RentalReservationItem::query()
            ->where('operational_asset_id', $request->assetId)
            ->whereHas('reservation', function ($reservation) use ($request): void {
                $reservation->whereIn('status', [
                    RentalReservationStatus::Requested->value,
                    RentalReservationStatus::Reserved->value,
                    RentalReservationStatus::CheckedOut->value,
                ]);

                if ($request->source?->aggregateType === 'rental_reservation'
                    && in_array($request->usageType, [
                        AssetUsageType::RentalApprove,
                        AssetUsageType::RentalCheckout,
                        AssetUsageType::RentalReturn,
                    ], true)) {
                    $reservation->where('id', '<>', $request->source->aggregateId);
                }

                if ($request->usageType === AssetUsageType::SalesAccept
                    || $request->usageType === AssetUsageType::SalesFulfill) {
                    return;
                }

                if ($request->windowStart !== null && $request->windowEnd !== null) {
                    $windowEndDate = $request->windowEnd->isStartOfDay()
                        ? $request->windowEnd->toDateString()
                        : $request->windowEnd->addDay()->toDateString();
                    $reservation->whereDate('start_date', '<', $windowEndDate)
                        ->whereDate('end_date', '>=', $request->windowStart->toDateString());
                }
            });

        $item = $query->with('reservation')->orderBy('id')->first();
        if ($item === null) {
            return [];
        }

        $reservation = $item->reservation;

        return [new AssetUsageConflict(
            'rental.reservation_overlap',
            'The asset is committed to another active rental reservation.',
            new AssetUsageSource('rental_reservation', (int) $reservation->id),
            [
                'reference' => (string) $reservation->reference,
                'start_date' => CarbonImmutable::parse($reservation->getAttribute('start_date'))->toDateString(),
                'end_date' => CarbonImmutable::parse($reservation->getAttribute('end_date'))->toDateString(),
            ],
        )];
    }
}
