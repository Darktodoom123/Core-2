<?php

namespace App\Modules\Dispatch\Services;

use App\Modules\Dispatch\Contracts\DispatchScheduleReader;
use App\Modules\Dispatch\Data\DispatchScheduleWindow;
use App\Modules\Dispatch\Models\DispatchJob;

final class EloquentDispatchScheduleReader implements DispatchScheduleReader
{
    /**
     * @param  array<int, int|string>  $dispatchJobIds
     * @return list<DispatchScheduleWindow>
     */
    public function windowsForJobIds(array $dispatchJobIds): array
    {
        $ids = array_values(array_unique(array_map(static fn (int|string $id): int => (int) $id, $dispatchJobIds)));
        if ($ids === []) {
            return [];
        }

        return array_values(DispatchJob::query()
            ->whereIn('id', $ids)
            ->get(['id', 'reference', 'scheduled_start', 'scheduled_end'])
            ->map(static fn (DispatchJob $job): DispatchScheduleWindow => new DispatchScheduleWindow(
                (int) $job->id,
                (string) $job->reference,
                $job->scheduled_start?->toImmutable(),
                $job->scheduled_end?->toImmutable(),
            ))
            ->all());
    }
}
