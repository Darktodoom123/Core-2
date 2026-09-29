<?php

namespace App\Platform\Gpt\Services;

use App\Modules\Assignment\Enums\AssignmentResponse;
use App\Modules\Assignment\Services\DispatchResourceEligibility;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Planning\Models\ProjectShift;
use App\Modules\Dispatch\Services\DispatchResourceRequirements;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Models\OperationalAsset;

/**
 * Produces one actionable, server-vetted resource problem for the legacy
 * assignment workflow. Project shifts use their separate coverage workflow.
 * Live jobs only get a replacement for an assigned resource that stopped
 * being eligible; their coverage is not re-planned.
 */
final class BlockerResolutionContextBuilder
{
    private const PLANNING_STATUSES = [DispatchStatus::Draft, DispatchStatus::PendingApproval, DispatchStatus::Scheduled];

    private const LIVE_STATUSES = [DispatchStatus::Dispatched, DispatchStatus::Accepted, DispatchStatus::EnRoute, DispatchStatus::Arrived, DispatchStatus::Working];

    public function __construct(private readonly DispatchResourceEligibility $eligibility) {}

    /**
     * @return array{context: array<string, mixed>, context_hash: string, automation_hash: string, input_references: array{user_ids: list<int>, asset_ids: list<int>}, prompt_summary: string}|null
     */
    public function buildForDispatchJob(DispatchJob $job): ?array
    {
        $job = $job->fresh() ?? $job;
        $isLive = in_array($job->status, self::LIVE_STATUSES, true);
        if ($job->trashed() || (! $isLive && ! in_array($job->status, self::PLANNING_STATUSES, true))
            || $job->scheduled_start === null || $job->scheduled_end === null || $job->scheduled_end->lte($job->scheduled_start)
            || ProjectShift::query()->where('dispatch_job_id', $job->id)->exists()) {
            return null;
        }

        $personnel = $job->personnelAssignments()->open()->with([
            'user.roles:id,name', 'user.personnelProfile', 'user.personnelCredentials', 'user.dispatchAssignments.job',
        ])->orderBy('id')->get();
        $assets = $job->assetAssignments()->open()->with(['asset.maintenanceWorkOrders', 'asset.inspections'])->orderBy('id')->get();

        $blocker = null;
        foreach ($personnel as $assignment) {
            $user = $assignment->user;
            $assessment = $user instanceof User
                ? $this->eligibility->personnel($user, $assignment->assignment_type, $job, true)
                : null;
            if ($assignment->response_status === AssignmentResponse::Rejected || $assessment === null || $this->blocksAssignment($assessment, $isLive)) {
                $blocker = [
                    'code' => $assignment->response_status === AssignmentResponse::Rejected ? 'personnel_rejected' : 'personnel_ineligible',
                    'resource_kind' => 'personnel',
                    'action' => 'reassign',
                    'assignment_type' => $assignment->assignment_type,
                    'replace_assignment_id' => (int) $assignment->id,
                    'reasons' => [$assignment->response_status === AssignmentResponse::Rejected
                        ? 'Assignment was rejected.'
                        : 'Assigned personnel failed a role, credential, availability, or schedule check.'],
                    'evidence' => $assessment === null ? ['missing' => true] : [
                        'account_status' => $assessment['account_status']['value'],
                        'availability' => $assessment['availability']['value'],
                        'credential' => $assessment['credential']['status'],
                        'conflict_count' => count($assessment['schedule_conflicts']),
                    ],
                ];
                break;
            }
        }

        if ($blocker === null) {
            foreach ($assets as $assignment) {
                $asset = $assignment->getRelationValue('asset');
                $assessment = $asset instanceof OperationalAsset
                    ? $this->eligibility->asset($asset, $assignment->assignment_type, $job, excludeCurrentJob: true)
                    : null;
                if ($assessment === null || $this->blocksAssignment($assessment, $isLive)) {
                    $blocker = [
                        'code' => 'asset_ineligible',
                        'resource_kind' => 'asset',
                        'action' => 'reassign',
                        'assignment_type' => $assignment->assignment_type,
                        'replace_assignment_id' => (int) $assignment->id,
                        'reasons' => ['Assigned asset failed a readiness or availability check.'],
                        'evidence' => $assessment === null ? ['missing' => true] : [
                            'readiness' => $assessment['readiness']['value'],
                            'maintenance_count' => $assessment['blocking_maintenance_count'],
                            'conflict_count' => count($assessment['schedule_conflicts']),
                        ],
                    ];
                    break;
                }
            }
        }

        if ($blocker === null && $isLive) {
            return null;
        }

        $resourceRequirements = $job->resource_requirements;
        if ($blocker === null && $resourceRequirements !== null) {
            foreach (['personnel' => $personnel, 'assets' => $assets] as $group => $assignments) {
                $quantities = $resourceRequirements[$group] ?? [];
                $allowedTypes = $group === 'personnel'
                    ? DispatchResourceRequirements::PERSONNEL_TYPES
                    : DispatchResourceRequirements::ASSET_TYPES;
                foreach ($allowedTypes as $type) {
                    $required = $quantities[$type] ?? 0;
                    if ($required <= $assignments->where('assignment_type', $type)->count()) {
                        continue;
                    }
                    $blocker = [
                        'code' => $group === 'personnel' ? 'missing_personnel' : 'missing_asset',
                        'resource_kind' => $group === 'personnel' ? 'personnel' : 'asset',
                        'action' => 'assign',
                        'assignment_type' => $type,
                        'replace_assignment_id' => null,
                        'reasons' => ['Required '.str_replace('_', ' ', $type).' coverage is incomplete.'],
                        'evidence' => [
                            'required_count' => $required,
                            'current_count' => $assignments->where('assignment_type', $type)->count(),
                        ],
                    ];
                    break 2;
                }
            }
        }
        if ($blocker === null && $resourceRequirements === null && $personnel->isEmpty()) {
            $blocker = [
                'code' => 'missing_personnel', 'resource_kind' => 'personnel', 'action' => 'assign',
                'assignment_type' => 'crane_operator', 'replace_assignment_id' => null,
                'reasons' => ['No active personnel assignment is recorded.'],
                'evidence' => ['current_count' => 0],
            ];
        }
        if ($blocker === null && $resourceRequirements === null && $assets->isEmpty()) {
            $blocker = [
                'code' => 'missing_asset', 'resource_kind' => 'asset', 'action' => 'assign',
                'assignment_type' => 'crane', 'replace_assignment_id' => null,
                'reasons' => ['No active asset assignment is recorded.'],
                'evidence' => ['current_count' => 0],
            ];
        }
        if ($blocker === null) {
            return null;
        }

        $options = $blocker['resource_kind'] === 'personnel'
            ? $this->personnelOptions($job, $blocker['assignment_type'], array_values($personnel->pluck('user_id')->map(fn ($id) => (int) $id)->all()))
            : $this->assetOptions($job, $blocker['assignment_type'], $blocker['replace_assignment_id'], array_values($assets->pluck('operational_asset_id')->map(fn ($id) => (int) $id)->all()));

        $context = [
            'purpose' => 'dispatch_blocker_resolution',
            'job' => [
                'id' => (int) $job->id,
                'version' => (int) $job->version,
                'status' => $job->status->value,
                'scheduled_start' => $job->scheduled_start->toIso8601String(),
                'scheduled_end' => $job->scheduled_end->toIso8601String(),
            ],
            'blocker' => $blocker,
            'options' => $options,
        ];
        $contextHash = hash('sha256', json_encode($context, JSON_THROW_ON_ERROR));
        $automationHash = hash('sha256', json_encode([$blocker, $options], JSON_THROW_ON_ERROR));

        return [
            'context' => $context,
            'context_hash' => $contextHash,
            'automation_hash' => $automationHash,
            'input_references' => [
                'user_ids' => $blocker['resource_kind'] === 'personnel' ? array_column($options, 'candidate_id') : [],
                'asset_ids' => $blocker['resource_kind'] === 'asset' ? array_column($options, 'candidate_id') : [],
            ],
            'prompt_summary' => 'Resource blocker: '.$blocker['code'].'.',
        ];
    }

