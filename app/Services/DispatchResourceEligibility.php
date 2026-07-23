<?php

namespace App\Services;

use App\Enums\RoleName;
use App\Models\DispatchAssetAssignment;
use App\Models\DispatchJob;
use App\Models\DispatchPersonnelAssignment;
use App\Models\OperationalAsset;
use App\Models\PersonnelCredential;
use App\Models\PersonnelProfile;
use App\Models\User;
use Illuminate\Support\Collection;

final class DispatchResourceEligibility
{
    /**
     * @return array{
     *     eligible: bool,
     *     reasons: list<string>,
     *     availability: array{value: string, label: string},
     *     account_status: array{value: string, label: string},
     *     credential: array{kind: string|null, label: string, status: string, expires_at: string|null},
     *     schedule_conflicts: list<array{id: int, reference: string, scheduled_start: string|null, scheduled_end: string|null}>,
     *     already_assigned: bool
     * }
     */
    public function personnel(User $user, string $assignmentType, DispatchJob $job): array
    {
        $reasons = [];
        $expectedRole = $this->personnelRole($assignmentType);

        if ($expectedRole === null || ! $user->hasRole($expectedRole->value)) {
            $reasons[] = 'Personnel role does not qualify for this assignment type.';
        }

        $accountStatus = match (true) {
            ! $user->is_active => ['value' => 'inactive', 'label' => 'Inactive'],
            $user->suspended_at !== null => ['value' => 'suspended', 'label' => 'Suspended'],
            default => ['value' => 'active', 'label' => 'Active'],
        };

        if ($accountStatus['value'] !== 'active') {
            $reasons[] = "Account is {$accountStatus['label']}.";
        }

        $profile = $user->getRelationValue('personnelProfile');
        $availabilityValue = $profile instanceof PersonnelProfile
            ? $profile->availability_status
            : 'not_recorded';
        $availability = [
            'value' => $availabilityValue,
            'label' => $this->availabilityLabel($availabilityValue),
        ];

        if (in_array($availabilityValue, ['unavailable', 'on_leave'], true)) {
            $reasons[] = "Availability is {$availability['label']}.";
        }

        $credential = $this->credential($user, $assignmentType, $job);
        if (in_array($credential['status'], ['missing', 'expired', 'inactive', 'not_yet_valid'], true)) {
            $reasons[] = match ($credential['status']) {
                'missing' => "{$credential['label']} is missing.",
                'expired' => "{$credential['label']} is expired at the scheduled start.",
                'inactive' => "{$credential['label']} is inactive.",
                'not_yet_valid' => "{$credential['label']} is not valid by the scheduled start.",
            };
        }

        $conflicts = $this->personnelScheduleConflicts($user, $job);
        $alreadyAssigned = collect($conflicts)->contains(
            static fn (array $conflict): bool => $conflict['id'] === $job->id,
        );

        foreach ($conflicts as $conflict) {
            $reasons[] = $conflict['id'] === $job->id
                ? 'Personnel is already assigned to this dispatch.'
                : "Schedule overlaps dispatch {$conflict['reference']}.";
        }

        return [
            'eligible' => $reasons === [],
            'reasons' => $reasons,
            'availability' => $availability,
            'account_status' => $accountStatus,
            'credential' => $credential,
            'schedule_conflicts' => $conflicts,
            'already_assigned' => $alreadyAssigned,
        ];
    }

