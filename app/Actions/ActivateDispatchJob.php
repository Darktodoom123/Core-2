<?php

namespace App\Actions;

use App\Enums\ApprovalStatus;
use App\Enums\DispatchStatus;
use App\Models\DispatchJob;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class ActivateDispatchJob
{
    public function __construct(private RecordAuditEvent $audit) {}

    public function handle(User $actor, DispatchJob $job, int $version): DispatchJob
    {
        Gate::forUser($actor)->authorize('activate', $job);

        return DB::transaction(function () use ($actor, $job, $version): DispatchJob {
            $job = DispatchJob::query()->lockForUpdate()->findOrFail($job->id);
            if ($job->version !== $version) {
                throw ValidationException::withMessages(['version' => 'This dispatch changed on another device. Refresh and review it again.']);
            }
            if ($job->priority->requiresApproval() && ! $job->approvals()->whereIn('kind', ['dispatch_activation', 'assignment_override'])->where('status', ApprovalStatus::Approved->value)->exists()) {
                throw ValidationException::withMessages(['approval' => 'Operations Manager approval is required before activation.']);
            }
            foreach ($job->assetAssignments()->with('asset.maintenanceWorkOrders')->get() as $assignment) {
                if (! $assignment->asset->status->dispatchable() || $assignment->asset->maintenanceWorkOrders->contains(fn ($work): bool => $work->dispatch_blocking && $work->released_at === null)) {
                    throw ValidationException::withMessages(['assets' => "{$assignment->asset->code} is not safe for dispatch."]);
                }
            }
            $before = $job->only(['status', 'version']);
            $job->update(['status' => DispatchStatus::Dispatched, 'activated_by' => $actor->id, 'version' => $job->version + 1]);
            $this->audit->handle($actor, $job, 'dispatch.activated', $before, $job->only(['status', 'version']));

            return $job->refresh();
        });
    }
}
