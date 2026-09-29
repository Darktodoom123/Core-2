<?php

namespace App\Modules\Assignment\Queries;

use App\Modules\Assignment\Data\CandidatePage;
use App\Modules\Assignment\Http\Requests\ListDispatchCandidatesRequest;
use App\Modules\Assignment\Models\DispatchAssetAssignment;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dvir\Models\DvirInspection;
use App\Modules\Fleet\Services\AssetPermitCompliance;
use App\Modules\Fleet\Services\AssetPreventiveMaintenance;
use App\Modules\Rental\Enums\RentalReservationStatus;
use App\Modules\Rental\Models\RentalReservationItem;
use App\Shared\Assets\Models\Inspection;
use App\Shared\Assets\Models\MaintenanceWorkOrder;
use App\Shared\Assets\Models\OperationalAsset;
use App\Shared\Assets\Services\AssetInspectionReadiness;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

final class AssetCandidateQuery
{
    public function __construct(
        private readonly AssetInspectionReadiness $inspectionReadiness,
        private readonly AssetPreventiveMaintenance $preventiveMaintenance,
        private readonly AssetPermitCompliance $permits,
    ) {}

    /** @return CandidatePage<array<string, mixed>> */
    public function page(DispatchJob $job, ListDispatchCandidatesRequest $filters): CandidatePage
    {
        if ($filters->resource() === 'personnel') {
            return CandidatePage::error($job, 'Asset candidates were not requested.');
        }

        if ($filters->eligibleOnly()) {
            return $this->eligiblePage($job, $filters);
        }

        $results = $this->query($filters)->paginate(
            perPage: $filters->perPage(),
            columns: ['operational_assets.id', 'operational_assets.code', 'operational_assets.name', 'operational_assets.kind', 'operational_assets.subtype', 'operational_assets.rated_capacity', 'operational_assets.capacity_unit', 'operational_assets.status'],
            pageName: 'asset_page',
            page: $filters->page(),
        );
        $assets = collect($results->items());
        $assetIds = array_values($assets->pluck('id')->map(static fn (mixed $id): int => (int) $id)->all());
        $evidence = $this->evidence($assetIds, $job, assets: $assets);

        $data = $assets
            ->map(fn (OperationalAsset $asset): array => $this->assess($asset, $job, $evidence))
            ->sortBy([
                ['eligible', 'desc'],
                ['code', 'asc'],
                ['id', 'asc'],
            ])
            ->values()
            ->all();

        $data = array_values($data);

        return CandidatePage::fromPaginator($results, $job, $data);
    }

    /** @return CandidatePage<array<string, mixed>> */
    private function eligiblePage(DispatchJob $job, ListDispatchCandidatesRequest $filters): CandidatePage
    {
        $eligible = [];
        $this->query($filters)->reorder('operational_assets.id')->chunkById(100, function ($assets) use ($job, &$eligible): void {
            $ids = array_values($assets->pluck('id')->map(static fn (mixed $id): int => (int) $id)->all());
            $evidence = $this->evidence($ids, $job, assets: $assets);

            foreach ($assets as $asset) {
                $candidate = $this->assess($asset, $job, $evidence);
                if ($candidate['eligible']) {
                    $eligible[] = $candidate;
                }
            }
        }, 'operational_assets.id', 'id');

        usort($eligible, static fn (array $left, array $right): int => [$left['code'], $left['id']] <=> [$right['code'], $right['id']]);

        return CandidatePage::fromEvaluated($eligible, $job, $filters->perPage(), $filters->page());
    }

    /**
     * Batch the same evidence used by canonical dispatch assignment checks.
     *
     * @param  list<int>  $assetIds
     * @param  iterable<OperationalAsset>|null  $assets  already loaded with their kind, to skip a lookup
     * @return array<int, array{maintenance: int, inspections: Collection<int, Inspection>, dvir: DvirInspection|null, dispatch: Collection<int, DispatchAssetAssignment>, rentals: Collection<int, object>, preventive_maintenance_due_at: CarbonImmutable|null, activation: bool, permit_issues: list<array{category: string, label: string, state: string, document_id: int|null, expires_at: string|null, days_left: int|null}>}>
     */
    public function evidence(array $assetIds, DispatchJob $job, bool $excludeCurrentJob = false, ?iterable $assets = null): array
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
        $dvirs = DvirInspection::query()
            ->whereIn('operational_asset_id', $assetIds)
            ->whereNotNull('completed_at')
            ->orderByDesc('completed_at')
            ->orderByDesc('id')
            ->get(['id', 'operational_asset_id', 'has_defects', 'critical_defects_count', 'completed_at'])
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
        $maintenanceDue = $this->preventiveMaintenance->dueBeforeForAssets($assetIds, $job->scheduled_end);
        $permitIssues = $this->permits->blockingIssuesForAssets(
            $assets ?? OperationalAsset::query()->whereKey($assetIds)->get(['id', 'kind']),
            $job->scheduled_end,
        );

