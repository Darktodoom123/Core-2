<?php

namespace App\Modules\Assignment\Actions;

use App\Modules\Assignment\Models\DispatchAssetAssignment;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Assignment\Services\DispatchResourceEligibility;
use App\Modules\Dispatch\Enums\ApprovalStatus;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\ApprovalRequest;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class ReassignDispatchResources
{
    public function __construct(
        private RecordAuditEvent $audit,
        private DispatchResourceEligibility $eligibility,
    ) {}

    /**
     * @param  list<int>  $endPersonnelIds
     * @param  list<int>  $endAssetIds
     * @param  list<array{user_id: int, assignment_type: string}>  $newPersonnel
     * @param  list<array{operational_asset_id: int, assignment_type: string}>  $newAssets
     */
    public function handle(
        User $actor,
        DispatchJob $job,
        array $endPersonnelIds = [],
        array $endAssetIds = [],
        array $newPersonnel = [],
        array $newAssets = [],
        ?string $reason = null,
        int $version = 0,
    ): ReassignmentResult {
        Gate::forUser($actor)->authorize('reassignResources', $job);

        return DB::transaction(function () use (
            $actor,
            $job,
            $endPersonnelIds,
            $endAssetIds,
            $newPersonnel,
            $newAssets,
            $reason,
            $version,
        ): ReassignmentResult {
            $job = DispatchJob::query()->lockForUpdate()->findOrFail($job->id);
            Gate::forUser($actor)->authorize('reassignResources', $job);

            $this->assertVersion($job, $version);
            $this->assertChangeRequested($endPersonnelIds, $endAssetIds, $newPersonnel, $newAssets);
            $this->assertJobCanChangeAssignments($job);

            $prepared = $this->prepareChanges(
                $job,
                $endPersonnelIds,
                $endAssetIds,
                $newPersonnel,
                $newAssets,
            );

            $isPostActivation = in_array($job->status, [
                DispatchStatus::Dispatched,
                DispatchStatus::Accepted,
                DispatchStatus::EnRoute,
                DispatchStatus::Arrived,
                DispatchStatus::Working,
            ], true);
            $requiresApproval = ($isPostActivation || $job->priority->requiresApproval())
                && ! $actor->can(PermissionName::AssignmentsOverride->value);

            if ($requiresApproval) {
                $this->assertNoPendingApproval($job);

                $nextVersion = $job->version + 1;
                $approval = ApprovalRequest::query()->create([
                    'subject_type' => $job->getMorphClass(),
                    'subject_id' => $job->id,
                    'kind' => 'reassignment_override',
                    'requested_changes' => [
                        'end_personnel_ids' => $endPersonnelIds,
                        'end_asset_ids' => $endAssetIds,
                        'new_personnel' => $newPersonnel,
                        'new_assets' => $newAssets,
                        'version' => $nextVersion,
                    ],
                    'status' => ApprovalStatus::Pending,
                    'requested_by' => $actor->id,
                    'reason' => $reason,
                ]);

                $job->update(['version' => $nextVersion]);
                $this->audit->handle(
                    $actor,
                    $job,
                    'dispatch.reassignment_approval_requested',
                    ['version' => $version],
                    [
                        'approval_request_id' => $approval->id,
                        'version' => $job->version,
                        'end_personnel_ids' => $endPersonnelIds,
                        'end_asset_ids' => $endAssetIds,
                        'new_personnel' => $newPersonnel,
                        'new_assets' => $newAssets,
                    ],
                    $reason,
                );

                return new ReassignmentResult(
                    $job->load(['personnelAssignments.user', 'assetAssignments.asset', 'approvals']),
                    $approval,
                );
            }

            $this->writeChanges(
                $job,
                $prepared['personnel_assignments'],
                $prepared['asset_assignments'],
                $newPersonnel,
                $newAssets,
                $actor->id,
                null,
            );

            $before = [
                'version' => $job->version,
                'ended_personnel_ids' => $endPersonnelIds,
                'ended_asset_ids' => $endAssetIds,
            ];
            $job->update(['version' => $job->version + 1]);
            $this->audit->handle(
                $actor,
                $job,
                'dispatch.resources_reassigned',
                $before,
                [
                    'version' => $job->version,
                    'new_personnel' => $newPersonnel,
                    'new_assets' => $newAssets,
                ],
                $reason,
            );

            return new ReassignmentResult(
                $job->load(['personnelAssignments.user', 'assetAssignments.asset']),
            );
        });
    }

    public function applyApproved(User $approver, ApprovalRequest $approval, ?string $decisionReason): DispatchJob
    {
        if ($approval->subject_type !== (new DispatchJob)->getMorphClass()) {
            throw ValidationException::withMessages([
                'approval' => 'This approval is not attached to a dispatch job.',
            ]);
        }

        $job = DispatchJob::query()->lockForUpdate()->findOrFail($approval->subject_id);
        $approval = ApprovalRequest::query()->lockForUpdate()->findOrFail($approval->id);
        Gate::forUser($approver)->authorize('decide', $approval);

        if ($approval->kind !== 'reassignment_override' || $approval->status !== ApprovalStatus::Pending) {
            throw ValidationException::withMessages([
                'approval' => 'This reassignment approval is no longer actionable.',
            ]);
        }

        $changes = $this->approvedChanges($approval);
        $this->assertVersion($job, $changes['version']);
        $this->assertJobCanChangeAssignments($job);

        $prepared = $this->prepareChanges(
            $job,
            $changes['end_personnel_ids'],
            $changes['end_asset_ids'],
            $changes['new_personnel'],
            $changes['new_assets'],
        );
        $this->writeChanges(
            $job,
            $prepared['personnel_assignments'],
            $prepared['asset_assignments'],
            $changes['new_personnel'],
            $changes['new_assets'],
            (int) $approval->requested_by,
            $approver->id,
        );

        $before = [
            'version' => $job->version,
            'ended_personnel_ids' => $changes['end_personnel_ids'],
            'ended_asset_ids' => $changes['end_asset_ids'],
        ];
        $job->update(['version' => $job->version + 1]);
        $this->audit->handle(
            $approver,
            $job,
            'dispatch.resources_reassigned',
            $before,
            [
                'approval_request_id' => $approval->id,
                'version' => $job->version,
                'new_personnel' => $changes['new_personnel'],
                'new_assets' => $changes['new_assets'],
            ],
            $decisionReason,
        );

        return $job->load(['personnelAssignments.user', 'assetAssignments.asset']);
    }

    /**
     * @param  list<int>  $endPersonnelIds
     * @param  list<int>  $endAssetIds
     * @param  list<array{user_id: int, assignment_type: string}>  $newPersonnel
     * @param  list<array{operational_asset_id: int, assignment_type: string}>  $newAssets
     * @return array{
     *     personnel_assignments: Collection<int, DispatchPersonnelAssignment>,
     *     asset_assignments: Collection<int, DispatchAssetAssignment>
     * }
     */
    private function prepareChanges(
        DispatchJob $job,
        array $endPersonnelIds,
        array $endAssetIds,
        array $newPersonnel,
        array $newAssets,
    ): array {
        if ($newPersonnel !== [] || $newAssets !== []) {
            if ($job->scheduled_start === null || $job->scheduled_end === null) {
                throw ValidationException::withMessages([
                    'reassignment' => 'Schedule the dispatch before assigning replacement resources.',
                ]);
            }
        }

        $personnelAssignmentsToEnd = $this->lockPersonnelAssignmentsToEnd($job, $endPersonnelIds);
        $assetAssignmentsToEnd = $this->lockAssetAssignmentsToEnd($job, $endAssetIds);

        $newPersonnelIds = array_column($newPersonnel, 'user_id');
        $newAssetIds = array_column($newAssets, 'operational_asset_id');
        $this->assertNoDuplicateResources($newPersonnelIds, $newAssetIds);

        $candidateUsers = $this->lockPersonnel($newPersonnelIds);
        $candidateAssets = $this->lockAssets($newAssetIds);
        $this->assertResourcesExist($candidateUsers, $newPersonnelIds, $candidateAssets, $newAssetIds);
        $this->loadEligibilityRelations($candidateUsers, $candidateAssets, $endPersonnelIds, $endAssetIds);

        $personnelConflicts = $this->personnelConflicts($candidateUsers, $newPersonnel, $job);
        $assetConflicts = $this->assetConflicts($candidateAssets, $newAssets, $job, $endAssetIds);
        if ($personnelConflicts !== [] || $assetConflicts !== []) {
            throw ValidationException::withMessages([
                'personnel' => $personnelConflicts,
                'assets' => $assetConflicts,
            ]);
        }

        return [
            'personnel_assignments' => $personnelAssignmentsToEnd,
            'asset_assignments' => $assetAssignmentsToEnd,
        ];
    }

    /**
     * @param  list<int>  $endPersonnelIds
     * @param  list<int>  $endAssetIds
     * @param  list<array{user_id: int, assignment_type: string}>  $newPersonnel
     * @param  list<array{operational_asset_id: int, assignment_type: string}>  $newAssets
     */
    private function assertChangeRequested(
        array $endPersonnelIds,
        array $endAssetIds,
        array $newPersonnel,
        array $newAssets,
    ): void {
        if ($endPersonnelIds === [] && $endAssetIds === [] && $newPersonnel === [] && $newAssets === []) {
            throw ValidationException::withMessages([
                'reassignment' => 'Select at least one assignment to end or reassign.',
            ]);
        }
    }

    private function assertJobCanChangeAssignments(DispatchJob $job): void
    {
        if (in_array($job->status, [DispatchStatus::Completed, DispatchStatus::Cancelled], true)) {
            throw ValidationException::withMessages([
                'reassignment' => 'Completed or cancelled jobs cannot have assignments changed.',
            ]);
        }
    }

    private function assertVersion(DispatchJob $job, int $version): void
    {
        if ($job->version !== $version) {
            throw ValidationException::withMessages([
                'version' => 'Dispatch job version is stale. Refresh and review before reassigning.',
            ]);
        }
    }

    private function assertNoPendingApproval(DispatchJob $job): void
    {
        if ($job->approvals()
            ->where('kind', 'reassignment_override')
            ->where('status', ApprovalStatus::Pending)
            ->lockForUpdate()
            ->exists()) {
            throw ValidationException::withMessages([
                'approval' => 'An earlier reassignment is still awaiting independent approval.',
            ]);
        }
    }

    /**
     * @return array{
     *     version: int,
     *     end_personnel_ids: list<int>,
     *     end_asset_ids: list<int>,
     *     new_personnel: list<array{user_id: int, assignment_type: string}>,
     *     new_assets: list<array{operational_asset_id: int, assignment_type: string}>
     * }
     */
    private function approvedChanges(ApprovalRequest $approval): array
    {
        $changes = $approval->requested_changes;
        if (! is_array($changes) || ! is_int($changes['version'] ?? null)) {
            throw ValidationException::withMessages([
                'approval' => 'The reassignment approval payload is invalid.',
            ]);
        }

        return [
            'version' => $changes['version'],
            'end_personnel_ids' => $this->approvedIds($changes['end_personnel_ids'] ?? null),
            'end_asset_ids' => $this->approvedIds($changes['end_asset_ids'] ?? null),
            'new_personnel' => $this->approvedPersonnel($changes['new_personnel'] ?? null),
            'new_assets' => $this->approvedAssets($changes['new_assets'] ?? null),
        ];
    }

    /** @return list<int> */
    private function approvedIds(mixed $value): array
    {
        if (! is_array($value) || array_filter($value, static fn (mixed $id): bool => ! is_int($id)) !== []) {
            throw ValidationException::withMessages([
                'approval' => 'The reassignment approval payload is invalid.',
            ]);
        }

        return array_values($value);
    }

    /** @return list<array{user_id: int, assignment_type: string}> */
    private function approvedPersonnel(mixed $value): array
    {
        if (! is_array($value)) {
            throw ValidationException::withMessages([
                'approval' => 'The reassignment approval payload is invalid.',
            ]);
        }

        $result = [];
        foreach ($value as $assignment) {
            if (! is_array($assignment)
                || ! is_int($assignment['user_id'] ?? null)
                || ! is_string($assignment['assignment_type'] ?? null)) {
                throw ValidationException::withMessages([
                    'approval' => 'The reassignment approval payload is invalid.',
                ]);
            }

            $result[] = [
                'user_id' => $assignment['user_id'],
                'assignment_type' => $assignment['assignment_type'],
            ];
        }

        return $result;
    }

    /** @return list<array{operational_asset_id: int, assignment_type: string}> */
    private function approvedAssets(mixed $value): array
    {
        if (! is_array($value)) {
            throw ValidationException::withMessages([
                'approval' => 'The reassignment approval payload is invalid.',
            ]);
        }

        $result = [];
        foreach ($value as $assignment) {
            if (! is_array($assignment)
                || ! is_int($assignment['operational_asset_id'] ?? null)
                || ! is_string($assignment['assignment_type'] ?? null)) {
                throw ValidationException::withMessages([
                    'approval' => 'The reassignment approval payload is invalid.',
                ]);
            }

            $result[] = [
                'operational_asset_id' => $assignment['operational_asset_id'],
                'assignment_type' => $assignment['assignment_type'],
            ];
        }

        return $result;
    }

    /**
     * @param  Collection<int, DispatchPersonnelAssignment>  $personnelAssignmentsToEnd
     * @param  Collection<int, DispatchAssetAssignment>  $assetAssignmentsToEnd
     * @param  list<array{user_id: int, assignment_type: string}>  $newPersonnel
     * @param  list<array{operational_asset_id: int, assignment_type: string}>  $newAssets
     */
    private function writeChanges(
        DispatchJob $job,
        Collection $personnelAssignmentsToEnd,
        Collection $assetAssignmentsToEnd,
        array $newPersonnel,
        array $newAssets,
        int $assignedBy,
        ?int $approvedBy,
    ): void {
        $now = now();

        foreach ($personnelAssignmentsToEnd as $assignment) {
            $attributes = ['active_until' => $now];
            if ($approvedBy !== null) {
                $attributes['approved_by'] = $approvedBy;
            }
            $assignment->update($attributes);
        }

        foreach ($assetAssignmentsToEnd as $assignment) {
            $attributes = ['active_until' => $now];
            if ($approvedBy !== null) {
                $attributes['approved_by'] = $approvedBy;
            }
            $assignment->update($attributes);
        }

        foreach ($newPersonnel as $assignment) {
            $job->personnelAssignments()->create([
                ...$assignment,
                'assigned_by' => $assignedBy,
                'approved_by' => $approvedBy,
                'active_from' => $now,
            ]);
        }

        foreach ($newAssets as $assignment) {
            $job->assetAssignments()->create([
                ...$assignment,
                'assigned_by' => $assignedBy,
                'approved_by' => $approvedBy,
                'active_from' => $now,
            ]);
        }
    }

    /**
     * @param  list<int>  $endPersonnelIds
     * @return Collection<int, DispatchPersonnelAssignment>
     */
    private function lockPersonnelAssignmentsToEnd(DispatchJob $job, array $endPersonnelIds): Collection
    {
        if ($endPersonnelIds === []) {
            return new Collection;
        }

        $assignments = DispatchPersonnelAssignment::query()
            ->whereIn('id', $endPersonnelIds)
            ->where('dispatch_job_id', $job->id)
            ->whereNull('active_until')
            ->orderBy('id')
            ->lockForUpdate()
            ->get()
            ->keyBy('id');

        if ($assignments->count() !== count(array_unique($endPersonnelIds))) {
            throw ValidationException::withMessages([
                'personnel' => 'One or more target personnel assignments to end are invalid or already inactive.',
            ]);
        }

        return $assignments;
    }

    /**
     * @param  list<int>  $endAssetIds
     * @return Collection<int, DispatchAssetAssignment>
     */
    private function lockAssetAssignmentsToEnd(DispatchJob $job, array $endAssetIds): Collection
    {
        if ($endAssetIds === []) {
            return new Collection;
        }

        $assignments = DispatchAssetAssignment::query()
            ->whereIn('id', $endAssetIds)
            ->where('dispatch_job_id', $job->id)
            ->whereNull('active_until')
            ->orderBy('id')
            ->lockForUpdate()
            ->get()
            ->keyBy('id');

        if ($assignments->count() !== count(array_unique($endAssetIds))) {
            throw ValidationException::withMessages([
                'assets' => 'One or more target asset assignments to end are invalid or already inactive.',
            ]);
        }

        return $assignments;
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
        if ($personnelIds === []) {
            return new Collection;
        }

        return User::query()
            ->whereIn('id', $personnelIds)
            ->orderBy('id')
            ->lockForUpdate()
            ->get()
            ->keyBy('id');
    }

    /**
     * @param  list<int>  $assetIds
     * @return Collection<int, OperationalAsset>
     */
    private function lockAssets(array $assetIds): Collection
    {
        if ($assetIds === []) {
            return new Collection;
        }

        return OperationalAsset::query()
            ->whereIn('id', $assetIds)
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
     * @param  list<int>  $endPersonnelIds
     * @param  list<int>  $endAssetIds
     */
    private function loadEligibilityRelations(Collection $users, Collection $assets, array $endPersonnelIds, array $endAssetIds): void
    {
        $users->load([
            'roles:id,name',
            'personnelProfile',
            'personnelCredentials',
            'dispatchAssignments' => fn ($query) => $query
                ->whereNull('active_until')
                ->when($endPersonnelIds !== [], fn ($q) => $q->whereNotIn('id', $endPersonnelIds))
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
     * @param  list<int>  $excludedAssignmentIds
     * @return list<string>
     */
    private function assetConflicts(Collection $assets, array $assignments, DispatchJob $job, array $excludedAssignmentIds = []): array
    {
        $conflicts = [];

        foreach ($assignments as $assignment) {
            $asset = $assets->get($assignment['operational_asset_id']);
            if (! $asset instanceof OperationalAsset) {
                throw ValidationException::withMessages(['assets' => 'Selected assets no longer exist.']);
            }

            $assessment = $this->eligibility->asset($asset, $assignment['assignment_type'], $job, $excludedAssignmentIds);
            if (! $assessment['eligible']) {
                $label = $this->eligibility->assetAssignmentLabel($assignment['assignment_type']);
                $conflicts[] = "{$asset->code} cannot be assigned as {$label}: ".implode(' ', $assessment['reasons']);
            }
        }

        return $conflicts;
    }
}
