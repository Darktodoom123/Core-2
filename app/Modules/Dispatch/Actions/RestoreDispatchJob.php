<?php

namespace App\Modules\Dispatch\Actions;

use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

final class RestoreDispatchJob
{
    public function __construct(private RecordAuditEvent $audit) {}

    public function handle(User $actor, int $dispatchJobId, ?string $reason = null): DispatchJob
    {
        return DB::transaction(function () use ($actor, $dispatchJobId, $reason): DispatchJob {
            $job = DispatchJob::withTrashed()->lockForUpdate()->findOrFail($dispatchJobId);

            Gate::forUser($actor)->authorize('restore', $job);

            $before = $job->only(['status', 'version', 'deleted_at']);
            $trimmedReason = $reason !== null ? trim($reason) : null;
            $auditReason = $trimmedReason !== '' ? $trimmedReason : null;

            $job->update(['version' => $job->version + 1]);
            $job->restore();

            $this->audit->handle(
                $actor,
                $job,
                'dispatch.restored',
                $before,
                [
                    ...$job->only(['status', 'version', 'deleted_at']),
                    'restored_at' => now()->toIso8601String(),
                ],
                $auditReason,
            );

            return $job->refresh();
        });
    }
}
