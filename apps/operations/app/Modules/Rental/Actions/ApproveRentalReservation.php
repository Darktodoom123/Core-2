<?php

namespace App\Modules\Rental\Actions;

use App\Modules\Rental\Enums\RentalReservationStatus;
use App\Modules\Rental\Models\RentalReservation;
use App\Modules\Rental\Models\RentalReservationItem;
use App\Modules\Rental\Support\RentalAuditSnapshot;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Data\AssetUsageRequest;
use App\Shared\Assets\Data\AssetUsageSource;
use App\Shared\Assets\Enums\AssetUsageType;
use App\Shared\Assets\Services\OperationalAssetAvailability;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class ApproveRentalReservation
{
    public function __construct(
        private readonly RecordAuditEvent $audit,
        private readonly OperationalAssetAvailability $availability,
    ) {}

    public function handle(RentalReservation $reservation, User $actor): RentalReservation
    {
        return DB::transaction(function () use ($reservation, $actor): RentalReservation {
            $locked = RentalReservation::query()->lockForUpdate()->findOrFail($reservation->id);
            $items = RentalReservationItem::query()
                ->where('rental_reservation_id', $locked->id)
                ->orderBy('id')
                ->lockForUpdate()
                ->get();
            $locked->setRelation('items', $items);
            $status = $locked->status;
            if (! $status->canApprove()) {
                throw ValidationException::withMessages(['status' => 'Only requested reservations can be approved.']);
            }
            $assetIds = $items->pluck('operational_asset_id')->map(static fn (mixed $id): int => (int) $id)->all();
            if (count($assetIds) !== count(array_unique($assetIds))) {
                throw ValidationException::withMessages(['status' => 'Each equipment unit may appear only once on a rental reservation.']);
            }
            $assets = $this->availability->lockAssetsForUpdate($assetIds);
            foreach ($items as $item) {
                if (! $assets->has($item->operational_asset_id)) {
                    throw ValidationException::withMessages(['status' => 'One or more reserved equipment units are no longer available.']);
                }
                $this->availability->assertNoConflict(new AssetUsageRequest(
                    assetId: (int) $item->operational_asset_id,
                    usageType: AssetUsageType::RentalApprove,
                    windowStart: CarbonImmutable::parse($locked->getAttribute('start_date'))->startOfDay(),
                    windowEnd: CarbonImmutable::parse($locked->getAttribute('end_date'))->startOfDay()->addDay(),
                    source: new AssetUsageSource('rental_reservation', (int) $locked->id),
                ), 'status');
            }
            Gate::forUser($actor)->authorize(PermissionName::RentalApprove->value);

            $before = RentalAuditSnapshot::fromReservation($locked);
            $locked->update(['status' => RentalReservationStatus::Reserved, 'approved_by' => $actor->id]);
            $this->audit->handle($actor, $locked, 'rental_reservation.approved', $before, RentalAuditSnapshot::fromReservation($locked->fresh()));

            return $locked->fresh(['items.asset', 'client']);
        });
    }
}
