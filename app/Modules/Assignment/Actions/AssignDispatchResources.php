<?php

namespace App\Modules\Assignment\Actions;

use App\Modules\Assignment\Services\DispatchResourceEligibility;
use App\Modules\Dispatch\Enums\ApprovalStatus;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\ApprovalRequest;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Models\OperationalAsset;
use App\Shared\Assets\Services\OperationalAssetAvailability;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class AssignDispatchResources
{
    public function __construct(
        private RecordAuditEvent $audit,
        private DispatchResourceEligibility $eligibility,
        private OperationalAssetAvailability $availability,
    ) {}

    /**
     * @param  list<array{user_id: int, assignment_type: string}>  $personnel
     * @param  list<array{operational_asset_id: int, assignment_type: string}>  $assets
     */
    public function handle(User $actor, DispatchJob $job, array $personnel, array $assets): DispatchJob
    {
        Gate::forUser($actor)->authorize('assignResources', $job);

        return DB::transaction(function () use ($actor, $job, $personnel, $assets): DispatchJob {
            $job = DispatchJob::query()->lockForUpdate()->findOrFail($job->id);
            Gate::forUser($actor)->authorize('assignResources', $job);
            $this->assertJobAcceptsAssignments($job, $personnel, $assets);

            $personnelIds = array_column($personnel, 'user_id');
            $assetIds = array_column($assets, 'operational_asset_id');
            $this->assertNoDuplicateResources($personnelIds, $assetIds);

            $users = $this->lockPersonnel($personnelIds);
            $lockedAssets = $this->availability->lockAssetsForUpdate($assetIds);
            Gate::forUser($actor)->authorize('assignResources', $job);
            $this->assertResourcesExist($users, $personnelIds, $lockedAssets, $assetIds);
            $this->loadEligibilityRelations($users, $lockedAssets);

            $personnelConflicts = $this->personnelConflicts($users, $personnel, $job);
            $assetConflicts = $this->assetConflicts($lockedAssets, $assets, $job);
            if ($personnelConflicts !== [] || $assetConflicts !== []) {
                throw ValidationException::withMessages([
                    'personnel' => $personnelConflicts,
                    'assets' => $assetConflicts,
                ]);
            }

            $this->createAssignments($actor, $job, $personnel, $assets);
            $this->requestExceptionalApproval($actor, $job, $personnel, $assets);
            $this->audit->handle($actor, $job, 'dispatch.resources_assigned', null, ['personnel' => $personnel, 'assets' => $assets]);
            $job->touch();

            return $job->load(['personnelAssignments.user', 'assetAssignments.asset']);
        });
    }

    /**
     * @param  list<array{user_id: int, assignment_type: string}>  $personnel
     * @param  list<array{operational_asset_id: int, assignment_type: string}>  $assets
     */
    private function assertJobAcceptsAssignments(DispatchJob $job, array $personnel, array $assets): void
    {
        if ($personnel === [] && $assets === []) {
            throw ValidationException::withMessages([
                'resources' => 'Select at least one eligible person or asset.',
            ]);
        }

        if ($job->scheduled_start === null || $job->scheduled_end === null) {
            throw ValidationException::withMessages([
                'resources' => 'Schedule the dispatch before assigning resources.',
            ]);
        }

        if (! in_array($job->status, [
            DispatchStatus::Draft,
            DispatchStatus::PendingApproval,
            DispatchStatus::Scheduled,
        ], true)) {
            throw ValidationException::withMessages([
                'resources' => 'Resources can only be assigned before dispatch activation.',
            ]);
        }
    }

    /**
     * @param  list<int>  $personnelIds
     * @param  list<int>  $assetIds
     */
    private function assertNoDuplicateResources(array $personnelIds, array $assetIds): void
    {
        if (count($personnelIds) !== count(array_unique($personnelIds))) {
            throw ValidationException::withMessages(['personnel' => 'Each person may only be selected once.']);
        }

        if (count($assetIds) !== count(array_unique($assetIds))) {
            throw ValidationException::withMessages(['assets' => 'Each asset may only be selected once.']);
        }
    }

    /**
     * @param  list<int>  $personnelIds
     * @return Collection<int, User>
     */
    private function lockPersonnel(array $personnelIds): Collection
    {
        return User::query()
            ->whereIn('id', $personnelIds)
            ->orderBy('id')
            ->lockForUpdate()
            ->get()
            ->keyBy('id');
    }

    /**
     * @param  Collection<int, User>  $users
     * @param  list<int>  $personnelIds
     * @param  Collection<int, OperationalAsset>  $assets
     * @param  list<int>  $assetIds
     */
    private function assertResourcesExist(Collection $users, array $personnelIds, Collection $assets, array $assetIds): void
    {
        if ($users->count() !== count($personnelIds)) {
            throw ValidationException::withMessages(['personnel' => 'One or more selected personnel records no longer exist.']);
        }

        if ($assets->count() !== count($assetIds)) {
            throw ValidationException::withMessages(['assets' => 'One or more selected asset records no longer exist.']);
        }
    }

    /**
     * @param  Collection<int, User>  $users
     * @param  Collection<int, OperationalAsset>  $assets
     */
    private function loadEligibilityRelations(Collection $users, Collection $assets): void
    {
        $users->load([
            'roles:id,name',
            'personnelProfile',
            'personnelCredentials',
            'dispatchAssignments' => fn ($query) => $query
                ->whereNull('active_until')
                ->with('job'),
        ]);
    }

    /**
     * @param  Collection<int, User>  $users
     * @param  list<array{user_id: int, assignment_type: string}>  $personnel
     * @return list<string>
     */
    private function personnelConflicts(Collection $users, array $personnel, DispatchJob $job): array
    {
        $conflicts = [];

        foreach ($personnel as $assignment) {
            $user = $users->get($assignment['user_id']);
            if (! $user instanceof User) {
                throw ValidationException::withMessages(['personnel' => 'Selected personnel no longer exist.']);
            }

            $assessment = $this->eligibility->personnel($user, $assignment['assignment_type'], $job);
            if (! $assessment['eligible']) {
                $label = $this->eligibility->personnelAssignmentLabel($assignment['assignment_type']);
                $conflicts[] = "{$user->name} cannot be assigned as {$label}: ".implode(' ', $assessment['reasons']);
            }
        }

        return $conflicts;
    }

    /**
     * @param  Collection<int, OperationalAsset>  $assets
     * @param  list<array{operational_asset_id: int, assignment_type: string}>  $assignments
     * @return list<string>
     */
    private function assetConflicts(Collection $assets, array $assignments, DispatchJob $job): array
    {
        $conflicts = [];

        foreach ($assignments as $assignment) {
            $asset = $assets->get($assignment['operational_asset_id']);
            if (! $asset instanceof OperationalAsset) {
                throw ValidationException::withMessages(['assets' => 'Selected assets no longer exist.']);
            }

            $assessment = $this->eligibility->asset($asset, $assignment['assignment_type'], $job);
            if (! $assessment['eligible']) {
                $label = $this->eligibility->assetAssignmentLabel($assignment['assignment_type']);
                $conflicts[] = "{$asset->code} cannot be assigned as {$label}: ".implode(' ', $assessment['reasons']);
            }
        }

        return $conflicts;
    }

    /**
     * @param  list<array{user_id: int, assignment_type: string}>  $personnel
     * @param  list<array{operational_asset_id: int, assignment_type: string}>  $assets
     */
    private function createAssignments(User $actor, DispatchJob $job, array $personnel, array $assets): void
    {
        foreach ($personnel as $assignment) {
            $job->personnelAssignments()->create([
                ...$assignment,
                'assigned_by' => $actor->id,
                'active_from' => $job->scheduled_start,
            ]);
        }

        foreach ($assets as $assignment) {
            $job->assetAssignments()->create([
                ...$assignment,
                'assigned_by' => $actor->id,
                'active_from' => $job->scheduled_start,
            ]);
        }
    }

    /**
     * @param  list<array{user_id: int, assignment_type: string}>  $personnel
     * @param  list<array{operational_asset_id: int, assignment_type: string}>  $assets
     */
    private function requestExceptionalApproval(User $actor, DispatchJob $job, array $personnel, array $assets): void
    {
        if (! $job->priority->requiresApproval()) {
            return;
        }

        ApprovalRequest::query()->create([
            'subject_type' => $job->getMorphClass(),
            'subject_id' => $job->id,
            'kind' => 'assignment_override',
            'requested_changes' => ['personnel' => $personnel, 'assets' => $assets],
            'status' => ApprovalStatus::Pending,
            'requested_by' => $actor->id,
        ]);
    }
}
