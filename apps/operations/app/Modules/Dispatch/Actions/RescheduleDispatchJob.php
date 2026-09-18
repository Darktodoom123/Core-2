<?php

namespace App\Modules\Dispatch\Actions;

use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use App\Platform\Notifications\DispatchScheduleChangeNotification;
use App\Platform\Notifications\Jobs\SendQueuedNotificationJob;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class RescheduleDispatchJob
{
    public function __construct(private RecordAuditEvent $audit) {}

    public function handle(
        User $actor,
        DispatchJob $job,
        Carbon|string $scheduledStart,
        Carbon|string $scheduledEnd,
        ?string $reason = null,
        int $version = 1,
    ): DispatchJob {
        Gate::forUser($actor)->authorize('update', $job);

        $parsedStart = $scheduledStart instanceof Carbon ? $scheduledStart : Carbon::parse($scheduledStart);
        $parsedEnd = $scheduledEnd instanceof Carbon ? $scheduledEnd : Carbon::parse($scheduledEnd);

        if ($parsedEnd->lessThanOrEqualTo($parsedStart)) {
            throw ValidationException::withMessages([
                'scheduled_end' => 'The scheduled end time must be after the scheduled start time.',
            ]);
        }

        return DB::transaction(function () use ($actor, $job, $parsedStart, $parsedEnd, $reason, $version): DispatchJob {
            /** @var DispatchJob $job */
            $job = DispatchJob::query()->lockForUpdate()->findOrFail($job->id);

            if ($job->version !== $version) {
                throw ValidationException::withMessages([
                    'version' => 'This dispatch changed on another device. Refresh and review it again.',
                ]);
            }

            if (in_array($job->status, [DispatchStatus::Completed, DispatchStatus::Cancelled], true)) {
                throw ValidationException::withMessages([
                    'status' => 'Completed or cancelled jobs cannot be rescheduled.',
                ]);
            }

            $before = [
                'scheduled_start' => $job->scheduled_start?->toIso8601String(),
                'scheduled_end' => $job->scheduled_end?->toIso8601String(),
                'version' => $job->version,
            ];

            $job->update([
                'scheduled_start' => $parsedStart,
                'scheduled_end' => $parsedEnd,
                'version' => $job->version + 1,
            ]);

            $this->audit->handle(
                $actor,
                $job,
                'dispatch.rescheduled',
                $before,
                $job->only(['scheduled_start', 'scheduled_end', 'version']),
                $reason,
            );

            $assignedPersonnel = $job->personnelAssignments()
                ->whereNull('active_until')
                ->with('user')
                ->get();

            $description = $reason ?? sprintf(
                'Shift moved to %s - %s',
                $parsedStart->format('M d, H:i'),
                $parsedEnd->format('H:i')
            );

            DB::afterCommit(function () use ($job, $assignedPersonnel, $description): void {
                foreach ($assignedPersonnel as $assignment) {
                    $user = $assignment->user;
                    if ($user && $user->is_active) {
                        SendQueuedNotificationJob::dispatch(
                            $user,
                            new DispatchScheduleChangeNotification($job, $description)
                        );
                    }
                }
            });

            return $job->refresh();
        });
    }
}
