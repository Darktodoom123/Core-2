<?php

namespace App\Modules\Dispatch\Planning\Services;

use App\Modules\Assignment\Models\DispatchAssetAssignment;
use App\Modules\Dispatch\Planning\Models\ProjectAllocation;
use App\Modules\Dispatch\Planning\Models\ProjectShift;
use App\Shared\Assets\Contracts\AssetUsageConflictChecker;
use App\Shared\Assets\Data\AssetUsageConflict;
use App\Shared\Assets\Data\AssetUsageRequest;
use App\Shared\Assets\Enums\AssetUsageType;

final class ProjectAssetConflictChecker implements AssetUsageConflictChecker
{
    public function conflicts(AssetUsageRequest $request): iterable
    {
        if ($request->usageType === AssetUsageType::AssetStatusChange) {
            return [];
        }
        $phaseId = null;
        if ($request->source?->aggregateType === 'project_phase') {
            $phaseId = $request->source->aggregateId;
        } elseif ($request->source?->aggregateType === 'dispatch_job') {
            $phaseId = ProjectShift::query()->where('dispatch_job_id', $request->source->aggregateId)->value('project_phase_id');
        } elseif ($request->source?->aggregateType === 'dispatch_asset_assignment') {
            $jobId = DispatchAssetAssignment::query()->whereKey($request->source->aggregateId)->value('dispatch_job_id');
            $phaseId = ProjectShift::query()->where('dispatch_job_id', $jobId)->value('project_phase_id');
        }

        $query = ProjectAllocation::query()->where('operational_asset_id', $request->assetId);
        if ($request->windowStart !== null && $request->windowEnd !== null) {
            $query->where('starts_at', '<', $request->windowEnd)->where('ends_at', '>', $request->windowStart);
        } else {
            $query->where('ends_at', '>', now());
        }
        foreach ($query->get() as $allocation) {
            // A shift consumes its phase's reservation; maintenance still blocks it.
            if ($phaseId === $allocation->project_phase_id && $allocation->kind === 'reservation') {
                continue;
            }
            if ($phaseId === $allocation->project_phase_id && $request->source?->aggregateType === 'project_phase') {
                continue;
            }

            return [new AssetUsageConflict(
                'project.allocation_overlap',
                $allocation->kind === 'maintenance' ? 'Planned maintenance blocks this asset during the selected window.' : 'This asset is reserved for another project phase.',
            )];
        }

        return [];
    }
}
