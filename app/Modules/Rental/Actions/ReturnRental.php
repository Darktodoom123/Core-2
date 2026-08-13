<?php

namespace App\Modules\Rental\Actions;

use App\Modules\Rental\Enums\RentalReservationStatus;
use App\Modules\Rental\Models\RentalReservation;
use App\Modules\Rental\Models\RentalReturnRecord;
use App\Modules\Rental\Support\RentalAuditSnapshot;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Data\AssetUsageRequest;
use App\Shared\Assets\Data\AssetUsageSource;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Enums\AssetUsageType;
use App\Shared\Assets\Models\OperationalAsset;
use App\Shared\Assets\Services\OperationalAssetAvailability;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
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
            $assetIds = $items->pluck('operational_asset_id')->map(static fn (mixed $id): int => (int) $id)->all();
            if (count($assetIds) !== count(array_unique($assetIds))) {
                throw ValidationException::withMessages(['status' => 'Each equipment unit may appear only once on a rental reservation.']);
            }
            $assets = $this->availability->lockAssetsForUpdate($assetIds);
            foreach ($items as $item) {
                if (! $assets->has($item->operational_asset_id)) {
                    throw ValidationException::withMessages(['status' => 'One or more rented equipment units are no longer available.']);
                }
                $this->availability->assertNoConflict(new AssetUsageRequest(
                    assetId: (int) $item->operational_asset_id,
                    usageType: AssetUsageType::RentalReturn,
                    source: new AssetUsageSource('rental_reservation', (int) $locked->id),
                ), 'status');
            }
            Gate::forUser($actor)->authorize(PermissionName::RentalReturn->value);

            $before = RentalAuditSnapshot::fromReservation($locked);
            RentalReturnRecord::query()->create([
                'rental_reservation_id' => $locked->id,
                'returned_by' => $actor->id,
                'returned_at' => now(),
                'condition_after' => $attributes['condition'],
                'damage_notes' => $attributes['damage_notes'] ?? null,
            ]);
            foreach ($items as $item) {
                $asset = $assets->get($item->operational_asset_id);
                if ($asset instanceof OperationalAsset && $asset->status === AssetStatus::Assigned && $this->canRestoreAssignedAsset($asset, $locked)) {
                    $asset->update(['status' => AssetStatus::Available]);
                }
            }
            $locked->update(['status' => RentalReservationStatus::Returned]);
            $this->audit->handle($actor, $locked, 'rental_reservation.returned', $before, RentalAuditSnapshot::fromReservation($locked->fresh()));

            return $locked->fresh(['items.asset', 'returnRecord', 'client']);
        });
    }

    private function canRestoreAssignedAsset(OperationalAsset $asset, RentalReservation $reservation): bool
    {
        return $this->availability->assess(new AssetUsageRequest(
            assetId: (int) $asset->id,
            usageType: AssetUsageType::RentalReturn,
            targetStatus: AssetStatus::Available,
            source: new AssetUsageSource('rental_reservation', (int) $reservation->id),
        ))->allowed();
    }
}
