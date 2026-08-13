<?php

namespace App\Modules\Rental\Actions;

use App\Modules\Rental\Enums\RentalReservationStatus;
use App\Modules\Rental\Models\RentalReservation;
use App\Modules\Rental\Models\RentalReservationItem;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Data\AssetUsageRequest;
use App\Shared\Assets\Data\AssetUsageSource;
use App\Shared\Assets\Enums\AssetUsageType;
use App\Shared\Assets\Services\OperationalAssetAvailability;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
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
            $assets = $this->availability->lockAssetsForUpdate($items->pluck('operational_asset_id')->all());
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
            $before = $locked->toArray();
            $locked->update(['status' => RentalReservationStatus::Reserved, 'approved_by' => $actor->id]);
            $this->audit->handle($actor, $locked, 'rental_reservation.approved', $before, $locked->fresh()->toArray());

            return $locked->fresh(['items.asset', 'client']);
        });
    }
}
