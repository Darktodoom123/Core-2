<?php

namespace App\Platform\Workspace\Queries;

use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Models\ServiceRequest;
use App\Modules\Rental\Models\RentalReservation;
use App\Modules\Sales\Models\SalesOrder;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;

final class DispatchDeskJobsQuery
{
    private const array PREPARATION = ['draft', 'pending_approval', 'scheduled'];

    private const array EXECUTION = ['dispatched', 'accepted', 'en_route', 'arrived', 'working'];

    /**
     * @param  array{view: string, q?: string|null, source?: string, page?: int|string, ends_after?: string|null, starts_before?: string|null}  $filters
     * @return LengthAwarePaginator<int, DispatchJob>
     */
    public function paginate(User $user, array $filters): LengthAwarePaginator
    {
        $canViewAllAssignments = $user->can(PermissionName::AssignmentsViewAll->value);
        $query = DispatchJob::query()->visibleTo($user)->with([
            'personnelAssignments' => fn ($assignment) => $assignment->whereNull('active_until')
                ->when(! $canViewAllAssignments, fn ($assignment) => $assignment->where('user_id', $user->id))
                ->with('user:id,name'),
            'assetAssignments' => fn ($assignment) => $assignment->whereNull('active_until')->with('asset:id,code,name'),
            'source', 'serviceRequest:id,reference', 'canonicalHandoff',
            'latestDelay.reporter:id,name', 'latestDelay.operationalAsset:id,code,name',
        ])->whereIn('status', match ($filters['view']) {
            'history' => ['completed', 'cancelled'],
            'in-progress' => self::EXECUTION,
            default => [...self::PREPARATION, ...self::EXECUTION],
        });

        if ($filters['view'] === 'schedule' && isset($filters['starts_before'], $filters['ends_after'])) {
            $startsBefore = CarbonImmutable::parse($filters['starts_before'])->utc();
            $endsAfter = CarbonImmutable::parse($filters['ends_after'])->utc();
            $query->where(function (Builder $interval) use ($startsBefore, $endsAfter): void {
                $interval->where(function (Builder $dated) use ($startsBefore, $endsAfter): void {
                    $dated->where('scheduled_start', '<', $startsBefore)
                        ->where('scheduled_end', '>', $endsAfter)
                        ->whereColumn('scheduled_end', '>', 'scheduled_start');
                })->orWhere(fn (Builder $undated) => $undated->whereIn('status', self::PREPARATION)
                    ->whereNull('scheduled_start')->whereNull('scheduled_end'));
            });
        }

        $source = $filters['source'] ?? 'all';
        if ($source !== 'all') {
            $this->filterSource($query, $source);
        }

        $search = trim($filters['q'] ?? '');
        if ($search !== '') {
            // Escape LIKE wildcards so a typed reference is a literal substring.
            $pattern = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], mb_strtolower($search)).'%';
            $query->where(function (Builder $matching) use ($pattern): void {
                foreach (['reference', 'title', 'client', 'site', 'source_reference'] as $column) {
                    $matching->orWhereRaw("LOWER({$column}) LIKE ? ESCAPE '!'", [$pattern]);
                }
                $matching->orWhereHasMorph('source', [ServiceRequest::class, RentalReservation::class, SalesOrder::class],
                    fn (Builder $source) => $source->whereRaw("LOWER(reference) LIKE ? ESCAPE '!'", [$pattern]))
                    ->orWhereHas('serviceRequest', fn (Builder $source) => $source->whereRaw("LOWER(reference) LIKE ? ESCAPE '!'", [$pattern]))
                    ->orWhereHas('canonicalHandoff', fn (Builder $handoff) => $handoff
                        ->whereRaw("LOWER(external_reference) LIKE ? ESCAPE '!'", [$pattern])
                        ->orWhereRaw("LOWER(source_reference) LIKE ? ESCAPE '!'", [$pattern]));
            });
        }

        return $query
            ->orderByRaw("CASE WHEN status IN ('dispatched', 'accepted', 'en_route', 'arrived', 'working') THEN 0 WHEN status IN ('draft', 'pending_approval', 'scheduled') THEN 1 ELSE 2 END")
            ->orderByRaw("CASE WHEN status NOT IN ('completed', 'cancelled') AND scheduled_start IS NULL THEN 0 ELSE 1 END")
            ->orderByRaw("CASE WHEN status NOT IN ('completed', 'cancelled') THEN scheduled_start END ASC")
            ->orderByRaw("CASE WHEN status IN ('completed', 'cancelled') THEN updated_at END DESC")
            ->orderByDesc('id')
            ->paginate(25, ['*'], 'page', (int) ($filters['page'] ?? 1));
    }

    /** @param Builder<DispatchJob> $query */
    private function filterSource(Builder $query, string $source): void
    {
        // Match the view model's explicit source, legacy service, then canonical fallback.
        $query->where(function (Builder $matching) use ($source): void {
            $matching->where('source_type', $source)->orWhere(function (Builder $legacy) use ($source): void {
                $legacy->whereNull('source_type')->where(function (Builder $fallback) use ($source): void {
                    if ($source === 'service_request') {
                        $fallback->whereNotNull('service_request_id')->orWhere(fn (Builder $canonical) => $canonical
                            ->whereNull('service_request_id')
                            ->whereHas('canonicalHandoff', fn (Builder $handoff) => $handoff->where('source_type', $source)));

                        return;
                    }
                    $fallback->whereNull('service_request_id')->where(function (Builder $canonical) use ($source): void {
                        $canonical->whereHas('canonicalHandoff', fn (Builder $handoff) => $handoff->where('source_type', $source));
                        if ($source === 'manual') {
                            $canonical->orWhereDoesntHave('canonicalHandoff');
                        }
                    });
                });
            });
        });
    }
}
