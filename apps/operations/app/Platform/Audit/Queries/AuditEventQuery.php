<?php

namespace App\Platform\Audit\Queries;

use App\Platform\Audit\Enums\AuditCategory;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

final class AuditEventQuery
{
    private const MAX_ACTORS = 200;

    /**
     * @param  array{category: AuditCategory|null, actor: string|null, from: string|null, to: string|null, q: string|null, per_page: int}  $filters
     * @return LengthAwarePaginator<int, AuditEvent>
     */
    public function paginate(array $filters): LengthAwarePaginator
    {
        $query = $this->scoped($filters);

        if ($filters['category'] !== null) {
            [$clause, $bindings] = $filters['category']->sql();
            $query->whereRaw($clause, $bindings);
        }

        return $query->with('actor:id,name')
            ->orderByDesc('occurred_at')
            ->orderByDesc('id')
            ->paginate($filters['per_page']);
    }

    /**
     * Counts for every category within the same actor, date, and search scope,
     * in one aggregate query so the filter chips never disagree with the list.
     *
     * @param  array{category: AuditCategory|null, actor: string|null, from: string|null, to: string|null, q: string|null, per_page: int}  $filters
     * @return array<string, int>
     */
    public function counts(array $filters): array
    {
        $selects = ['COUNT(*) AS count_all'];
        $bindings = [];

        foreach (AuditCategory::cases() as $category) {
            [$clause, $categoryBindings] = $category->sql();
            $selects[] = "SUM(CASE WHEN {$clause} THEN 1 ELSE 0 END) AS count_{$category->value}";
            array_push($bindings, ...$categoryBindings);
        }

        $row = $this->scoped($filters)->toBase()->selectRaw(implode(', ', $selects), $bindings)->first();
        $counts = ['all' => (int) ($row->count_all ?? 0)];

        foreach (AuditCategory::cases() as $category) {
            $counts[$category->value] = (int) ($row->{"count_{$category->value}"} ?? 0);
        }

        return $counts;
    }

    public function countSince(CarbonInterface $since): int
    {
        return AuditEvent::query()->where('occurred_at', '>=', $since)->count();
    }

    /** @return Collection<int, array{id: int, name: string}> */
    public function actors(): Collection
    {
        return User::query()
            ->whereIn('id', AuditEvent::query()->select('actor_id')->whereNotNull('actor_id')->distinct())
            ->orderBy('name')
            ->limit(self::MAX_ACTORS)
            ->get(['id', 'name'])
            ->map(static fn (User $user): array => ['id' => (int) $user->id, 'name' => (string) $user->name])
            ->values();
    }

    /**
     * @param  array{category: AuditCategory|null, actor: string|null, from: string|null, to: string|null, q: string|null, per_page: int}  $filters
     * @return Builder<AuditEvent>
     */
    private function scoped(array $filters): Builder
    {
        $query = AuditEvent::query();

        if ($filters['actor'] === 'system') {
            $query->whereNull('actor_id');
        } elseif ($filters['actor'] !== null) {
            $query->where('actor_id', (int) $filters['actor']);
        }

        if ($filters['from'] !== null) {
            $query->where('occurred_at', '>=', $this->bound($filters['from'], startOfDay: true));
        }

        if ($filters['to'] !== null) {
            $query->where('occurred_at', '<=', $this->bound($filters['to'], startOfDay: false));
        }

        if ($filters['q'] !== null) {
            $term = '%'.addcslashes(mb_strtolower($filters['q']), '%_\\').'%';
            $query->where(static function (Builder $search) use ($term): void {
                $search->whereRaw("LOWER(action) LIKE ? ESCAPE '\\'", [$term])
                    ->orWhereRaw("LOWER(COALESCE(reason, '')) LIKE ? ESCAPE '\\'", [$term])
                    ->orWhereRaw("LOWER(COALESCE(CAST(request_id AS TEXT), '')) LIKE ? ESCAPE '\\'", [$term]);
            });
        }

        return $query;
    }

    /** A bare date covers the whole day; a timestamp is used exactly. */
    private function bound(string $value, bool $startOfDay): Carbon
    {
        $moment = Carbon::parse($value);

        if (strlen($value) === 10) {
            return $startOfDay ? $moment->startOfDay() : $moment->endOfDay();
        }

        return $moment->utc();
    }
}
