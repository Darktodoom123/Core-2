<?php

namespace App\Modules\Rental\Actions;

use App\Modules\Rental\Enums\RentalFulfillmentMode;
use App\Modules\Rental\Enums\RentalReservationStatus;
use App\Modules\Rental\Models\RentalReservation;
use App\Modules\Rental\Support\RentalAuditSnapshot;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Data\AssetUsageRequest;
use App\Shared\Assets\Enums\AssetUsageType;
use App\Shared\Assets\Models\OperationalAsset;
use App\Shared\Assets\Services\OperationalAssetAvailability;
use App\Shared\Support\PersistedInteger;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class CreateRentalReservation
{
    public function __construct(
        private readonly RecordAuditEvent $audit,
        private readonly OperationalAssetAvailability $availability,
    ) {}

    /** @param array<string, mixed> $attributes */
    public function handle(User $actor, array $attributes): RentalReservation
    {
        return DB::transaction(function () use ($actor, $attributes): RentalReservation {
            $start = CarbonImmutable::parse((string) $attributes['start_date'])->startOfDay();
            $end = CarbonImmutable::parse((string) $attributes['end_date'])->startOfDay();
            $days = $start->diffInDays($end) + 1;
            $total = 0;
            $items = (array) $attributes['items'];
            $assetIds = array_map(static fn (array $item): int => (int) $item['operational_asset_id'], $items);
            if (count($assetIds) !== count(array_unique($assetIds))) {
                throw ValidationException::withMessages(['items' => 'Each equipment unit may appear only once on a rental reservation.']);
            }
            $assets = $this->availability->lockAssetsForUpdate($assetIds);
            $fulfillmentMode = RentalFulfillmentMode::from((string) ($attributes['fulfillment_mode'] ?? RentalFulfillmentMode::Delivery->value));

            Gate::forUser($actor)->authorize(PermissionName::RentalCreate->value);

            $reservation = RentalReservation::query()->create([
                'reference' => $attributes['reference'],
                'client_id' => $attributes['client_id'],
                'created_by' => $actor->id,
                'status' => RentalReservationStatus::Requested,
                'start_date' => $start,
                'end_date' => $end,
                'delivery_location' => $attributes['delivery_location'] ?? null,
                'fulfillment_mode' => $fulfillmentMode,
                'notes' => $attributes['notes'] ?? null,
            ]);

            foreach ($items as $item) {
                $assetId = (int) $item['operational_asset_id'];
                $asset = $assets->get($assetId);
                if (! $asset instanceof OperationalAsset) {
                    throw ValidationException::withMessages(['items' => 'One or more selected equipment units are no longer available.']);
                }
                $this->availability->assertNoConflict(new AssetUsageRequest(
                    assetId: $assetId,
                    usageType: AssetUsageType::RentalCreate,
                    windowStart: $start->toImmutable(),
                    windowEnd: $end->addDay()->toImmutable(),
                ), 'items');

                $quantity = (int) $item['quantity'];
                $rate = (int) $item['rate_cents'];
                $line = PersistedInteger::checkedMultiply($quantity, $rate, 'items');
                $line = PersistedInteger::checkedMultiply($line, (int) $days, 'items');
                $total = PersistedInteger::checkedAdd($total, $line, 'items');
                $reservation->items()->create([
                    'operational_asset_id' => $asset->id,
                    'quantity' => $quantity,
                    'rate_cents' => $rate,
                    'line_total_cents' => $line,
                ]);
            }

            $reservation->update(['total_cents' => $total]);
            $this->audit->handle($actor, $reservation, 'rental_reservation.created', null, RentalAuditSnapshot::fromReservation($reservation->fresh()));

            return $reservation->fresh(['items.asset', 'client']);
        });
    }
}
