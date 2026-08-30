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
 * prioritizing assigned job sites and asset locations, with a
 * fallback to geographic area and landmark lookups.
 */
export function resolveLocationName(
    location: LocationResolutionInput,
): string {
    // 1. Explicit site name from active dispatch job
    if (location.job?.site?.trim()) {
        return location.job.site.trim();
    }

    // 2. Explicit base location from operational asset
    if (location.asset?.location?.trim()) {
        return location.asset.location.trim();
    }

    // 3. Known landmark/site lookup by coordinates
    if (
        location.latitude !== null &&
        location.latitude !== undefined &&
        location.longitude !== null &&
        location.longitude !== undefined
    ) {
        const lat = location.latitude;
        const lng = location.longitude;

        // Santa Mesa / Pandacan / Manila (e.g. 14.5995, 121.0142)
        if (lat >= 14.585 && lat <= 14.615 && lng >= 121.0 && lng <= 121.03) {
            return 'Santa Mesa, Manila';
        }

        // Bonifacio Global City (BGC) / Taguig
        if (lat >= 14.53 && lat <= 14.565 && lng >= 121.035 && lng <= 121.065) {
            return 'BGC, Taguig';
        }

        // Makati CBD / Ayala
        if (lat >= 14.545 && lat <= 14.57 && lng >= 121.01 && lng <= 121.035) {
            return 'Makati CBD';
        }

        // Ortigas Center / Pasig / Mandaluyong
        if (lat >= 14.575 && lat <= 14.6 && lng >= 121.05 && lng <= 121.08) {
            return 'Ortigas Center, Pasig';
        }

        // North Triangle / Quezon City
        if (lat >= 14.63 && lat <= 14.67 && lng >= 121.02 && lng <= 121.07) {
            return 'North Triangle, Quezon City';
        }

        // Balintawak / Caloocan North
        if (lat >= 14.65 && lat <= 14.675 && lng >= 120.98 && lng <= 121.01) {
            return 'Balintawak, Caloocan';
        }

        // Marikina River Site
        if (lat >= 14.625 && lat <= 14.655 && lng >= 121.09 && lng <= 121.12) {
            return 'Marikina River Site';
        }

        // Manila Port Area / South Harbor
        if (lat >= 14.57 && lat <= 14.6 && lng >= 120.95 && lng <= 120.98) {
            return 'Manila Port Area';
        }

        // Default to formatted coordinates if outside predefined geofences
        return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }

    return 'Site Location Unavailable';
}
