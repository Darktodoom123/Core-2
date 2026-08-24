<?php

namespace App\Modules\Assignment\Queries;

use App\Modules\Assignment\Data\CandidatePage;
use App\Modules\Assignment\Http\Requests\ListDispatchCandidatesRequest;
use App\Modules\Assignment\Models\DispatchAssetAssignment;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Rental\Enums\RentalReservationStatus;
use App\Modules\Rental\Models\RentalReservationItem;
use App\Modules\Sales\Enums\SalesOrderStatus;
use App\Modules\Sales\Models\SalesOrderItem;
use App\Shared\Assets\Models\Inspection;
use App\Shared\Assets\Models\MaintenanceWorkOrder;
use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

final class AssetCandidateQuery
{
    /** @return CandidatePage<array<string, mixed>> */
    public function page(DispatchJob $job, ListDispatchCandidatesRequest $filters): CandidatePage
    {
        if ($filters->resource() === 'personnel') {
            return CandidatePage::error($job, 'Asset candidates were not requested.');
        }

        $results = $this->query($filters)->paginate(
            perPage: $filters->perPage(),
            columns: ['operational_assets.id', 'operational_assets.code', 'operational_assets.name', 'operational_assets.kind', 'operational_assets.status'],
            pageName: 'asset_page',
            page: $filters->page(),
        );
        $assets = collect($results->items());
        $assetIds = array_values($assets->pluck('id')->map(static fn (mixed $id): int => (int) $id)->all());
        $evidence = $this->evidence($assetIds, $job);

        $data = $assets
            ->map(fn (OperationalAsset $asset): array => $this->assess($asset, $job, $evidence))
            ->sortBy([
                ['eligible', 'desc'],
                ['code', 'asc'],
                ['id', 'asc'],
            ])
            ->values()
            ->all();

        if ($filters->eligibleOnly()) {
            $data = array_values(array_filter($data, static fn (array $candidate): bool => $candidate['eligible'] === true));
        }

        $data = array_values($data);

        return CandidatePage::fromPaginator($results, $job, $data);
    }

    /**
     * Batch the same evidence used by canonical dispatch assignment checks.
     *
     * @param  list<int>  $assetIds
     * @return array<int, array{maintenance: int, inspections: Collection<int, Inspection>, dispatch: Collection<int, DispatchAssetAssignment>, rentals: Collection<int, object>, sales: Collection<int, object>}>
     */
    public function evidence(array $assetIds, DispatchJob $job, bool $excludeCurrentJob = false): array
    {
        if ($assetIds === []) {
            return [];
        }

        $maintenance = MaintenanceWorkOrder::query()
            ->whereIn('operational_asset_id', $assetIds)
            ->where('dispatch_blocking', true)
            ->whereNull('released_at')
            ->get(['operational_asset_id'])
            ->groupBy('operational_asset_id');
        $inspections = Inspection::query()
            ->whereIn('operational_asset_id', $assetIds)
            ->get(['id', 'operational_asset_id', 'result', 'completed_at'])
            ->groupBy('operational_asset_id');

        $dispatch = DispatchAssetAssignment::query()
            ->whereIn('operational_asset_id', $assetIds)
            ->where(function (Builder $query): void {
                $query->whereNull('active_until')->orWhere('active_until', '>', now());
            })
            ->when($excludeCurrentJob, fn (Builder $query): Builder => $query->where('dispatch_job_id', '<>', $job->id))
            ->whereHas('job', function (Builder $query) use ($job): void {
                if ($job->scheduled_start === null || $job->scheduled_end === null) {
                    return;
                }

                $query->where(function (Builder $window) use ($job): void {
                    $window->whereNull('scheduled_start')
                        ->orWhereNull('scheduled_end')
                        ->orWhere(function (Builder $complete) use ($job): void {
                            $complete->where('scheduled_start', '<', $job->scheduled_end)
                                ->where('scheduled_end', '>', $job->scheduled_start);
                        });
                });
            })
            ->with('job:id,reference,scheduled_start,scheduled_end')
            ->orderBy('id')
            ->get(['id', 'dispatch_job_id', 'operational_asset_id']);

        $scheduledEnd = $job->scheduled_end;
        $windowEndDate = $scheduledEnd === null
            ? null
            : ($scheduledEnd->isStartOfDay() ? $scheduledEnd->toDateString() : $scheduledEnd->addDay()->toDateString());
        $windowStartDate = $job->scheduled_start?->toDateString();
        $rentals = RentalReservationItem::query()
            ->join('rental_reservations', 'rental_reservations.id', '=', 'rental_reservation_items.rental_reservation_id')
            ->whereIn('rental_reservation_items.operational_asset_id', $assetIds)
            ->whereIn('rental_reservations.status', [
                RentalReservationStatus::Requested->value,
                RentalReservationStatus::Reserved->value,
                RentalReservationStatus::CheckedOut->value,
            ])
            ->when($windowStartDate !== null && $windowEndDate !== null, fn ($query) => $query
                ->whereDate('rental_reservations.start_date', '<', $windowEndDate)
                ->whereDate('rental_reservations.end_date', '>=', $windowStartDate))
            ->get([
                'rental_reservation_items.operational_asset_id',
                'rental_reservations.id as reservation_id',
                'rental_reservations.reference',
                'rental_reservations.start_date',
                'rental_reservations.end_date',
            ])
            ->groupBy('operational_asset_id');

        $sales = SalesOrderItem::query()
            ->join('sales_catalog_items', 'sales_catalog_items.id', '=', 'sales_order_items.sales_catalog_item_id')
            ->join('sales_orders', 'sales_orders.id', '=', 'sales_order_items.sales_order_id')
            ->whereIn('sales_catalog_items.operational_asset_id', $assetIds)
            ->whereIn('sales_orders.status', [
                SalesOrderStatus::Confirmed->value,
                SalesOrderStatus::Fulfilled->value,
                SalesOrderStatus::Transferred->value,
            ])
            ->get([
                'sales_catalog_items.operational_asset_id',
                'sales_orders.id as order_id',
                'sales_orders.reference',
                'sales_orders.status',
            ])
            ->groupBy('operational_asset_id');

        return collect($assetIds)->mapWithKeys(fn (int $assetId): array => [$assetId => [
            'maintenance' => $maintenance->get($assetId, collect())->count(),
            'inspections' => $inspections->get($assetId, collect()),
            'dispatch' => $dispatch->where('operational_asset_id', $assetId)->values(),
            'rentals' => $rentals->get($assetId, collect()),
            'sales' => $sales->get($assetId, collect()),
        ]])->all();
    }

