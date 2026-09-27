<?php

namespace App\Modules\Dispatch\Queries;

use App\Modules\Assignment\Enums\AssignmentResponse;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * Which finished jobs belong to a field operator's history: completed or
 * cancelled jobs they were still assigned to when the job finished.
 * Declined jobs and jobs they were reassigned off beforehand are excluded.
 */
final class FieldJobHistoryQuery
{
    public const FINISHED_STATUSES = [DispatchStatus::Completed, DispatchStatus::Cancelled];

    /** Finish time for ordering and windowing; updated_at only covers rows with no recorded finish. */
    public const FINISHED_AT = 'COALESCE(dispatch_jobs.completed_at, dispatch_jobs.cancelled_at, dispatch_jobs.updated_at)';

    /** @return Builder<DispatchJob> */
    public function forUser(User $user): Builder
    {
        $finishedAt = self::FINISHED_AT;

        return DispatchJob::query()
            ->whereIn('status', self::FINISHED_STATUSES)
            ->whereExists(function ($query) use ($user, $finishedAt): void {
                $query->selectRaw('1')
                    ->from('dispatch_personnel_assignments')
                    ->whereColumn('dispatch_personnel_assignments.dispatch_job_id', 'dispatch_jobs.id')
                    ->where('dispatch_personnel_assignments.user_id', $user->id)
                    ->where('dispatch_personnel_assignments.response_status', '!=', AssignmentResponse::Rejected->value)
                    ->where(function ($query) use ($finishedAt): void {
                        $query->whereNull('dispatch_personnel_assignments.active_until')
                            ->orWhereRaw("dispatch_personnel_assignments.active_until >= {$finishedAt}");
                    });
            });
    }

    /** @return Builder<DispatchJob> */
    public function recent(User $user, int $days): Builder
    {
        return $this->forUser($user)
            ->whereRaw(self::FINISHED_AT.' >= ?', [now()->subDays($days)])
            ->orderByRaw(self::FINISHED_AT.' DESC')
            ->orderByDesc('id');
    }

    public function includes(User $user, DispatchJob $job): bool
    {
        return $this->forUser($user)->whereKey($job->id)->exists();
    }
}
