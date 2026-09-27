import type {
    AssetAssignment,
    DispatchJob,
    ReportDelayPayload,
} from '../../../types/index';

/** Server delay reason valid in both the transit and on-site contexts. */
export const REPLACEMENT_REASON = 'equipment_issue';
/** Leads the note so dispatch sees this is a request for another unit. */
export const REPLACEMENT_NOTE_PREFIX = 'Replacement unit needed.';

/**
 * A delay report asking dispatch for a replacement unit. Only dispatch can
 * assign a unit, so the phone never switches units by itself; the job
 * updates when dispatch reassigns.
 */
export function buildReplacementRequest({
    asset,
    job,
    note,
    reportedAt,
}: {
    asset: Pick<AssetAssignment, 'operational_asset_id'> | null;
    job: Pick<DispatchJob, 'id' | 'status' | 'version'>;
    note: string;
    reportedAt: string;
}): ReportDelayPayload {
    return {
        dispatch_job_id: job.id,
        job_version: job.version,
        // The server only accepts these two contexts.
        context: job.status?.value === 'en_route' ? 'transit' : 'on_site',
        reason: REPLACEMENT_REASON,
        operational_asset_id: asset?.operational_asset_id ?? null,
        notes: `${REPLACEMENT_NOTE_PREFIX} ${note.trim()}`,
        reported_at: reportedAt,
    };
}
