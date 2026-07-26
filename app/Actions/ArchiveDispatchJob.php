<?php

namespace App\Actions;

use App\Enums\DispatchStatus;
use App\Models\DispatchJob;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class ArchiveDispatchJob
{
    public function __construct(private RecordAuditEvent $audit) {}

    public function handle(User $actor, DispatchJob $job, ?string $reason = null): DispatchJob
    {
        Gate::forUser($actor)->authorize('archive', $job);

        return DB::transaction(function () use ($actor, $job, $reason): DispatchJob {
            $job = DispatchJob::query()->lockForUpdate()->findOrFail($job->id);
            Gate::forUser($actor)->authorize('archive', $job);

            if (in_array($job->status, [
                DispatchStatus::Dispatched,
                DispatchStatus::Accepted,
                DispatchStatus::EnRoute,
                DispatchStatus::Arrived,
                DispatchStatus::Working,
            ], true)) {
                throw ValidationException::withMessages([
                    'status' => 'Active field jobs cannot be archived. Cancel or complete the dispatch first.',
                ]);
            }

            $activePersonnelAssignments = $job->personnelAssignments()
                ->whereNull('active_until')
                ->orderBy('id')
                ->lockForUpdate()
                ->get();
            $activeAssetAssignments = $job->assetAssignments()
                ->whereNull('active_until')
                ->orderBy('id')
                ->lockForUpdate()
                ->get();
            $before = [
                ...$job->only(['status', 'version', 'deleted_at']),
                'active_personnel_assignment_ids' => $activePersonnelAssignments->modelKeys(),
                'active_asset_assignment_ids' => $activeAssetAssignments->modelKeys(),
            ];
            $trimmedReason = $reason !== null ? trim($reason) : null;
            $auditReason = $trimmedReason !== '' ? $trimmedReason : null;
            $now = now();

            $activePersonnelAssignments->each->update(['active_until' => $now]);
            $activeAssetAssignments->each->update(['active_until' => $now]);

            $job->update(['version' => $job->version + 1]);

            $job->delete();

            $this->audit->handle(
                $actor,
                $job,
                'dispatch.archived',
                $before,
                [
                    ...$job->only(['status', 'version']),
                    'deleted_at' => $job->deleted_at?->toIso8601String(),
                    'ended_at' => $now->toIso8601String(),
                ],
                $auditReason,
            );

            return $job;
        });
    }
}
