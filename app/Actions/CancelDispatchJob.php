<?php

namespace App\Actions;

use App\Enums\DispatchStatus;
use App\Models\DispatchJob;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class CancelDispatchJob
{
    public function __construct(private RecordAuditEvent $audit) {}

    public function handle(User $actor, DispatchJob $job, string $reason, int $version): DispatchJob
    {
        Gate::forUser($actor)->authorize('cancel', $job);

        $trimmedReason = trim($reason);
        if ($trimmedReason === '') {
            throw ValidationException::withMessages([
                'reason' => 'A cancellation reason is required.',
            ]);
        }

        return DB::transaction(function () use ($actor, $job, $trimmedReason, $version): DispatchJob {
            $job = DispatchJob::query()->lockForUpdate()->findOrFail($job->id);

            if ($job->version !== $version) {
                throw ValidationException::withMessages([
                    'version' => 'This dispatch changed on another device. Refresh and review it again.',
                ]);
            }

            if (in_array($job->status, [DispatchStatus::Completed, DispatchStatus::Cancelled], true)) {
                throw ValidationException::withMessages([
                    'status' => 'Completed or already cancelled jobs cannot be cancelled.',
                ]);
            }

            $now = now();
            $job->personnelAssignments()
                ->whereNull('active_until')
                ->lockForUpdate()
                ->get();
            $job->personnelAssignments()
                ->whereNull('active_until')
                ->update(['active_until' => $now]);

            $job->assetAssignments()
                ->whereNull('active_until')
                ->lockForUpdate()
                ->get();
            $job->assetAssignments()
                ->whereNull('active_until')
                ->update(['active_until' => $now]);

            $before = $job->only(['status', 'version', 'cancelled_by', 'cancellation_reason']);
            $job->update([
                'status' => DispatchStatus::Cancelled,
                'cancelled_by' => $actor->id,
                'cancellation_reason' => $trimmedReason,
                'version' => $job->version + 1,
            ]);

            $this->audit->handle(
                $actor,
                $job,
                'dispatch.cancelled',
                $before,
                $job->only(['status', 'version', 'cancelled_by', 'cancellation_reason']),
                $trimmedReason,
            );

            return $job->refresh();
        });
    }
}
