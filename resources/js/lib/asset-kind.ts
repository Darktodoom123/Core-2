import {
    getCachedLocationName,
    reverseGeocode,
} from '@/services/reverse-geocoder';
import type { LocationUpdateViewModel } from '@/types/workspace';

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

    return 'personnel';
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
            return 'Field Personnel';
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
}

/**
 * Resolves a human-readable location name for a tracking update,
 * prioritizing assigned job sites and asset locations, with dynamic
 * reverse-geocoded lookup for coordinates.
 * No hardcoded coordinates.
 */
export function resolveLocationName(location: LocationResolutionInput): string {
    // 1. Explicit site name from active dispatch job
    if (location.job?.site?.trim()) {
        return location.job.site.trim();
    }

    // 2. Explicit base location from operational asset
    if (location.asset?.location?.trim()) {
        return location.asset.location.trim();
    }

    // 3. Dynamic reverse-geocoded location lookup by coordinates
    if (
        location.latitude !== null &&
        location.latitude !== undefined &&
        location.longitude !== null &&
        location.longitude !== undefined
    ) {
        const cached = getCachedLocationName(
            location.latitude,
            location.longitude,
        );

        if (cached) {
            return cached;
        }

        if (typeof window !== 'undefined' && typeof fetch === 'function') {
            void reverseGeocode(location.latitude, location.longitude);
        }

        return 'Locating…';
    }

    return 'Site Location Unavailable';
}