    /**
     * A live job keeps its resources when they overlap a job that has not
     * started yet; that overlap is resolved on the other job instead.
     *
     * @param  array{eligible: bool, reasons: list<string>, schedule_conflicts: list<array{id: int, reference: string, scheduled_start: string|null, scheduled_end: string|null}>}  $assessment
     */
    private function blocksAssignment(array $assessment, bool $isLive): bool
    {
        $conflictIds = array_column($assessment['schedule_conflicts'], 'id');
        if ($assessment['eligible'] || ! $isLive || $conflictIds === []) {
            return ! $assessment['eligible'];
        }

        $liveConflicts = DispatchJob::query()->whereKey($conflictIds)
            ->whereIn('status', array_map(fn (DispatchStatus $status): string => $status->value, self::LIVE_STATUSES))
            ->count();
        $notStartedConflicts = count($conflictIds) - $liveConflicts;

        // Each overlap contributes exactly one reason to the assessment.
        return count($assessment['reasons']) > $notStartedConflicts;
    }

    /** @param list<int> $assignedIds
     * @return list<array<string, mixed>>
     */
    private function personnelOptions(DispatchJob $job, string $assignmentType, array $assignedIds): array
    {
        $options = [];
        User::query()->where('is_active', true)->whereNull('suspended_at')
            ->with(['roles:id,name', 'personnelProfile', 'personnelCredentials', 'dispatchAssignments.job'])
            ->chunkById(100, function ($users) use (&$options, $job, $assignmentType, $assignedIds): bool {
                foreach ($users as $user) {
                    if (in_array((int) $user->id, $assignedIds, true)) {
                        continue;
                    }
                    $assessment = $this->eligibility->personnel($user, $assignmentType, $job);
                    if (! $assessment['eligible']) {
                        continue;
                    }
                    $options[] = [
                        'id' => count($options) + 1,
                        'candidate_id' => (int) $user->id,
                        'resource_kind' => 'personnel',
                        'assignment_type' => $assignmentType,
                        'evidence' => [
                            'availability' => $assessment['availability']['value'],
                            'credential' => $assessment['credential']['status'],
                            'schedule_conflicts' => 0,
                        ],
                    ];
                    if (count($options) === 3) {
                        return false;
                    }
                }

                return true;
            });

        return $options;
    }

