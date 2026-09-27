import type { FuelStatus, MobileFuelRequest } from '../../types/fuel';

/** Terminal fuel states: the request is history and needs no action. */
export const FINISHED_FUEL_STATUSES: readonly FuelStatus[] = [
    'logged',
    'rejected',
    'withdrawn',
];

export interface FuelSection {
    title: string | null;
    requests: MobileFuelRequest[];
}

/**
 * Requests tab: ready to refuel first, then live requests, then finished
 * ones under their own heading. Fuel logs is already a record, so it stays
 * one list.
 */
export function fuelSections(
    tab: 'requests' | 'logs',
    requests: MobileFuelRequest[],
): FuelSection[] {
    if (tab === 'logs') {
        return requests.length > 0 ? [{ title: null, requests }] : [];
    }

    const isFinished = (request: MobileFuelRequest) =>
        FINISHED_FUEL_STATUSES.includes(request.status);

    return [
        {
            title: 'Ready to refuel',
            requests: requests.filter((r) => r.status === 'verified'),
        },
        {
            title: 'In progress',
            requests: requests.filter(
                (r) => r.status !== 'verified' && !isFinished(r),
            ),
        },
        { title: 'Finished', requests: requests.filter(isFinished) },
    ].filter((section) => section.requests.length > 0);
}
