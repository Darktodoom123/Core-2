<?php

namespace App\Modules\Rental\Actions;

use App\Modules\Dispatch\Actions\CreateDispatchFromSource;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchSourceType;
use App\Modules\Dispatch\Models\DispatchJob;
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

final class CreateRentalDispatchHandoff
{
    public function __construct(
        private readonly CreateDispatchFromSource $dispatch,
        private readonly OperationalAssetAvailability $availability,
        private readonly RecordAuditEvent $audit,
    ) {}

    public function handle(RentalReservation $reservation, User $actor): DispatchJob
    {
        return DB::transaction(function () use ($reservation, $actor): DispatchJob {
            $locked = RentalReservation::query()->with('client')->lockForUpdate()->findOrFail($reservation->id);
            Gate::forUser($actor)->authorize(PermissionName::RentalView->value);

            if (! $locked->requiresDispatch()) {
                throw ValidationException::withMessages(['fulfillment_mode' => 'Pickup rentals do not create dispatch work.']);
            }
            if ($locked->dispatch_job_id !== null) {
                $existingJob = $locked->dispatchJob()->firstOrFail();
                $this->dispatch->ensureCanonicalWithinTransaction($actor, $existingJob, $locked, DispatchSourceType::RentalReservation, [
                    'reference' => 'REN-DSP-'.$locked->id,
                    'client' => (string) $locked->client->company_name,
                    'title' => 'Rental delivery '.$locked->reference,
                    'site' => trim((string) $locked->delivery_location),
                    'scheduled_start' => CarbonImmutable::parse($locked->getAttribute('start_date'))->startOfDay(),
                    'scheduled_end' => CarbonImmutable::parse($locked->getAttribute('end_date'))->endOfDay(),
                    'priority' => DispatchPriority::Routine,
                    'requirements' => ['Rental delivery'],
                ]);

                return $existingJob;
            }
            if ($locked->status !== RentalReservationStatus::Reserved) {
                throw ValidationException::withMessages(['status' => 'Only approved rentals can create dispatch work.']);
            }
            if (trim((string) $locked->delivery_location) === '') {
                throw ValidationException::withMessages(['delivery_location' => 'A delivery location is required before dispatch work can be created.']);
            }

            $items = RentalReservationItem::query()
                ->where('rental_reservation_id', $locked->id)
                ->orderBy('id')
                ->lockForUpdate()
                ->get();
            $assets = $this->availability->lockAssetsForUpdate($items->pluck('operational_asset_id')->all());
            foreach ($items as $item) {
                if (! $assets->has($item->operational_asset_id)) {
                    throw ValidationException::withMessages(['status' => 'One or more reserved assets are no longer available.']);
                }

                $this->availability->assertNoConflict(new AssetUsageRequest(
                    assetId: (int) $item->operational_asset_id,
                    usageType: AssetUsageType::RentalApprove,
                    windowStart: CarbonImmutable::parse($locked->getAttribute('start_date'))->startOfDay(),
                    windowEnd: CarbonImmutable::parse($locked->getAttribute('end_date'))->startOfDay()->addDay(),
                    source: new AssetUsageSource('rental_reservation', (int) $locked->id),
                ), 'status');
            }

            $before = RentalAuditSnapshot::fromReservation($locked);
            $job = $this->dispatch->handleWithinTransaction($actor, $locked, DispatchSourceType::RentalReservation, [
                'reference' => 'REN-DSP-'.$locked->id,
                'client' => (string) $locked->client->company_name,
                'title' => 'Rental delivery '.$locked->reference,
                'site' => trim((string) $locked->delivery_location),
                'scheduled_start' => CarbonImmutable::parse($locked->getAttribute('start_date'))->startOfDay(),
                'scheduled_end' => CarbonImmutable::parse($locked->getAttribute('end_date'))->endOfDay(),
                'priority' => DispatchPriority::Routine,
                'requirements' => ['Rental delivery'],
            ]);

            $locked->update(['dispatch_job_id' => $job->id]);
            $this->audit->handle($actor, $locked, 'rental_reservation.dispatch_linked', $before, RentalAuditSnapshot::fromReservation($locked->fresh()));

            return $job;
        });
    }
}
