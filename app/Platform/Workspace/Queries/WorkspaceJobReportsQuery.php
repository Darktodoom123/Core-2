<?php

namespace App\Platform\Workspace\Queries;

use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Models\JobReport;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;

final class WorkspaceJobReportsQuery
{
    /**
     * @param  array{
     *     search?: string|null,
     *     status?: string|null,
     *     job_id?: int|null,
     *     page?: int|null,
     *     per_page?: int|null,
     * }  $filters
     * @return LengthAwarePaginator<int, JobReport>
     */
    public function paginate(User $user, array $filters = []): LengthAwarePaginator
    {
        if (! $user->can(PermissionName::ReportsViewAll->value)
            && ! $user->can(PermissionName::ReportsViewDispatch->value)
            && ! $user->can(PermissionName::ReportsViewOwn->value)) {
            /** @var LengthAwarePaginator<int, JobReport> $emptyPaginator */
            $emptyPaginator = new LengthAwarePaginator([], 0, 25, 1, ['path' => request()->url()]);

            return $emptyPaginator;
        }

        $query = JobReport::query()->visibleTo($user);

        $status = $filters['status'] ?? 'all';
        if (in_array($status, ['draft', 'submitted', 'approved', 'rejected'], true)) {
            $query->where('status', $status);
        }

        if (! empty($filters['job_id'])) {
            $query->where('dispatch_job_id', (int) $filters['job_id']);
        }

        $search = trim($filters['search'] ?? '');
        if ($search !== '') {
            $pattern = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], mb_strtolower($search)).'%';
            $query->where(function (Builder $q) use ($pattern, $search): void {
                $q->whereRaw("LOWER(work_summary) LIKE ? ESCAPE '!'", [$pattern])
                    ->orWhereRaw("LOWER(remarks) LIKE ? ESCAPE '!'", [$pattern])
                    ->orWhereHas('author', fn ($u) => $u->whereRaw("LOWER(name) LIKE ? ESCAPE '!'", [$pattern]))
                    ->orWhereHas('job', fn ($j) => $j->whereRaw("LOWER(reference) LIKE ? ESCAPE '!'", [$pattern])
                        ->orWhereRaw("LOWER(title) LIKE ? ESCAPE '!'", [$pattern]));

                if (is_numeric($search)) {
                    $q->orWhere('id', (int) $search)
                        ->orWhere('dispatch_job_id', (int) $search);
                }
            });
        }

        $perPage = max(1, min(100, (int) ($filters['per_page'] ?? 25)));
        $pageNumber = max(1, (int) ($filters['page'] ?? 1));

        /** @var LengthAwarePaginator<int, JobReport> $paginator */
        $paginator = $query
            ->with([
                'job:id,reference,title',
                'job.dvirInspections:id,dispatch_job_id,inspection_type,has_defects,critical_defects_count',
                'job.fuelRequests:id,dispatch_job_id,reference,quantity_litres',
                'author:id,name',
                'attachments',
            ])
            ->orderByRaw('COALESCE(submitted_at, created_at) DESC')
            ->orderByDesc('id')
            ->paginate($perPage, ['*'], 'report_page', $pageNumber);

        return $paginator;
    }

    /**
     * @param  array{job_id?: int|null}  $filters
     * @return array{total: int, draft: int, submitted: int, approved: int, rejected: int}
     */
    public function stats(User $user, array $filters = []): array
    {
        if (! $user->can(PermissionName::ReportsViewAll->value)
            && ! $user->can(PermissionName::ReportsViewDispatch->value)
            && ! $user->can(PermissionName::ReportsViewOwn->value)) {
            return [
                'total' => 0,
                'draft' => 0,
                'submitted' => 0,
                'approved' => 0,
                'rejected' => 0,
            ];
        }

        $base = JobReport::query()->visibleTo($user);
        if (! empty($filters['job_id'])) {
            $base->where('dispatch_job_id', (int) $filters['job_id']);
        }

        return [
            'total' => (clone $base)->count(),
            'draft' => (clone $base)->where('status', 'draft')->count(),
            'submitted' => (clone $base)->where('status', 'submitted')->count(),
            'approved' => (clone $base)->where('status', 'approved')->count(),
            'rejected' => (clone $base)->where('status', 'rejected')->count(),
        ];
    }
}
