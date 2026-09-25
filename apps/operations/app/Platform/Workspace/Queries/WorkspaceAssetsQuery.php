<?php

namespace App\Platform\Workspace\Queries;

use App\Platform\Identity\Models\User;
use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Gate;

final class WorkspaceAssetsQuery
{
    /**
     * @param  array{
     *     search?: string|null,
     *     category?: string|null,
     *     page?: int|null,
     *     per_page?: int|null,
     * }  $filters
     * @return LengthAwarePaginator<int, OperationalAsset>
     */
    public function paginate(User $user, array $filters = []): LengthAwarePaginator
    {
        if (! Gate::forUser($user)->allows('viewAny', OperationalAsset::class)) {
            /** @var LengthAwarePaginator<int, OperationalAsset> $emptyPaginator */
            $emptyPaginator = new LengthAwarePaginator([], 0, 50, 1, ['path' => request()->url()]);

            return $emptyPaginator;
        }

        $query = OperationalAsset::query()->visibleTo($user);
        $this->applyCategoryFilter($query, $filters['category'] ?? 'all');

        $search = trim($filters['search'] ?? '');
        if ($search !== '') {
            $pattern = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], mb_strtolower($search)).'%';
            $query->where(function (Builder $q) use ($pattern): void {
                foreach (['code', 'name', 'model', 'manufacturer', 'registration_number', 'kind', 'subtype', 'location'] as $col) {
                    $q->orWhereRaw("LOWER({$col}) LIKE ? ESCAPE '!'", [$pattern]);
                }
            });
        }

        $perPage = max(1, min(100, (int) ($filters['per_page'] ?? 50)));
        $pageNumber = max(1, (int) ($filters['page'] ?? 1));

        /** @var LengthAwarePaginator<int, OperationalAsset> $paginator */
        $paginator = $query
            ->withCount([
                'inspections as inspections_count',
                'dvirInspections as dvir_inspections_count',
                'maintenanceWorkOrders as maintenance_work_orders_count',
                'documents as documents_count',
                'maintenanceWorkOrders as blocking_work_orders_count' => fn ($q) => $q->where('dispatch_blocking', true)->whereNull('released_at'),
            ])
            ->with([
                'documents.latestAttachment',
                'inspections' => fn ($q) => $q->latest('completed_at')->limit(10),
                'maintenanceWorkOrders' => fn ($q) => $q->latest('created_at')->limit(10),
                'activeOperatorShift.user:id,name',
                'activeOperatorShift.activeDutyLog',
                'activeOperatorShift.activeDutyLog.operationalAsset',
                'activeOperatorShift.dutyLogs.operationalAsset',
                'activeOperatorShift.operationalAsset',
                'latestDvirInspection.photos',
                'latestDvirInspection.checks',
                'dvirInspections' => fn ($q) => $q->latest('completed_at')->limit(15),
                'dvirInspections.photos',
                'dvirInspections.checks',
                'activeBlockingWorkOrder',
                'latestStatusChange.actor:id,name',
            ])
            ->orderBy('code')
            ->orderBy('id')
            ->paginate($perPage, ['*'], 'asset_page', $pageNumber);

        return $paginator;
    }

    /**
     * @param  array{search?: string|null, category?: string|null}  $filters
     */
    public function total(User $user, array $filters = []): int
    {
        if (! Gate::forUser($user)->allows('viewAny', OperationalAsset::class)) {
            return 0;
        }

        $query = OperationalAsset::query()->visibleTo($user);
        $this->applyCategoryFilter($query, $filters['category'] ?? 'all');

        $search = trim($filters['search'] ?? '');
        if ($search !== '') {
            $pattern = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], mb_strtolower($search)).'%';
            $query->where(function (Builder $q) use ($pattern): void {
                foreach (['code', 'name', 'model', 'manufacturer', 'registration_number', 'kind', 'subtype', 'location'] as $col) {
                    $q->orWhereRaw("LOWER({$col}) LIKE ? ESCAPE '!'", [$pattern]);
                }
            });
        }

        return $query->toBase()->count();
    }

    /**
     * @param  Builder<OperationalAsset>  $query
     */
    private function applyCategoryFilter(Builder $query, ?string $category): void
    {
        match ($category ?? 'all') {
            'tower_cranes' => $query->where(function (Builder $q): void {
                $q->whereRaw("LOWER(kind) LIKE '%tower_crane%'")
                    ->orWhereRaw("LOWER(subtype) LIKE '%tower crane%'");
            }),
            'mobile_cranes' => $query
                ->where(function (Builder $q): void {
                    $q->whereRaw("LOWER(kind) LIKE '%crane%'")
                        ->orWhereRaw("LOWER(subtype) LIKE '%crane%'");
                })
                ->where(function (Builder $q): void {
                    $q->whereNull('kind')
                        ->orWhereRaw("LOWER(kind) NOT LIKE '%tower_crane%'");
                })
                ->where(function (Builder $q): void {
                    $q->whereNull('subtype')
                        ->orWhereRaw("LOWER(subtype) NOT LIKE '%tower crane%'");
                }),
            'heavy_equipment' => $query->where(function (Builder $q): void {
                $q->whereRaw("LOWER(kind) LIKE '%equipment%'")
                    ->orWhereRaw("LOWER(subtype) LIKE '%excavator%'")
                    ->orWhereRaw("LOWER(subtype) LIKE '%loader%'");
            }),
            // Keep the legacy aliases valid for existing deep links and tests.
            'cranes' => $query->where(function (Builder $q): void {
                $q->whereRaw("LOWER(kind) LIKE '%crane%'")
                    ->orWhereRaw("LOWER(subtype) LIKE '%crane%'");
            }),
            'transport', 'trucks' => $query->where(function (Builder $q): void {
                $q->whereRaw("LOWER(kind) LIKE '%truck%'")
                    ->orWhereRaw("LOWER(kind) LIKE '%vehicle%'")
                    ->orWhereRaw("LOWER(kind) LIKE '%trailer%'")
                    ->orWhereRaw("LOWER(subtype) LIKE '%truck%'")
                    ->orWhereRaw("LOWER(subtype) LIKE '%trailer%'");
            }),
            'available' => $query->whereIn('status', ['available', 'ready_for_service'])
                ->whereDoesntHave('maintenanceWorkOrders', fn ($mwo) => $mwo->where('dispatch_blocking', true)->whereNull('released_at')),
            'maintenance' => $query->where(function (Builder $q): void {
                $q->whereIn('status', ['maintenance', 'out_of_service', 'under_maintenance'])
                    ->orWhereHas('maintenanceWorkOrders', fn ($mwo) => $mwo->where('dispatch_blocking', true)->whereNull('released_at'));
            }),
            default => null,
        };
    }
}
