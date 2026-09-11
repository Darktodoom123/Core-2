<?php

namespace App\Modules\Rental\Actions;

use App\Modules\Rental\Enums\RentalOperatorType;
use App\Modules\Rental\Enums\RentalReservationStatus;
use App\Modules\Rental\Models\RentalOperatorAssignment;
use App\Modules\Rental\Models\RentalReservation;
use App\Modules\Rental\Models\RentalReservationItem;
use App\Modules\Rental\Services\RentalOperatorEligibility;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Models\OperationalAsset;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class AssignRentalOperator
{
    public function __construct(
        private readonly RecordAuditEvent $audit,
        private readonly RentalOperatorEligibility $eligibility,
    ) {}

    /**
     * @param  array{rental_reservation_item_id: int, user_id: int, operator_type: string}  $attributes
     */
    public function handle(User $actor, RentalReservation $reservation, array $attributes): RentalOperatorAssignment
    {
        Gate::forUser($actor)->authorize(PermissionName::RentalAssignOperator->value);

        return DB::transaction(function () use ($actor, $reservation, $attributes): RentalOperatorAssignment {
            $lockedReservation = RentalReservation::query()->lockForUpdate()->findOrFail($reservation->id);
            Gate::forUser($actor)->authorize(PermissionName::RentalAssignOperator->value);

            if (! in_array($lockedReservation->status, [RentalReservationStatus::Reserved, RentalReservationStatus::CheckedOut], true)) {
                throw ValidationException::withMessages([
                    'status' => 'Operators can only be assigned to reserved or checked-out rentals.',
                ]);
            }

            $item = RentalReservationItem::query()
                ->where('rental_reservation_id', $lockedReservation->id)
                ->whereKey((int) $attributes['rental_reservation_item_id'])
                ->lockForUpdate()
                ->first();

            if (! $item instanceof RentalReservationItem) {
                throw ValidationException::withMessages([
                    'rental_reservation_item_id' => 'The selected equipment is not part of this rental.',
                ]);
            }

            $asset = OperationalAsset::query()->lockForUpdate()->find($item->operational_asset_id);
            if (! $asset instanceof OperationalAsset || $asset->trashed()) {
                throw ValidationException::withMessages([
                    'rental_reservation_item_id' => 'The selected equipment is no longer available.',
                ]);
            }

            $operatorType = RentalOperatorType::tryFrom((string) $attributes['operator_type']);
            $expectedType = RentalOperatorType::forAsset($asset);
            if ($operatorType === null || $expectedType !== $operatorType) {
                $label = $expectedType === null ? 'a qualified operator' : $expectedType->value;
                throw ValidationException::withMessages([
                    'operator_type' => "This equipment requires a {$label}.",
                ]);
            }

            $operator = User::query()
                ->with(['personnelProfile', 'personnelCredentials'])
                ->lockForUpdate()
                ->find((int) $attributes['user_id']);
            if (! $operator instanceof User) {
                throw ValidationException::withMessages(['user_id' => 'The selected operator no longer exists.']);
            }

            $start = CarbonImmutable::parse((string) $lockedReservation->getRawOriginal('start_date'))->startOfDay();
            $end = CarbonImmutable::parse((string) $lockedReservation->getRawOriginal('end_date'))->addDay()->startOfDay();
            $assessment = $this->eligibility->assess($operator, $operatorType, $start);
            if (! $assessment['eligible']) {
                throw ValidationException::withMessages([
                    'user_id' => implode(' ', $assessment['reasons']),
                ]);
            }

            $overlap = RentalOperatorAssignment::query()
                ->where('user_id', $operator->id)
                ->where('active_from', '<', $end)
                ->where(function ($query) use ($start): void {
                    $query->whereNull('active_until')->orWhere('active_until', '>', $start);
                })
                ->lockForUpdate()
                ->exists();
            if ($overlap) {
                throw ValidationException::withMessages([
                    'user_id' => 'The operator is already assigned during this rental period.',
                ]);
            }

            $assignment = RentalOperatorAssignment::query()->create([
                'rental_reservation_id' => $lockedReservation->id,
                'rental_reservation_item_id' => $item->id,
                'user_id' => $operator->id,
                'operator_type' => $operatorType,
                'assigned_by' => $actor->id,
                'active_from' => $start,
                'active_until' => $end,
            ]);

            $this->audit->handle($actor, $lockedReservation, 'rental_operator.assigned', null, [
                'rental_reservation_item_id' => $item->id,
                'operational_asset_id' => $asset->id,
                'operator_id' => $operator->id,
                'operator_type' => $operatorType->value,
                'active_from' => $start->toIso8601String(),
                'active_until' => $end->toIso8601String(),
            ]);

            return $assignment->load([
                'user:id,name',
                'item.asset:id,code,name,kind',
            ]);
        });
    }
}
