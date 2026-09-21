import type { AssetViewModel } from '@/types/workspace';

export type FleetDispatchabilityState =
    'ready' | 'blocking_work_orders' | 'inspection_required' | null;

/**
 * Mirrors the backend dispatchability calculation using fields already
 * present in the Fleet asset view model.
 */
export function getFleetDispatchabilityState(
    asset: AssetViewModel,
): FleetDispatchabilityState {
    if (asset.is_dispatchable) {
        return 'ready';
    }

    if (asset.blocking_work_orders_count > 0) {
        return 'blocking_work_orders';
    }

    const statusCanBeDispatched =
        asset.status.value === 'available' ||
        asset.status.value === 'ready_for_service';

    if (!statusCanBeDispatched) {
        return null;
    }

    const latestDvir = asset.latest_dvir ?? null;
    const hasPassingInspection =
        asset.inspections.some(
            (inspection) =>
                inspection.result === 'passed' &&
                inspection.completed_at !== null,
        ) ||
        (latestDvir !== null &&
            !latestDvir.has_defects &&
            latestDvir.critical_defects_count === 0);

    return hasPassingInspection ? null : 'inspection_required';
}
