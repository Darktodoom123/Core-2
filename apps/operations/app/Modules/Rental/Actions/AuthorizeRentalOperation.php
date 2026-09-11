<?php

namespace App\Modules\Rental\Actions;

use App\Modules\Rental\Enums\RentalReservationStatus;
use App\Modules\Rental\Models\RentalOperatorAssignment;
use App\Modules\Rental\Models\RentalReservation;
use App\Modules\Rental\Models\RentalReservationItem;
use App\Modules\Rental\Services\RentalOperatorEligibility;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class AuthorizeRentalOperation
{
    public function __construct(
        private readonly RecordAuditEvent $audit,
        private readonly RentalOperatorEligibility $eligibility,
    ) {}

    /**
     * @return array{
     *     authorized: true,
     *     rental_reservation_id: int,
     *     rental_reservation_item_id: int,
     *     operational_asset_id: int,
     *     operator_id: int,
     *     operator_type: string,
     *     valid_from: string,
     *     valid_until: string
     * }
     */
    public function handle(User $actor, RentalReservation $reservation, int $assetId): array
    {
        Gate::forUser($actor)->authorize(PermissionName::RentalOperate->value);

        return DB::transaction(function () use ($actor, $reservation, $assetId): array {
            $lockedReservation = RentalReservation::query()->lockForUpdate()->findOrFail($reservation->id);
            Gate::forUser($actor)->authorize(PermissionName::RentalOperate->value);

            if ($lockedReservation->status !== RentalReservationStatus::CheckedOut) {
                throw ValidationException::withMessages([
                    'status' => 'Equipment can only be operated after rental checkout.',
                ]);
            }

            $now = CarbonImmutable::now();
            $validFrom = CarbonImmutable::parse((string) $lockedReservation->getRawOriginal('start_date'))->startOfDay();
            $validUntil = CarbonImmutable::parse((string) $lockedReservation->getRawOriginal('end_date'))->addDay()->startOfDay();
            if ($now->lt($validFrom) || ! $now->lt($validUntil)) {
                throw ValidationException::withMessages([
                    'time' => 'The current time is outside the approved rental period.',
                ]);
            }

            $item = RentalReservationItem::query()
                ->where('rental_reservation_id', $lockedReservation->id)
                ->where('operational_asset_id', $assetId)
                ->lockForUpdate()
                ->first();
            if (! $item instanceof RentalReservationItem) {
                throw ValidationException::withMessages([
                    'operational_asset_id' => 'The selected equipment is not part of this rental.',
                ]);
            }

            $asset = OperationalAsset::query()->lockForUpdate()->find($assetId);
            if (! $asset instanceof OperationalAsset || $asset->trashed()) {
                throw ValidationException::withMessages([
                    'operational_asset_id' => 'The selected equipment is no longer available.',
                ]);
            }
            if (! in_array($asset->status, [AssetStatus::Assigned, AssetStatus::Working], true)) {
                throw ValidationException::withMessages([
                    'operational_asset_id' => 'The equipment is not in an operable state.',
                ]);
            }

            $assignment = RentalOperatorAssignment::query()
                ->where('rental_reservation_item_id', $item->id)
                ->where('user_id', $actor->id)
                ->where('active_from', '<=', $now)
                ->where(function ($query) use ($now): void {
                    $query->whereNull('active_until')->orWhere('active_until', '>', $now);
                })
                ->lockForUpdate()
                ->first();
            if (! $assignment instanceof RentalOperatorAssignment) {
                throw new AuthorizationException('You are not assigned to operate this rental equipment.');
            }

            $assessment = $this->eligibility->assess($actor, $assignment->operator_type, $now);
            if (! $assessment['eligible']) {
                throw ValidationException::withMessages([
                    'operator' => implode(' ', $assessment['reasons']),
                ]);
            }

            $this->audit->handle($actor, $lockedReservation, 'rental_operator.operation_authorized', null, [
                'rental_reservation_item_id' => $item->id,
                'operational_asset_id' => $asset->id,
                'operator_type' => $assignment->operator_type->value,
                'authorized_at' => $now->toIso8601String(),
            ]);

            return [
                'authorized' => true,
                'rental_reservation_id' => (int) $lockedReservation->id,
                'rental_reservation_item_id' => (int) $item->id,
                'operational_asset_id' => (int) $asset->id,
                'operator_id' => (int) $actor->id,
                'operator_type' => $assignment->operator_type->value,
                'valid_from' => $validFrom->toIso8601String(),
                'valid_until' => $validUntil->toIso8601String(),
            ];
        });
    }
}
