<?php

namespace App\Actions;

use App\Enums\DispatchStatus;
use App\Models\DispatchJob;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class TransitionDispatchJob
{
    public function __construct(private RecordAuditEvent $audit) {}

    public function handle(User $actor, DispatchJob $job, DispatchStatus $next, int $version): DispatchJob
    {
        Gate::forUser($actor)->authorize('updateOwnStatus', $job);
        $allowed = [
            DispatchStatus::Dispatched->value => [DispatchStatus::Accepted], DispatchStatus::Accepted->value => [DispatchStatus::EnRoute],
            DispatchStatus::EnRoute->value => [DispatchStatus::Arrived], DispatchStatus::Arrived->value => [DispatchStatus::Working],
            DispatchStatus::Working->value => [DispatchStatus::Completed],
        ];

        return DB::transaction(function () use ($actor, $job, $next, $version, $allowed): DispatchJob {
            $job = DispatchJob::query()->lockForUpdate()->findOrFail($job->id);
            if ($job->version !== $version || ! in_array($next, $allowed[$job->status->value] ?? [], true)) {
                throw ValidationException::withMessages(['status' => 'The requested status transition is no longer valid.']);
            }
            $before = $job->only(['status', 'version']);
            $job->update(['status' => $next, 'version' => $job->version + 1]);
            $this->audit->handle($actor, $job, 'dispatch.status_updated', $before, $job->only(['status', 'version']));

            return $job->refresh();
        });
    }
}
