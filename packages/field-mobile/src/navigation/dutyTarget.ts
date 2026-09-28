import type { AssetAssignment, DispatchJob } from '../types/index';

export interface DutyTargetInput {
    /** The job and assignment of the unit the operator has linked. */
    linkedJob: DispatchJob | null;
    linkedAsset: AssetAssignment | null;
    liveJobs: DispatchJob[];
    selectedJobId: number | null;
    selectedAssetId: number | null;
}

export interface DutyTarget {
    dispatchJobId: number | null;
    operationalAssetId: number | null;
}

/**
 * The unit and job a duty change is recorded against. The linked unit comes
 * first: it is the machine the operator is on, even when they have other
 * live jobs. Without a link, the selected job, or the only live job.
 */
export function dutyTarget({
    linkedJob,
    linkedAsset,
    liveJobs,
    selectedJobId,
    selectedAssetId,
}: DutyTargetInput): DutyTarget {
    if (linkedJob && linkedAsset) {
        return {
            dispatchJobId: linkedJob.id,
            operationalAssetId: linkedAsset.operational_asset_id,
        };
    }

    const job =
        liveJobs.find((candidate) => candidate.id === selectedJobId) ??
        (liveJobs.length === 1 ? liveJobs[0] : null);

    return {
        dispatchJobId: job?.id ?? null,
        operationalAssetId:
            selectedAssetId ??
            (job?.asset_assignments?.length === 1
                ? job.asset_assignments[0].operational_asset_id
                : null),
    };
}
