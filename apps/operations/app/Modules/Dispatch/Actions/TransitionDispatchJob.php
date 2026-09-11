<?php

namespace App\Modules\Dispatch\Actions;

use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class TransitionDispatchJob
{
    public function __construct(private RecordAuditEvent $audit) {}

    public function handle(User $actor, DispatchJob $job, DispatchStatus $next, int $version): DispatchJob
    {
        return DB::transaction(function () use ($actor, $job, $next, $version): DispatchJob {
            $job = DispatchJob::query()->lockForUpdate()->findOrFail($job->id);

            $job->personnelAssignments()
                ->where('user_id', $actor->id)
                ->lockForUpdate()
                ->get();
            Gate::forUser($actor)->authorize('updateOwnStatus', $job);

            if ($job->version !== $version) {
                throw ValidationException::withMessages([
                    'version' => 'This dispatch changed after you opened it. Refresh and review the current status before trying again.',
                ]);
            }

            if ($job->status->nextFieldStatus() !== $next) {
                throw ValidationException::withMessages([
                    'status' => 'That step is not available from the current dispatch status. Refresh and use the next action shown.',
                ]);
            }

            $before = $job->only(['status', 'version']);
            $job->update(['status' => $next, 'version' => $job->version + 1]);
            $this->audit->handle($actor, $job, 'dispatch.status_updated', $before, $job->only(['status', 'version']));

            return $job->refresh();
        });
    }
}
