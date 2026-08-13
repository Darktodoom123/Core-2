<?php

namespace App\Modules\Rental\Actions;

use App\Modules\Rental\Enums\RentalReservationStatus;
use App\Modules\Rental\Models\RentalReservation;
use App\Modules\Rental\Models\RentalReturnRecord;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Data\AssetUsageRequest;
use App\Shared\Assets\Data\AssetUsageSource;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Enums\AssetUsageType;
use App\Shared\Assets\Models\OperationalAsset;
use App\Shared\Assets\Services\OperationalAssetAvailability;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class ReturnRental
{
    public function __construct(
        private readonly RecordAuditEvent $audit,
        private readonly OperationalAssetAvailability $availability,
    ) {}

    /** @param array<string, mixed> $attributes */
    public function handle(RentalReservation $reservation, User $actor, array $attributes): RentalReservation
    {
        return DB::transaction(function () use ($reservation, $actor, $attributes): RentalReservation {
            $locked = RentalReservation::query()->lockForUpdate()->findOrFail($reservation->id);
            $items = $locked->items()->orderBy('id')->lockForUpdate()->get();
            $locked->setRelation('items', $items);
            if (! $locked->status->canReturn() || $locked->returnRecord()->exists()) {
                throw ValidationException::withMessages(['status' => 'Only checked-out rentals can be returned once.']);
            }
            $assets = $this->availability->lockAssetsForUpdate($items->pluck('operational_asset_id')->all());
            foreach ($items as $item) {
                if (! $assets->has($item->operational_asset_id)) {
                    continue;
                }
                $this->availability->assertNoConflict(new AssetUsageRequest(
                    assetId: (int) $item->operational_asset_id,
                    usageType: AssetUsageType::RentalReturn,
                    source: new AssetUsageSource('rental_reservation', (int) $locked->id),
                ), 'status');
            }
            $before = $locked->toArray();
            RentalReturnRecord::query()->create([
                'rental_reservation_id' => $locked->id,
                'returned_by' => $actor->id,
                'returned_at' => now(),
                'condition_after' => $attributes['condition'] ?? null,
                'damage_notes' => $attributes['damage_notes'] ?? null,
            ]);
            foreach ($items as $item) {
                $asset = $assets->get($item->operational_asset_id);
                if ($asset instanceof OperationalAsset && $asset->status === AssetStatus::Assigned) {
                    $asset->update(['status' => AssetStatus::Available]);
                }
            }
            $locked->update(['status' => RentalReservationStatus::Returned]);
            $this->audit->handle($actor, $locked, 'rental_reservation.returned', $before, $locked->fresh()->toArray());

            return $locked->fresh(['items.asset', 'returnRecord', 'client']);
        });
    }
}
