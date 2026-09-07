<?php

namespace App\Platform\Workspace\Queries;

use App\Modules\Fuel\Models\FuelRequest;
use App\Platform\Identity\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Gate;

final class WorkspaceFuelRequestsQuery
{
    /**
     * @param  array{
     *     search?: string|null,
     *     status?: string|null,
     *     page?: int|null,
     *     per_page?: int|null,
     * }  $filters
     * @return LengthAwarePaginator<int, FuelRequest>
     */
    public function paginate(User $user, array $filters = []): LengthAwarePaginator
    {
        if (! Gate::forUser($user)->allows('viewAny', FuelRequest::class)) {
            /** @var LengthAwarePaginator<int, FuelRequest> $emptyPaginator */
            $emptyPaginator = new LengthAwarePaginator([], 0, 25, 1, ['path' => request()->url()]);

            return $emptyPaginator;
        }

        $query = FuelRequest::query()->visibleTo($user);

        $status = $filters['status'] ?? 'all';
        if ($status === 'pending') {
            $query->whereIn('status', ['submitted', 'forwarded']);
        } elseif ($status === 'anomalies') {
            $query->whereHas('logs', fn (Builder $q) => $q->where('is_anomaly', true));
        } elseif (in_array($status, ['submitted', 'forwarded', 'approved', 'verified', 'logged', 'rejected'], true)) {
            $query->where('status', $status);
        }

        $search = trim($filters['search'] ?? '');
        if ($search !== '') {
            $pattern = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], mb_strtolower($search)).'%';
            $query->where(function (Builder $q) use ($pattern): void {
                $q->whereRaw("LOWER(reference) LIKE ? ESCAPE '!'", [$pattern])
                    ->orWhereRaw("LOWER(purpose) LIKE ? ESCAPE '!'", [$pattern])
                    ->orWhereRaw("LOWER(fuel_type) LIKE ? ESCAPE '!'", [$pattern])
                    ->orWhereHas('requester', fn ($u) => $u->whereRaw("LOWER(name) LIKE ? ESCAPE '!'", [$pattern]))
                    ->orWhereHas('asset', fn ($a) => $a->whereRaw("LOWER(code) LIKE ? ESCAPE '!'", [$pattern])
                        ->orWhereRaw("LOWER(name) LIKE ? ESCAPE '!'", [$pattern])
                        ->orWhereRaw("LOWER(registration_number) LIKE ? ESCAPE '!'", [$pattern]))
                    ->orWhereHas('job', fn ($j) => $j->whereRaw("LOWER(reference) LIKE ? ESCAPE '!'", [$pattern])
                        ->orWhereRaw("LOWER(title) LIKE ? ESCAPE '!'", [$pattern]));
            });
        }

        $perPage = max(1, min(100, (int) ($filters['per_page'] ?? 25)));
        $pageNumber = max(1, (int) ($filters['page'] ?? 1));

        /** @var LengthAwarePaginator<int, FuelRequest> $paginator */
        $paginator = $query
            ->with([
                'requester:id,name',
                'job:id,reference,title',
                'asset:id,code,name,kind,subtype,registration_number,manufacturer,model,meter_type,meter_value,baseline_burn_rate,burn_rate_unit',
                'shift.user:id,name',
                'logs.recorder:id,name',
                'logs.attachments',
            ])
            ->latest('created_at')
            ->latest('id')
            ->paginate($perPage, ['*'], 'fuel_page', $pageNumber);

        return $paginator;
    }

    /**
     * @return array{total: int, pending: int, approved: int, verified: int, logged: int, anomalies: int}
     */
    public function counts(User $user): array
    {
        if (! Gate::forUser($user)->allows('viewAny', FuelRequest::class)) {
            return [
                'total' => 0,
                'pending' => 0,
                'approved' => 0,
                'verified' => 0,
                'logged' => 0,
                'anomalies' => 0,
            ];
        }

        $base = FuelRequest::query()->visibleTo($user);

        return [
            'total' => (clone $base)->count(),
            'pending' => (clone $base)->whereIn('status', ['submitted', 'forwarded'])->count(),
            'approved' => (clone $base)->where('status', 'approved')->count(),
            'verified' => (clone $base)->where('status', 'verified')->count(),
            'logged' => (clone $base)->where('status', 'logged')->count(),
            'anomalies' => (clone $base)->whereHas('logs', fn ($q) => $q->where('is_anomaly', true))->count(),
        ];
    }
}
