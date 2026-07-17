<?php

namespace App\Actions;

use App\Enums\ApprovalStatus;
use App\Models\ApprovalRequest;
use App\Models\DispatchJob;
use App\Models\OperationalAsset;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class AssignDispatchResources
{
    public function __construct(private RecordAuditEvent $audit) {}

    /**
     * @param  list<array{user_id: int, assignment_type: string}>  $personnel
     * @param  list<array{operational_asset_id: int, assignment_type: string}>  $assets
     */
    public function handle(User $actor, DispatchJob $job, array $personnel, array $assets): DispatchJob
    {
        return DB::transaction(function () use ($actor, $job, $personnel, $assets): DispatchJob {
            $job = DispatchJob::query()->lockForUpdate()->findOrFail($job->id);

            foreach ($assets as $assignment) {
                $asset = OperationalAsset::query()->lockForUpdate()->findOrFail($assignment['operational_asset_id']);
                if (! $asset->status->dispatchable() || $asset->maintenanceWorkOrders()->where('dispatch_blocking', true)->whereNull('released_at')->exists()) {
                    throw ValidationException::withMessages(['assets' => "{$asset->code} is not safe for dispatch."]);
                }
                $overlap = $asset->assignments()->whereNull('active_until')->whereHas('job', fn ($query) => $query
                    ->where('scheduled_start', '<', $job->scheduled_end)->where('scheduled_end', '>', $job->scheduled_start))->exists();
                if ($overlap) {
                    throw ValidationException::withMessages(['assets' => "{$asset->code} has a scheduling conflict."]);
                }
                $job->assetAssignments()->create([...$assignment, 'assigned_by' => $actor->id, 'active_from' => $job->scheduled_start]);
            }

            foreach ($personnel as $assignment) {
                $user = User::query()->lockForUpdate()->findOrFail($assignment['user_id']);

                if (! $user->is_active || $user->suspended_at !== null || in_array($user->personnelProfile?->availability_status, ['unavailable', 'on_leave'], true)) {
                    throw ValidationException::withMessages(['personnel' => "{$user->name} is not available for assignment."]);
                }

                $credentialKind = match ($assignment['assignment_type']) {
                    'driver' => 'driver_license',
                    'crane_operator' => 'operator_certification',
                    default => null,
                };

                if ($credentialKind !== null && ! $user->personnelCredentials()->where('kind', $credentialKind)->validAt($job->scheduled_start ?? now())->exists()) {
                    throw ValidationException::withMessages(['personnel' => "{$user->name} does not have a valid {$credentialKind} credential."]);
                }

                $job->personnelAssignments()->create([...$assignment, 'assigned_by' => $actor->id, 'active_from' => $job->scheduled_start]);
            }

            if ($job->priority->requiresApproval()) {
                ApprovalRequest::query()->create(['subject_type' => DispatchJob::class, 'subject_id' => $job->id, 'kind' => 'assignment_override', 'requested_changes' => ['personnel' => $personnel, 'assets' => $assets], 'status' => ApprovalStatus::Pending, 'requested_by' => $actor->id]);
            }

            $this->audit->handle($actor, $job, 'dispatch.resources_assigned', null, ['personnel' => $personnel, 'assets' => $assets]);

            return $job->load(['personnelAssignments', 'assetAssignments']);
        });
    }
}
