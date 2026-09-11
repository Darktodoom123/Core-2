<?php

namespace App\Modules\Rental\Actions;

use App\Modules\Dispatch\Enums\DispatchSourceType;
use App\Modules\Dispatch\Services\DispatchDeliveryAttemptGuard;
use App\Modules\Rental\Enums\RentalReservationStatus;
use App\Modules\Rental\Models\RentalCheckout;
use App\Modules\Rental\Models\RentalReservation;
use App\Modules\Rental\Support\RentalAuditSnapshot;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Data\AssetUsageRequest;
use App\Shared\Assets\Data\AssetUsageSource;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Enums\AssetUsageType;
use App\Shared\Assets\Services\OperationalAssetAvailability;
use App\Shared\Assets\Services\OperationalAssetStatusGuard;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class CheckoutRental
{
    public function __construct(
        private readonly RecordAuditEvent $audit,
        private readonly OperationalAssetAvailability $availability,
        private readonly OperationalAssetStatusGuard $statusGuard,
        private readonly DispatchDeliveryAttemptGuard $deliveryGuard,
    ) {}

    /** @param array<string, mixed> $attributes */
    public function handle(RentalReservation $reservation, User $actor, array $attributes): RentalReservation
    {
        return DB::transaction(function () use ($reservation, $actor, $attributes): RentalReservation {
            $locked = RentalReservation::query()->lockForUpdate()->findOrFail($reservation->id);
            $items = $locked->items()->orderBy('id')->lockForUpdate()->get();
            $locked->setRelation('items', $items);
            if (! $locked->status->canCheckout() || $locked->checkout()->exists()) {
                throw ValidationException::withMessages(['status' => 'Only reserved rentals can be checked out once.']);
            }
            if ($locked->requiresDispatch()) {
                $this->deliveryGuard->requireCompleted(
                    DispatchSourceType::RentalReservation,
                    (int) $locked->id,
                    $locked->dispatch_job_id,
                    message: 'A delivery rental requires a linked, non-archived completed canonical dispatch before checkout.',
                );
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
                    usageType: AssetUsageType::RentalCheckout,
                    windowStart: CarbonImmutable::parse($locked->getAttribute('start_date'))->startOfDay(),
                    windowEnd: CarbonImmutable::parse($locked->getAttribute('end_date'))->startOfDay()->addDay(),
                    source: new AssetUsageSource('rental_reservation', (int) $locked->id),
                ), 'status');
            }
            Gate::forUser($actor)->authorize(PermissionName::RentalCheckout->value);

            $before = RentalAuditSnapshot::fromReservation($locked);
            RentalCheckout::query()->create([
                'rental_reservation_id' => $locked->id,
                'checked_out_by' => $actor->id,
                'checked_out_at' => now(),
                'condition_before' => $attributes['condition'],
                'notes' => $attributes['notes'] ?? null,
            ]);
            foreach ($items as $item) {
                $asset = $assets->get($item->operational_asset_id);
                if ($asset !== null) {
                    $this->statusGuard->transition($asset, AssetStatus::Assigned, new AssetUsageRequest(
                        assetId: (int) $asset->id,
                        usageType: AssetUsageType::RentalCheckout,
                        windowStart: CarbonImmutable::parse($locked->getAttribute('start_date'))->startOfDay(),
                        windowEnd: CarbonImmutable::parse($locked->getAttribute('end_date'))->startOfDay()->addDay(),
                        source: new AssetUsageSource('rental_reservation', (int) $locked->id),
                    ));
                }
            }
            $locked->update(['status' => RentalReservationStatus::CheckedOut]);
            $this->audit->handle($actor, $locked, 'rental_reservation.checked_out', $before, RentalAuditSnapshot::fromReservation($locked->fresh()));

            return $locked->fresh(['items.asset', 'checkout', 'client']);
        });
    }
}