    /** @param list<int> $assignedIds
     * @return list<array<string, mixed>>
     */
    private function assetOptions(DispatchJob $job, string $assignmentType, ?int $replaceAssignmentId, array $assignedIds): array
    {
        $options = [];
        OperationalAsset::query()->where(function ($query) use ($assignmentType): void {
            $query->where('kind', $assignmentType);
            if ($assignmentType === 'crane') {
                $query->orWhere('kind', 'mobile_crane');
            }
        })->with(['maintenanceWorkOrders', 'inspections'])
            ->chunkById(100, function ($assets) use (&$options, $job, $assignmentType, $replaceAssignmentId, $assignedIds): bool {
                foreach ($assets as $asset) {
                    if (in_array((int) $asset->id, $assignedIds, true)) {
                        continue;
                    }
                    $assessment = $this->eligibility->asset($asset, $assignmentType, $job, $replaceAssignmentId === null ? [] : [$replaceAssignmentId]);
                    if (! $assessment['eligible']) {
                        continue;
                    }
                    $options[] = [
                        'id' => count($options) + 1,
                        'candidate_id' => (int) $asset->id,
                        'resource_kind' => 'asset',
                        'assignment_type' => $assignmentType,
                        'evidence' => [
                            'readiness' => $assessment['readiness']['value'],
                            'schedule_conflicts' => 0,
                            'activation_constraints' => $assessment['activation_constraints'],
                        ],
                    ];
                    if (count($options) === 3) {
                        return false;
                    }
                }

                return true;
            });

        return $options;
    }
}
