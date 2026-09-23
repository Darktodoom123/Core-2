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
use Illuminate\Support\Facades\DB;

final class DispatchDeskJobsQuery
{
    private const array PREPARATION = ['draft', 'pending_approval', 'scheduled'];

    private const array EXECUTION = ['dispatched', 'accepted', 'en_route', 'arrived', 'working'];

    /**
     * @param  array{view: string, q?: string|null, source?: string, page?: int|string, ends_after?: string|null, starts_before?: string|null, attention?: bool, needs_assignment?: bool}  $filters
     * @return LengthAwarePaginator<int, DispatchJob>
     */
    public function paginate(User $user, array $filters): LengthAwarePaginator
    {
        $query = $this->query($user, $filters);

        return $query
            ->orderByRaw("CASE WHEN status IN ('dispatched', 'accepted', 'en_route', 'arrived', 'working') THEN 0 WHEN status IN ('draft', 'pending_approval', 'scheduled') THEN 1 ELSE 2 END")
            ->orderByRaw("CASE WHEN status NOT IN ('completed', 'cancelled') AND scheduled_start IS NULL THEN 0 ELSE 1 END")
            ->orderByRaw("CASE WHEN status NOT IN ('completed', 'cancelled') THEN scheduled_start END ASC")
            ->orderByRaw("CASE WHEN status IN ('completed', 'cancelled') THEN updated_at END DESC")
            ->orderByDesc('id')
            ->paginate(25, ['*'], 'page', (int) ($filters['page'] ?? 1));
    }

    /**
     * @param  array{view: string, q?: string|null, source?: string, page?: int|string, ends_after?: string|null, starts_before?: string|null, attention?: bool, needs_assignment?: bool}  $filters
     */
    public function attentionCount(User $user, array $filters): int
    {
        if ($filters['view'] === 'history') {
            return 0;
        }

        $filters['attention'] = true;
        $filters['needs_assignment'] = false;

        return $this->query($user, $filters)->count();
    }

    /**
     * @param  array{view: string, q?: string|null, source?: string, page?: int|string, ends_after?: string|null, starts_before?: string|null, attention?: bool, needs_assignment?: bool}  $filters
     */
    public function needsAssignmentCount(User $user, array $filters): int
    {
        if ($filters['view'] !== 'schedule') {
            return 0;
        }

        $filters['attention'] = false;
        $filters['needs_assignment'] = true;

        return $this->query($user, $filters)->count();
    }

    /** @param array{view: string, q?: string|null, page?: int|string, source?: string, ends_after?: string|null, starts_before?: string|null, attention?: bool, needs_assignment?: bool} $filters
     * @return Builder<DispatchJob>
     */
    private function query(User $user, array $filters): Builder
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

        if (($filters['attention'] ?? false) && $filters['view'] !== 'history') {
            $this->filterAttention($query, $user);
        }

        if (($filters['needs_assignment'] ?? false) && $filters['view'] === 'schedule') {
            $this->filterNeedsAssignment($query);
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

        return $query;
    }

    /** @param Builder<DispatchJob> $query */
    private function filterNeedsAssignment(Builder $query): void
    {
        $query->where(function (Builder $needsAssignment): void {
            $needsAssignment->where('status', 'draft')
                ->orWhere(function (Builder $preparation): void {
                    $preparation->whereIn('status', self::PREPARATION)
                        ->where(function (Builder $missing): void {
                            $missing->whereDoesntHave('personnelAssignments', fn (Builder $assignments) => $assignments->whereNull('active_until'))
                                ->orWhereDoesntHave('assetAssignments', fn (Builder $assignments) => $assignments->whereNull('active_until'));
                        });
                });
        });
    }

