<?php

namespace App\Modules\Assignment\Services;

use App\Modules\Assignment\Models\DispatchAssetAssignment;
use App\Modules\Dispatch\Contracts\DispatchScheduleReader;
use App\Modules\Dispatch\Data\DispatchScheduleWindow;
use App\Shared\Assets\Contracts\AssetUsageConflictChecker;
use App\Shared\Assets\Data\AssetUsageConflict;
use App\Shared\Assets\Data\AssetUsageRequest;
use App\Shared\Assets\Data\AssetUsageSource;
use App\Shared\Assets\Enums\AssetUsageType;

final class DispatchAssetUsageConflictChecker implements AssetUsageConflictChecker
{
    public function __construct(private readonly DispatchScheduleReader $schedules) {}

    public function conflicts(AssetUsageRequest $request): iterable
    {
        if ($request->usageType === AssetUsageType::AssetStatusChange) {
            return [];
        }

        $query = DispatchAssetAssignment::query()
            ->where('operational_asset_id', $request->assetId)
            ->where(function ($assignment): void {
                $assignment->whereNull('active_until')->orWhere('active_until', '>', now());
            })
            ->when($request->excludedAssignmentIds !== [], fn ($assignment): mixed => $assignment->whereNotIn('id', $request->excludedAssignmentIds));

        if ($request->source?->aggregateType === 'dispatch_job'
            && $request->usageType === AssetUsageType::DispatchActivate) {
            $query->where('dispatch_job_id', '<>', $request->source->aggregateId);
        }

        if ($request->source?->aggregateType === 'dispatch_asset_assignment') {
            $query->where('id', '<>', $request->source->aggregateId);
        }

        $assignments = $query->orderBy('id')->get(['id', 'dispatch_job_id']);
        if ($assignments->isEmpty()) {
            return [];
        }

        if (! $request->usageType->usesTimeWindow() || $request->windowStart === null || $request->windowEnd === null) {
            $assignment = $assignments->first();

            return [$this->conflict($assignment->id, $assignment->dispatch_job_id, null)];
        }

        $windows = collect($this->schedules->windowsForJobIds($assignments->pluck('dispatch_job_id')->map(static fn (mixed $id): int => (int) $id)->all()))
            ->keyBy('dispatchJobId');

        foreach ($assignments as $assignment) {
            /** @var DispatchScheduleWindow|null $window */
            $window = $windows->get((int) $assignment->dispatch_job_id);
            if ($window?->overlaps($request->windowStart, $request->windowEnd) ?? true) {
                return [$this->conflict($assignment->id, $assignment->dispatch_job_id, $window)];
            }
        }

        return [];
    }

    private function conflict(int $assignmentId, int $jobId, ?DispatchScheduleWindow $window): AssetUsageConflict
    {
        return new AssetUsageConflict(
            'dispatch.assignment_overlap',
            'The asset is committed to another active dispatch assignment.',
            new AssetUsageSource('dispatch_job', $jobId),
            [
                'assignment_id' => $assignmentId,
                'reference' => $window?->reference,
                'scheduled_start' => $window?->start?->toIso8601String(),
                'scheduled_end' => $window?->end?->toIso8601String(),
            ],
        );
    }
}
