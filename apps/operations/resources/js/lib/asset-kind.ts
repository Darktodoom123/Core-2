import {
    ADDRESS_PENDING_LABEL,
    ADDRESS_UNAVAILABLE_LABEL,
    getCachedPlace,
    placeLabel,
    primePlace,
    resolvePlace,
} from '@/services/reverse-geocoder';
import type {
    LocationUpdateViewModel,
    PlaceViewModel,
} from '@/types/workspace';

export type AssetKind =
    | 'truck'
    | 'crane'
    | 'mobile_crane'
    | 'tower_crane'
    | 'equipment'
    | 'personnel';

export function getAssetKind(location: LocationUpdateViewModel): AssetKind {
    if (location.asset?.kind) {
        if (
            location.asset.kind === 'tower_crane' ||
            location.asset.kind === 'tower'
        ) {
            return 'tower_crane';
        }

        return location.asset.kind === 'vehicle'
            ? 'truck'
            : (location.asset.kind as AssetKind);
    }

    const text = [
        location.asset?.code,
        location.asset?.name,
        location.user?.name,
        location.job?.title,
        location.remarks,
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    if (
        text.includes('twr') ||
        text.includes('tower crane') ||
        text.includes('tower_crane') ||
        text.includes('potain') ||
        text.includes('topless')
    ) {
        return 'tower_crane';
    }

    if (
        text.includes('mob') ||
        text.includes('mobile crane') ||
        text.includes('mobile_crane')
    ) {
        return 'mobile_crane';
    }

    if (
        text.includes('trk') ||
        text.includes('truck') ||
        text.includes('hauler') ||
        text.includes('dump') ||
        text.includes('driver')
    ) {
        return 'truck';
    }

    if (
        text.includes('crn') ||
        text.includes('crane') ||
        text.includes('lift') ||
        text.includes('hoist') ||
        text.includes('operator')
    ) {
        return 'crane';
    }

    if (
        text.includes('eqp') ||
        text.includes('dozer') ||
        text.includes('rig') ||
        text.includes('gen') ||
        text.includes('pump') ||
        text.includes('mechanic')
    ) {
        return 'equipment';
    }

    return 'equipment';
}

export function getAssetKindLabel(kind: AssetKind): string {
    switch (kind) {
        case 'tower_crane':
            return 'Stationary / Tower Crane';
        case 'mobile_crane':
            return 'Mobile Crane';
        case 'crane':
            return 'Crane';
        case 'truck':
            return 'Truck / Transport';
        case 'equipment':
            return 'Heavy Equipment';
        case 'personnel':
            return 'Equipment';
        default:
            return 'Equipment';
    }
}

export interface LocationResolutionInput {
    latitude?: number | null;
    longitude?: number | null;
    job?: {
        site?: string | null;
        title?: string | null;
    } | null;
    asset?: {
        id?: number | null;
        code?: string | null;
        name?: string | null;
        kind?: string | null;
        location?: string | null;
    } | null;
    remarks?: string | null;
    place?: PlaceViewModel | null;
}

/**
 * One-line location for a tracking update (non-React callers such as map
 * popups). With GPS: the nearest mapped address, looked up via the server.
 * Without GPS: the assigned job site or asset base, labelled as such so it
 * is never mistaken for a live position.
 */
export function resolveLocationName(location: LocationResolutionInput): string {
    const { latitude, longitude } = location;

    if (
        typeof latitude === 'number' &&
        typeof longitude === 'number' &&
        Number.isFinite(latitude) &&
        Number.isFinite(longitude)
    ) {
        primePlace(latitude, longitude, location.place);
        const place = getCachedPlace(latitude, longitude);

        if (place?.status === 'resolved') {
            return placeLabel(place) ?? ADDRESS_UNAVAILABLE_LABEL;
        }

        if (place?.status === 'unavailable') {
            return ADDRESS_UNAVAILABLE_LABEL;
        }

        if (typeof window !== 'undefined' && typeof fetch === 'function') {
            void resolvePlace(latitude, longitude);
        }

        return ADDRESS_PENDING_LABEL;
    }

    if (location.job?.site?.trim()) {
        return `Job site: ${location.job.site.trim()} (no live GPS)`;
    }

    if (location.asset?.location?.trim()) {
        return `Base: ${location.asset.location.trim()} (no live GPS)`;
    }

    return 'No GPS fix';
}
