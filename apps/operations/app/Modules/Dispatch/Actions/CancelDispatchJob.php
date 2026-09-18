<?php

namespace App\Modules\Dispatch\Actions;

use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use App\Platform\Notifications\DispatchCancellationNotification;
use App\Platform\Notifications\Jobs\SendQueuedNotificationJob;
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
            $affectedPersonnel = $job->personnelAssignments()
                ->whereNull('active_until')
                ->lockForUpdate()
                ->with('user')
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

            DB::afterCommit(function () use ($job, $affectedPersonnel, $trimmedReason): void {
                foreach ($affectedPersonnel as $assignment) {
                    $user = $assignment->user;
                    if ($user && $user->is_active) {
                        SendQueuedNotificationJob::dispatch(
                            $user,
                            new DispatchCancellationNotification($job, $trimmedReason)
                        );
                    }
                }
            });

            return $job->refresh();
        });
    }
}
