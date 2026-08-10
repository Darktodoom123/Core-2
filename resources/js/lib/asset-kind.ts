import type { LocationUpdateViewModel } from '@/types/workspace';

export type AssetKind = 'truck' | 'crane' | 'equipment' | 'personnel';

export function getAssetKind(location: LocationUpdateViewModel): AssetKind {
    if (location.asset?.kind) {
        return location.asset.kind === 'vehicle'
            ? 'truck'
            : location.asset.kind;
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
        text.includes('tech') ||
        text.includes('technician') ||
        text.includes('mechanic')
    ) {
        return 'equipment';
    }

    return 'personnel';
}