    /** @return Builder<OperationalAsset> */
    private function query(ListDispatchCandidatesRequest $filters): Builder
    {
        return OperationalAsset::query()
            ->select(['operational_assets.id', 'operational_assets.code', 'operational_assets.name', 'operational_assets.kind', 'operational_assets.status'])
            ->whereIn('operational_assets.kind', ListDispatchCandidatesRequest::assetTypes())
            ->when($filters->type() !== null, function (Builder $query) use ($filters): void {
                if ($filters->type() === 'crane') {
                    $query->whereIn('operational_assets.kind', ['crane', 'mobile_crane']);
                } else {
                    $query->where('operational_assets.kind', $filters->type());
                }
            })
            ->when($filters->search() !== null, function (Builder $query) use ($filters): void {
                $search = $filters->search();
                $query->where(function (Builder $searchQuery) use ($search): void {
                    $searchQuery->where('operational_assets.code', 'like', "%{$search}%")
                        ->orWhere('operational_assets.name', 'like', "%{$search}%");
                });
            })
            ->orderBy('operational_assets.code')
            ->orderBy('operational_assets.id');
    }

    /**
     * @param  array<int, array{maintenance: int, inspections: Collection<int, Inspection>, dispatch: Collection<int, DispatchAssetAssignment>, rentals: Collection<int, object>, sales: Collection<int, object>}>  $evidence
     * @return array{id: int, code: string, name: string, assignment_type: string, assignment_label: string, eligible: bool, reasons: list<string>, readiness: array{value: string, label: string}, blocking_maintenance_count: int, schedule_conflicts: list<array{id: int, reference: string, scheduled_start: string|null, scheduled_end: string|null}>, already_assigned: bool}
     */
    public function assess(OperationalAsset $asset, DispatchJob $job, array $evidence): array
    {
        $facts = $evidence[(int) $asset->id] ?? [
            'maintenance' => 0,
            'inspections' => collect(),
            'dispatch' => collect(),
            'rentals' => collect(),
            'sales' => collect(),
        ];
        $reasons = [];
        $conflicts = [];

        if (! $asset->status->dispatchable()) {
            $reasons[] = "Readiness is {$asset->status->label()}.";
        }
        if ($facts['maintenance'] > 0) {
            $reasons[] = $facts['maintenance'] === 1
                ? 'One open maintenance item blocks dispatch.'
                : "{$facts['maintenance']} open maintenance items block dispatch.";
        }

        $hasInspection = $facts['inspections']->isNotEmpty();
        $hasPassingInspection = $facts['inspections']->contains(static fn (Inspection $inspection): bool => $inspection->result === 'passed' && $inspection->completed_at !== null);
        if ($hasInspection && ! $hasPassingInspection) {
            $reasons[] = 'A completed passing inspection is required before using the asset.';
        }

        foreach ($facts['dispatch'] as $assignment) {
            $assignedJob = $assignment->job;
            $alreadyAssigned = (int) $assignedJob->id === (int) $job->id;
            $conflicts[] = [
                'id' => (int) $assignedJob->id,
                'reference' => $assignedJob->reference,
                'scheduled_start' => $assignedJob->scheduled_start?->toIso8601String(),
                'scheduled_end' => $assignedJob->scheduled_end?->toIso8601String(),
            ];
            $reasons[] = $alreadyAssigned
                ? 'Asset is already assigned to this dispatch.'
                : "Schedule overlaps dispatch {$assignedJob->reference}.";
        }
        foreach ($facts['rentals'] as $rental) {
            $reasons[] = 'The asset is committed to another active rental reservation.';
        }
        foreach ($facts['sales'] as $sale) {
            $reasons[] = 'The asset is committed to another sales order.';
        }

        return [
            'id' => (int) $asset->getKey(),
            'code' => $asset->code,
            'name' => $asset->name,
            'assignment_type' => $asset->kind,
            'assignment_label' => match ($asset->kind) {
                'truck' => 'Truck',
                'crane' => 'Crane',
                'mobile_crane' => 'Mobile Crane',
                'equipment' => 'Equipment',
                default => 'Asset',
            },
            'eligible' => $reasons === [] && $conflicts === [],
            'reasons' => array_values(array_unique($reasons)),
            'readiness' => [
                'value' => $asset->status->value,
                'label' => $asset->status->label(),
            ],
            'blocking_maintenance_count' => $facts['maintenance'],
            'schedule_conflicts' => $conflicts,
            'already_assigned' => collect($conflicts)->contains(static fn (array $conflict): bool => $conflict['id'] === (int) $job->id),
        ];
    }
}