    /**
     * @return array{
     *     eligible: bool,
     *     reasons: list<string>,
     *     readiness: array{value: string, label: string},
     *     blocking_maintenance_count: int,
     *     schedule_conflicts: list<array{id: int, reference: string, scheduled_start: string|null, scheduled_end: string|null}>,
     *     already_assigned: bool
     * }
     */
    public function asset(OperationalAsset $asset, string $assignmentType, DispatchJob $job): array
    {
        $reasons = [];

        if ($asset->kind !== $assignmentType) {
            $reasons[] = "Asset kind {$asset->kind} does not match {$assignmentType}.";
        }

        if (! $asset->status->dispatchable()) {
            $reasons[] = "Readiness is {$asset->status->label()}.";
        }

        $blockingMaintenanceCount = $this->blockingMaintenanceCount($asset);
        if ($blockingMaintenanceCount > 0) {
            $reasons[] = $blockingMaintenanceCount === 1
                ? 'One open maintenance item blocks dispatch.'
                : "{$blockingMaintenanceCount} open maintenance items block dispatch.";
        }

        $conflicts = $this->assetScheduleConflicts($asset, $job);
        $alreadyAssigned = collect($conflicts)->contains(
            static fn (array $conflict): bool => $conflict['id'] === $job->id,
        );

        foreach ($conflicts as $conflict) {
            $reasons[] = $conflict['id'] === $job->id
                ? 'Asset is already assigned to this dispatch.'
                : "Schedule overlaps dispatch {$conflict['reference']}.";
        }

        return [
            'eligible' => $reasons === [],
            'reasons' => $reasons,
            'readiness' => [
                'value' => $asset->status->value,
                'label' => $asset->status->label(),
            ],
            'blocking_maintenance_count' => $blockingMaintenanceCount,
            'schedule_conflicts' => $conflicts,
            'already_assigned' => $alreadyAssigned,
        ];
    }

    public function personnelAssignmentType(User $user): ?string
    {
        return match (true) {
            $user->hasRole(RoleName::Driver->value) => RoleName::Driver->value,
            $user->hasRole(RoleName::CraneOperator->value) => RoleName::CraneOperator->value,
            $user->hasRole(RoleName::FieldTechnician->value) => RoleName::FieldTechnician->value,
            default => null,
        };
    }

    public function personnelAssignmentLabel(string $assignmentType): string
    {
        return match ($assignmentType) {
            'driver' => 'Driver',
            'crane_operator' => 'Crane operator',
            'field_technician' => 'Field technician',
            default => 'Personnel',
        };
    }

    public function assetAssignmentLabel(string $assignmentType): string
    {
        return match ($assignmentType) {
            'truck' => 'Truck',
            'crane' => 'Crane',
            'equipment' => 'Equipment',
            default => 'Asset',
        };
    }

    private function personnelRole(string $assignmentType): ?RoleName
    {
        return match ($assignmentType) {
            'driver' => RoleName::Driver,
            'crane_operator' => RoleName::CraneOperator,
            'field_technician' => RoleName::FieldTechnician,
            default => null,
        };
    }

    /** @return array{kind: string|null, label: string, status: string, expires_at: string|null} */
    private function credential(User $user, string $assignmentType, DispatchJob $job): array
    {
        $kind = match ($assignmentType) {
            'driver' => 'driver_license',
            'crane_operator' => 'operator_certification',
            default => null,
        };

        if ($kind === null) {
            return [
                'kind' => null,
                'label' => 'No credential required',
                'status' => 'not_required',
                'expires_at' => null,
            ];
        }

        $credentials = $this->credentials($user)
            ->where('kind', $kind)
            ->sortByDesc(static fn (PersonnelCredential $credential): string => $credential->expires_at?->toDateString() ?? '9999-12-31')
            ->values();
        $scheduledDate = $job->scheduled_start?->toDateString() ?? now()->toDateString();
        $valid = $credentials->first(static fn (PersonnelCredential $credential): bool => $credential->status === 'active'
            && ($credential->issued_at === null || $credential->issued_at->toDateString() <= $scheduledDate)
            && ($credential->expires_at === null || $credential->expires_at->toDateString() >= $scheduledDate));
        $label = $kind === 'driver_license' ? 'Driver license' : 'Operator certification';

        if ($valid instanceof PersonnelCredential) {
            return [
                'kind' => $kind,
                'label' => $label,
                'status' => 'valid',
                'expires_at' => $valid->expires_at?->toDateString(),
            ];
        }

        $latest = $credentials->first();
        if (! $latest instanceof PersonnelCredential) {
            return ['kind' => $kind, 'label' => $label, 'status' => 'missing', 'expires_at' => null];
        }

        $status = match (true) {
            $latest->status !== 'active' => 'inactive',
            $latest->issued_at !== null && $latest->issued_at->toDateString() > $scheduledDate => 'not_yet_valid',
            default => 'expired',
        };

        return [
            'kind' => $kind,
            'label' => $label,
            'status' => $status,
            'expires_at' => $latest->expires_at?->toDateString(),
        ];
    }

