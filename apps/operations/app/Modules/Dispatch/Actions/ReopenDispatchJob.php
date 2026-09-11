<?php

namespace App\Modules\Dispatch\Actions;

use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class ReopenDispatchJob
{
    public function __construct(private RecordAuditEvent $audit) {}

    public function handle(User $actor, DispatchJob $job, ?string $reason, int $version): DispatchJob
    {
        Gate::forUser($actor)->authorize('reopen', $job);

        return DB::transaction(function () use ($actor, $job, $reason, $version): DispatchJob {
            $job = DispatchJob::query()->lockForUpdate()->findOrFail($job->id);

            if ($job->version !== $version) {
                throw ValidationException::withMessages([
                    'version' => 'This dispatch changed on another device. Refresh and review it again.',
                ]);
            }

            if ($job->status !== DispatchStatus::Cancelled) {
                throw ValidationException::withMessages([
                    'status' => 'Only cancelled dispatch jobs can be reopened.',
                ]);
            }

            $before = $job->only(['status', 'version', 'cancelled_by', 'cancellation_reason']);
            $job->update([
                'status' => DispatchStatus::Draft,
                'cancelled_by' => null,
                'cancellation_reason' => null,
                'version' => $job->version + 1,
            ]);

            $trimmedReason = $reason !== null ? trim($reason) : null;
            $this->audit->handle(
                $actor,
                $job,
                'dispatch.reopened',
                $before,
                $job->only(['status', 'version', 'cancelled_by', 'cancellation_reason']),
                $trimmedReason !== '' ? $trimmedReason : null,
            );

            return $job->refresh();
        });
    }
}
