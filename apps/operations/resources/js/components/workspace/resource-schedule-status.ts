import type {
    AssetDispatchOccupancyViewModel,
    AssetViewModel,
    CanonicalStatusValue,
    DispatchJobViewModel,
    StatusViewModel,
} from '@/types/workspace';

export type ResourceStatusTone =
    'success' | 'warning' | 'error' | 'brand' | 'info' | 'neutral';

const ACTIVE_JOB_STATUSES = ['accepted', 'en_route', 'arrived', 'working'];
const OPEN_ASSET_STATUSES = ['available', 'ready_for_service'];

// The fleet record only flips once a dispatch physically moves the asset, so an
// "available" resource can still be committed to jobs on the board. Derive the
// occupancy from the jobs the row is carrying for the visible window.
export function getScheduleAwareStatus(
    baseLabel: string,
    baseTone: ResourceStatusTone,
    assignedJobs: DispatchJobViewModel[],
): { label: string; tone: ResourceStatusTone } {
    if (baseTone !== 'success') {
        return { label: baseLabel, tone: baseTone };
    }

    const openJobs = assignedJobs.filter(
        (job) =>
            job.status.value !== 'completed' &&
            job.status.value !== 'cancelled',
    );

    if (
        openJobs.some((job) => ACTIVE_JOB_STATUSES.includes(job.status.value))
    ) {
        return { label: 'On Job', tone: 'info' };
    }

    if (openJobs.some((job) => job.status.value === 'dispatched')) {
        return { label: 'Dispatched', tone: 'brand' };
    }

    if (openJobs.some((job) => job.status.value === 'scheduled')) {
        return { label: 'Scheduled', tone: 'brand' };
    }

    if (openJobs.length > 0) {
        return { label: 'Tentative', tone: 'warning' };
    }

    return { label: baseLabel, tone: baseTone };
}

const OCCUPANCY_STATUS_VALUES: Record<
    AssetDispatchOccupancyViewModel['state'],
    CanonicalStatusValue
> = {
    on_job: 'working',
    dispatched: 'dispatched',
    scheduled: 'scheduled',
    tentative: 'pending',
};

// Status to show for an asset outside the schedule boards: an open asset that is
// committed to dispatch work reads as that commitment, not "Available".
export function resolveAssetDisplayStatus(
    asset: Pick<AssetViewModel, 'status' | 'dispatch_occupancy'>,
): StatusViewModel<CanonicalStatusValue> {
    const occupancy = asset.dispatch_occupancy;

    if (!occupancy || !OPEN_ASSET_STATUSES.includes(asset.status.value)) {
        return asset.status;
    }

    return {
        value: OCCUPANCY_STATUS_VALUES[occupancy.state],
        label: occupancy.label,
    };
}