    /** @return Collection<int, PersonnelCredential> */
    private function credentials(User $user): Collection
    {
        if ($user->relationLoaded('personnelCredentials')) {
            /** @var Collection<int, PersonnelCredential> $credentials */
            $credentials = $user->getRelation('personnelCredentials');

            return $credentials;
        }

        return $user->personnelCredentials()->get();
    }

    /**
     * @return list<array{id: int, reference: string, scheduled_start: string|null, scheduled_end: string|null}>
     */
    private function personnelScheduleConflicts(User $user, DispatchJob $job): array
    {
        if ($user->relationLoaded('dispatchAssignments')) {
            /** @var Collection<int, DispatchPersonnelAssignment> $assignments */
            $assignments = $user->getRelation('dispatchAssignments');
        } else {
            $assignments = $user->dispatchAssignments()
                ->whereNull('active_until')
                ->with('job')
                ->get();
        }

        return $this->scheduleConflicts($assignments, $job);
    }

    /**
     * @return list<array{id: int, reference: string, scheduled_start: string|null, scheduled_end: string|null}>
     */
    private function assetScheduleConflicts(OperationalAsset $asset, DispatchJob $job): array
    {
        if ($asset->relationLoaded('assignments')) {
            /** @var Collection<int, DispatchAssetAssignment> $assignments */
            $assignments = $asset->getRelation('assignments');
        } else {
            $assignments = $asset->assignments()
                ->whereNull('active_until')
                ->with('job')
                ->get();
        }

        return $this->scheduleConflicts($assignments, $job);
    }

    /**
     * @param  iterable<DispatchPersonnelAssignment|DispatchAssetAssignment>  $assignments
     * @return list<array{id: int, reference: string, scheduled_start: string|null, scheduled_end: string|null}>
     */
    private function scheduleConflicts(iterable $assignments, DispatchJob $job): array
    {
        $conflicts = [];

        foreach ($assignments as $assignment) {
            if ($assignment->active_until !== null) {
                continue;
            }

            $assignedJob = $assignment->job;
            if (! $assignedJob->is($job) && ! $this->schedulesOverlap($job, $assignedJob)) {
                continue;
            }

            $conflicts[$assignedJob->id] = [
                'id' => (int) $assignedJob->getKey(),
                'reference' => $assignedJob->reference,
                'scheduled_start' => $assignedJob->scheduled_start?->toIso8601String(),
                'scheduled_end' => $assignedJob->scheduled_end?->toIso8601String(),
            ];
        }

        return array_values($conflicts);
    }

    private function schedulesOverlap(DispatchJob $left, DispatchJob $right): bool
    {
        if ($left->scheduled_start === null || $left->scheduled_end === null
            || $right->scheduled_start === null || $right->scheduled_end === null) {
            return true;
        }

        return $right->scheduled_start->lt($left->scheduled_end)
            && $right->scheduled_end->gt($left->scheduled_start);
    }

    private function blockingMaintenanceCount(OperationalAsset $asset): int
    {
        if ($asset->relationLoaded('maintenanceWorkOrders')) {
            return $asset->maintenanceWorkOrders
                ->where('dispatch_blocking', true)
                ->whereNull('released_at')
                ->count();
        }

        return $asset->maintenanceWorkOrders()
            ->where('dispatch_blocking', true)
            ->whereNull('released_at')
            ->count();
    }

    private function availabilityLabel(string $status): string
    {
        return match ($status) {
            'available' => 'Available',
            'assigned' => 'Assigned',
            'unavailable' => 'Unavailable',
            'on_leave' => 'On leave',
            default => 'Not recorded',
        };
    }
}
