<?php

namespace App\Modules\Dispatch\Planning\Services;

use App\Modules\Dispatch\Actions\CancelDispatchJob;
use App\Modules\Dispatch\Actions\ReopenDispatchJob;
use App\Modules\Dispatch\Commands\DispatchV2Commands;
use App\Modules\Dispatch\Data\DispatchV2Mutation;
use App\Modules\Dispatch\Exceptions\DispatchV2CommandException;
use App\Modules\Dispatch\Models\DispatchHandoff;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Planning\Models\ProjectPlan;
use App\Modules\Dispatch\Planning\Models\ProjectShift;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class ProjectShiftLifecycle
{
    public function __construct(
        private readonly CancelDispatchJob $cancelJob,
        private readonly ReopenDispatchJob $reopenJob,
        private readonly DispatchV2Commands $commands,
        private readonly RecordAuditEvent $audit,
    ) {}

    public function cancel(User $actor, DispatchJob $job, int $version, string $reason): DispatchJob
    {
        return $this->change($actor, $job, $version, $reason, false);
    }

    public function reopen(User $actor, DispatchJob $job, int $version, string $reason): DispatchJob
    {
        return $this->change($actor, $job, $version, $reason, true);
    }

    private function change(User $actor, DispatchJob $job, int $version, string $reason, bool $reopen): DispatchJob
    {
        Gate::forUser($actor)->authorize($reopen ? 'reopen' : 'cancel', $job);

        return DB::transaction(function () use ($actor, $job, $version, $reason, $reopen): DispatchJob {
            // Match the canonical command lock order before taking planning and legacy locks.
            $handoff = DispatchHandoff::query()->where('legacy_dispatch_job_id', $job->id)->lockForUpdate()->first();
            $attempt = $handoff?->attempts()->latest('attempt_number')->lockForUpdate()->first();
            $shift = ProjectShift::query()->with('phase')->where('dispatch_job_id', $job->id)->firstOrFail();
            $plan = ProjectPlan::query()->whereKey($shift->phase->project_plan_id)->lockForUpdate()->firstOrFail();
            $shift = $shift->newQuery()->lockForUpdate()->findOrFail($shift->id);
            $lockedJob = DispatchJob::query()->lockForUpdate()->findOrFail($job->id);
            if ($lockedJob->version !== $version) {
                throw ValidationException::withMessages(['version' => 'This dispatch changed on another device. Refresh and review it again.']);
            }

            // The web form reviews the legacy job version. The canonical aggregate has its
            // own independently checked version; both state changes commit atomically.
            $changed = $reopen
                ? $this->reopenJob->handle($actor, $lockedJob, $reason, $version)
                : $this->cancelJob->handle($actor, $lockedJob, $reason, $version);
            if (config('dispatch.v2_commands_enabled') && $attempt !== null) {
                $mutation = DispatchV2Mutation::forVersion($attempt->version, reason: $reason);
                try {
                    if ($reopen) {
                        $this->commands->reopen($actor, $attempt, $mutation);
                    } else {
                        $this->commands->cancel($actor, $attempt, $mutation);
                    }
                } catch (DispatchV2CommandException $exception) {
                    abort_if($exception->status === 403, 403, $exception->getMessage());
                    throw ValidationException::withMessages(['status' => $exception->getMessage()]);
                }
            }
            $before = $shift->toArray();
            $shift->update(['confirmed_plan_version' => null, 'pending_roster' => null, 'requested_by' => null, 'reason' => null, 'version' => $shift->version + 1]);
            $plan->increment('version');
            $this->audit->handle($actor, $shift, $reopen ? 'project_shift.reopened' : 'project_shift.cancelled', $before, $shift->toArray(), $reason);

            return $changed;
        });
    }
}