        return collect($assetIds)->mapWithKeys(fn (int $assetId): array => [$assetId => [
            'maintenance' => $maintenance->get($assetId, collect())->count(),
            'inspections' => $inspections->get($assetId, collect()),
            'dvir' => $dvirs->get($assetId, collect())->first(),
            'dispatch' => $dispatch->where('operational_asset_id', $assetId)->values(),
            'rentals' => $rentals->get($assetId, collect()),
            'preventive_maintenance_due_at' => $maintenanceDue[$assetId] ?? null,
            'activation' => $excludeCurrentJob,
            'permit_issues' => $permitIssues[$assetId] ?? [],
        ]])->all();
    }

    /** @return Builder<OperationalAsset> */
    private function query(ListDispatchCandidatesRequest $filters): Builder
    {
        return OperationalAsset::query()
            ->select(['operational_assets.id', 'operational_assets.code', 'operational_assets.name', 'operational_assets.kind', 'operational_assets.subtype', 'operational_assets.rated_capacity', 'operational_assets.capacity_unit', 'operational_assets.status'])
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
     * @param  array<int, array{maintenance: int, inspections: Collection<int, Inspection>, dvir: DvirInspection|null, dispatch: Collection<int, DispatchAssetAssignment>, rentals: Collection<int, object>, preventive_maintenance_due_at: CarbonImmutable|null, activation: bool, permit_issues: list<array{category: string, label: string, state: string, document_id: int|null, expires_at: string|null, days_left: int|null}>}>  $evidence
     * @return array{id: int, code: string, name: string, subtype: string|null, capacity: string|null, assignment_type: string, assignment_label: string, eligible: bool, reasons: list<string>, activation_constraints: list<string>, readiness: array{value: string, label: string}, blocking_maintenance_count: int, schedule_conflicts: list<array{id: int, reference: string, scheduled_start: string|null, scheduled_end: string|null}>, already_assigned: bool}
     */
    public function assess(OperationalAsset $asset, DispatchJob $job, array $evidence): array
    {
        $facts = $evidence[(int) $asset->id] ?? [
            'maintenance' => 0,
            'inspections' => collect(),
            'dvir' => null,
            'dispatch' => collect(),
            'rentals' => collect(),
            'preventive_maintenance_due_at' => null,
            'activation' => false,
            'permit_issues' => [],
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

        if ($this->inspectionReadiness->hasUnsafeEvidence($facts['inspections'], $facts['dvir'])) {
            $reasons[] = 'Recorded failed inspection or DVIR defects must be cleared before assignment.';
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
        foreach ($facts['permit_issues'] as $permit) {
            $reasons[] = match ($permit['state']) {
                'missing' => "{$permit['label']} is missing.",
                'revoked' => "{$permit['label']} was revoked.",
                default => "{$permit['label']} expires {$permit['expires_at']}, before this work ends.",
            };
        }

        $activationConstraints = $this->inspectionReadiness->lacksPassingClearance($facts['inspections'], $facts['dvir'])
            ? ['A passing workshop inspection is still required.']
            : [];
        // Due preventive maintenance warns while planning and blocks activation.
        $maintenanceDueAt = $facts['preventive_maintenance_due_at'];
        if ($maintenanceDueAt !== null && $facts['activation']) {
            $reasons[] = 'Preventive maintenance is due '.$this->preventiveMaintenance->describe($maintenanceDueAt).', before this work ends.';
        } elseif ($maintenanceDueAt !== null) {
            $activationConstraints[] = 'Preventive maintenance is due '.$this->preventiveMaintenance->describe($maintenanceDueAt).'; complete it before activation.';
        }

        return [
            'id' => (int) $asset->getKey(),
            'code' => $asset->code,
            'name' => $asset->name,
            'subtype' => $asset->subtype,
            'capacity' => $asset->rated_capacity !== null
                ? trim(((float) $asset->rated_capacity).' '.$asset->capacity_unit)
                : null,
            'assignment_type' => $asset->kind,
            'assignment_label' => match ($asset->kind) {
                'truck' => 'Truck',
                'vehicle' => 'Vehicle',
                'crane' => 'Crane',
                'mobile_crane' => 'Mobile Crane',
                'tower_crane' => 'Tower Crane',
                'equipment' => 'Equipment',
                default => 'Asset',
            },
            'eligible' => $reasons === [] && $conflicts === [],
            'reasons' => array_values(array_unique($reasons)),
            'activation_constraints' => $activationConstraints,
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