    /** @param Builder<DispatchJob> $query */
    private function filterAttention(Builder $query, User $user): void
    {
        $query->where(function (Builder $attention) use ($user): void {
            $attention->where('status', 'pending_approval')
                ->orWhereHas('personnelAssignments', fn (Builder $assignments) => $assignments
                    ->whereNull('active_until')->where('response_status', 'rejected'))
                ->orWhere(function (Builder $unassigned): void {
                    $unassigned->whereIn('status', ['draft', 'pending_approval'])
                        ->whereDoesntHave('personnelAssignments', fn (Builder $assignments) => $assignments->whereNull('active_until'))
                        ->whereDoesntHave('assetAssignments', fn (Builder $assignments) => $assignments->whereNull('active_until'));
                })
                ->orWhereHas('assetAssignments', fn (Builder $assignments) => $assignments
                    ->whereNull('active_until')
                    ->whereHas('asset', fn (Builder $asset) => $asset
                        ->whereNotIn('status', ['available', 'ready_for_service'])
                        ->orWhereHas('maintenanceWorkOrders', fn (Builder $orders) => $orders
                            ->where('dispatch_blocking', true)->whereNull('released_at'))
                        ->orWhereNotExists($this->latestPassingInspectionQuery())))
                ->orWhereExists($this->assetOverlapQuery())
                ->orWhereExists($this->personnelOverlapQuery($user));

            if ($user->can(PermissionName::AssignmentsApprove->value) || $user->can(PermissionName::DispatchApprovePriority->value)) {
                $kinds = array_values(array_filter([
                    $user->can(PermissionName::AssignmentsApprove->value) ? 'assignment_override' : null,
                    $user->can(PermissionName::AssignmentsApprove->value) ? 'reassignment_override' : null,
                    $user->can(PermissionName::DispatchApprovePriority->value) ? 'dispatch_activation' : null,
                ]));

                $attention->orWhereHas('approvals', fn (Builder $approvals) => $approvals
                    ->whereIn('kind', $kinds)->where('status', 'pending'));
            }

            if ($user->can(PermissionName::GptUseDispatch->value)) {
                $dispatchMorphClass = (new DispatchJob)->getMorphClass();
                $attention->orWhereExists(static fn ($recommendations) => $recommendations
                    ->selectRaw('1')->from('gpt_recommendations')
                    ->whereColumn('gpt_recommendations.subject_id', 'dispatch_jobs.id')
                    ->where('gpt_recommendations.subject_type', $dispatchMorphClass)
                    ->where('gpt_recommendations.purpose', 'dispatch_assignment')
                    ->where('gpt_recommendations.status', 'pending_review')
                    ->where(fn ($expiry) => $expiry->whereNull('gpt_recommendations.expires_at')->orWhere('gpt_recommendations.expires_at', '>', now()))
                    ->whereJsonLength('gpt_recommendations.conflicts', '>', 0));
            }
        });
    }

    private function assetOverlapQuery(): \Illuminate\Database\Query\Builder
    {
        return DB::table('dispatch_asset_assignments as current_assignment')
            ->join('dispatch_asset_assignments as other_assignment', function ($join): void {
                $join->on('other_assignment.operational_asset_id', '=', 'current_assignment.operational_asset_id')
                    ->whereColumn('other_assignment.dispatch_job_id', '<>', 'current_assignment.dispatch_job_id');
            })
            ->join('dispatch_jobs as other_job', 'other_job.id', '=', 'other_assignment.dispatch_job_id')
            ->whereColumn('current_assignment.dispatch_job_id', 'dispatch_jobs.id')
            ->whereNull('current_assignment.active_until')->whereNull('other_assignment.active_until')
            ->whereNull('other_job.deleted_at')->whereNotIn('other_job.status', ['completed', 'cancelled'])
            ->whereNotNull('dispatch_jobs.scheduled_start')->whereNotNull('dispatch_jobs.scheduled_end')
            ->whereNotNull('other_job.scheduled_start')->whereNotNull('other_job.scheduled_end')
            ->whereColumn('dispatch_jobs.scheduled_end', '>', 'dispatch_jobs.scheduled_start')
            ->whereColumn('other_job.scheduled_end', '>', 'other_job.scheduled_start')
            ->whereColumn('dispatch_jobs.scheduled_start', '<', 'other_job.scheduled_end')
            ->whereColumn('other_job.scheduled_start', '<', 'dispatch_jobs.scheduled_end')
            ->selectRaw('1');
    }

