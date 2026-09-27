import type { DispatchJob } from '../../../types/index';

const MAPS_DIRECTIONS = 'https://www.google.com/maps/dir/?api=1&destination=';

type JobPlace = Pick<DispatchJob, 'site'> &
    Partial<Pick<DispatchJob, 'site_latitude' | 'site_longitude'>>;

const inRange = (value: number | null | undefined, limit: number) =>
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Math.abs(value) <= limit;

/**
 * A maps link to the job site: the exact pin when dispatch set valid
 * coordinates, otherwise the site address. Null when there is nowhere to go.
 * The universal Google Maps link opens the maps app, or the browser if none.
 */
export function directionsUrl(job: JobPlace): string | null {
    const { site_latitude: lat, site_longitude: lng } = job;

    if (inRange(lat, 90) && inRange(lng, 180)) {
        return MAPS_DIRECTIONS + encodeURIComponent(`${lat},${lng}`);
    }

    const address = job.site?.trim();

    return address ? MAPS_DIRECTIONS + encodeURIComponent(address) : null;
}
