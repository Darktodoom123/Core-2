<?php

namespace App\Modules\Dispatch\Actions;

use App\Modules\Dispatch\Enums\ApprovalStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class UpdateDispatchResourceRequirements
{
    public function __construct(private readonly RecordAuditEvent $audit) {}

    /** @param array<string, array<string, int>> $requirements */
    public function handle(User $actor, DispatchJob $job, int $version, array $requirements): DispatchJob
    {
        return DB::transaction(function () use ($actor, $job, $version, $requirements): DispatchJob {
            $job = DispatchJob::query()->lockForUpdate()->findOrFail($job->id);
            Gate::forUser($actor)->authorize('update', $job);

            if ($job->source_type !== null || $job->projectShift()->exists()) {
                throw ValidationException::withMessages(['resource_requirements' => 'Only direct dispatch requirements can be edited here.']);
            }
            if ($job->version !== $version) {
                throw ValidationException::withMessages(['version' => 'This dispatch changed on another device. Refresh and review it again.']);
            }
            $before = $job->only(['resource_requirements', 'version']);
            $job->update(['resource_requirements' => $requirements, 'version' => $job->version + 1]);
            if ($job->priority->requiresApproval() && $job->approvals()->whereIn('kind', ['dispatch_activation', 'assignment_override', 'reassignment_override'])->where('status', ApprovalStatus::Approved->value)->exists()) {
                $job->approvals()->create([
                    'subject_type' => $job->getMorphClass(),
                    'kind' => 'dispatch_activation',
                    'status' => ApprovalStatus::Pending,
                    'requested_by' => $actor->id,
                    'requested_changes' => ['resource_requirements' => $requirements],
                ]);
            }
            $this->audit->handle($actor, $job, 'dispatch.resource_requirements_updated', $before, $job->only(['resource_requirements', 'version']));

            return $job->refresh();
        });
    }
}