    private function latestPassingInspectionQuery(): \Illuminate\Database\Query\Builder
    {
        $candidate = DB::query()
            ->fromSub($this->assetInspectionOutcomesQuery(), 'candidate_inspection')
            ->whereColumn('candidate_inspection.operational_asset_id', 'operational_assets.id')
            ->where('candidate_inspection.is_passing', 1);
        $newerInspection = DB::query()
            ->fromSub($this->assetInspectionOutcomesQuery(), 'newer_inspection')
            ->whereColumn('newer_inspection.operational_asset_id', 'candidate_inspection.operational_asset_id')
            ->where(function (\Illuminate\Database\Query\Builder $newer): void {
                $newer->whereColumn('newer_inspection.completed_at', '>', 'candidate_inspection.completed_at')
                    ->orWhere(function (\Illuminate\Database\Query\Builder $sameTime): void {
                        $sameTime->whereColumn('newer_inspection.completed_at', '=', 'candidate_inspection.completed_at')
                            ->where(function (\Illuminate\Database\Query\Builder $higherPriority): void {
                                $higherPriority->whereColumn('newer_inspection.source_priority', '>', 'candidate_inspection.source_priority')
                                    ->orWhere(fn (\Illuminate\Database\Query\Builder $sameSource) => $sameSource
                                        ->whereColumn('newer_inspection.source_priority', '=', 'candidate_inspection.source_priority')
                                        ->whereColumn('newer_inspection.inspection_id', '>', 'candidate_inspection.inspection_id'));
                            });
                    });
            })
            ->selectRaw('1');

        return $candidate->whereNotExists($newerInspection)->selectRaw('1');
    }

    private function assetInspectionOutcomesQuery(): \Illuminate\Database\Query\Builder
    {
        $legacyInspections = DB::table('inspections')
            ->whereNotNull('completed_at')
            ->select('operational_asset_id', 'completed_at', 'id as inspection_id')
            ->selectRaw("CASE WHEN result = 'passed' THEN 1 ELSE 0 END as is_passing")
            ->selectRaw('2 as source_priority');
        $dvirInspections = DB::table('dvir_inspections')
            ->whereNotNull('completed_at')
            ->select('operational_asset_id', 'completed_at', 'id as inspection_id')
            ->selectRaw('CASE WHEN has_defects = FALSE AND critical_defects_count = 0 THEN 1 ELSE 0 END as is_passing')
            ->selectRaw('1 as source_priority');

        return $legacyInspections->unionAll($dvirInspections);
    }

    private function personnelOverlapQuery(User $user): \Illuminate\Database\Query\Builder
    {
        $query = DB::table('dispatch_personnel_assignments as current_assignment')
            ->join('dispatch_personnel_assignments as other_assignment', function ($join): void {
                $join->on('other_assignment.user_id', '=', 'current_assignment.user_id')
                    ->whereColumn('other_assignment.dispatch_job_id', '<>', 'current_assignment.dispatch_job_id');
            })
            ->join('dispatch_jobs as other_job', 'other_job.id', '=', 'other_assignment.dispatch_job_id')
            ->whereColumn('current_assignment.dispatch_job_id', 'dispatch_jobs.id')
            ->whereNull('current_assignment.active_until')->whereNull('other_assignment.active_until')
            ->whereNull('other_job.deleted_at')->whereNotIn('other_job.status', ['completed', 'cancelled'])
            ->whereNotNull('dispatch_jobs.scheduled_start')->whereNotNull('dispatch_jobs.scheduled_end')
            ->whereNotNull('other_job.scheduled_start')->whereNotNull('other_job.scheduled_end')
            ->whereColumn('dispatch_jobs.scheduled_end', '>', 'dispatch_jobs.scheduled_start')
            ->whereColumn('other_job.scheduled_end', '>', 'other_job.scheduled_start')
            ->whereColumn('dispatch_jobs.scheduled_start', '<', 'other_job.scheduled_end')
            ->whereColumn('other_job.scheduled_start', '<', 'dispatch_jobs.scheduled_end')
            ->selectRaw('1');

        if (! $user->can(PermissionName::AssignmentsViewAll->value)) {
            $query->where('current_assignment.user_id', $user->id);
        }

        return $query;
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
