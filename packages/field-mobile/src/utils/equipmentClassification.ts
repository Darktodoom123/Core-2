import type { TechnicianInspectionCheck } from '../types/index';

export type DesignatedEquipmentType =
    'tower_crane' | 'mobile_crane' | 'carrier';

export interface AssetEquipmentDescriptor {
    assetCode?: string | null;
    assetName?: string | null;
    assetKind?: string | null;
    equipmentType?: string | null;
}

export interface EquipmentPresentation {
    type: DesignatedEquipmentType;
    icon: string;
    label: string;
    shortLabel: string;
    modalTitle: string;
    defectsSectionTitle: string;
    searchPlaceholder: string;
    safetySafeLabel: string;
    safetyDisclaimer: string;
    filterPillLabel: string;
    designatedBadgeLabel: string;
}

/**
 * Resolves the designated equipment type for an asset based on explicit override,
 * assetKind, or keyword patterns in asset code / name.
 */
export function resolveDesignatedEquipmentType(
    asset?: AssetEquipmentDescriptor | null,
): DesignatedEquipmentType {
    if (!asset) {
        return 'mobile_crane';
    }

    // 1. Explicit equipmentType override
    if (asset.equipmentType) {
        const normalized = asset.equipmentType.toLowerCase().trim();

        if (normalized === 'tower_crane' || normalized === 'tower') {
            return 'tower_crane';
        }

        if (
            normalized === 'carrier' ||
            normalized === 'vehicle' ||
            normalized === 'truck'
        ) {
            return 'carrier';
        }

        if (
            normalized === 'mobile_crane' ||
            normalized === 'crane' ||
            normalized === 'all_terrain'
        ) {
            return 'mobile_crane';
        }
    }

    // 2. assetKind evaluation
    if (asset.assetKind) {
        const kind = asset.assetKind.toLowerCase().trim();

        if (
            kind === 'tower_crane' ||
            kind === 'tower' ||
            kind === 'climbing_crane' ||
            kind === 'hoist'
        ) {
            return 'tower_crane';
        }

        if (
            kind === 'truck' ||
            kind === 'vehicle' ||
            kind === 'carrier' ||
            kind === 'fleet' ||
            kind === 'trailer' ||
            kind === 'lowbed' ||
            kind === 'flatbed' ||
            kind === 'transport'
        ) {
            return 'carrier';
        }

        if (
            kind === 'mobile_crane' ||
            kind === 'crane' ||
            kind === 'crawler' ||
            kind === 'rough_terrain' ||
            kind === 'all_terrain'
        ) {
            return 'mobile_crane';
        }
    }

    // 3. Heuristic matching across code and name
    const combined =
        `${asset.assetCode || ''} ${asset.assetName || ''}`.toLowerCase();

    // Tower Crane heuristics
    if (
        combined.includes('tower') ||
        combined.includes('twr') ||
        combined.includes('potain') ||
        combined.includes('wolff') ||
        combined.includes('hammerhead') ||
        combined.includes('luffing jib') ||
        combined.includes('280 ec-h') ||
        combined.includes('stationary crane')
    ) {
        return 'tower_crane';
    }

    // Vehicle / Truck / Carrier heuristics
    if (
        combined.includes('trk') ||
        combined.includes('truck') ||
        combined.includes('carrier') ||
        combined.includes('trailer') ||
        combined.includes('lowbed') ||
        combined.includes('flatbed') ||
        combined.includes('rig truck') ||
        combined.includes('mover') ||
        combined.includes('cascadia') ||
        combined.includes('isuzu') ||
        combined.includes('pickup') ||
        combined.includes('van') ||
        combined.includes('escort')
    ) {
        return 'carrier';
    }

    // Mobile Crane heuristics
    if (
        combined.includes('crn') ||
        combined.includes('crane') ||
        combined.includes('tadano') ||
        combined.includes('all-terrain') ||
        combined.includes('all terrain') ||
        combined.includes('crawler') ||
        combined.includes('rough-terrain') ||
        combined.includes('rough terrain') ||
        combined.includes('liebherr ltm') ||
        combined.includes('grove') ||
        combined.includes('kobelco') ||
        combined.includes('zoomlion')
    ) {
        return 'mobile_crane';
    }

    // Default fallback
    return 'mobile_crane';
}

/**
 * Returns user-facing visual presentation data, labels, and placeholders
 * tailored to the designated equipment type.
 */
export function getEquipmentPresentation(
    type: DesignatedEquipmentType,
): EquipmentPresentation {
    switch (type) {
        case 'tower_crane':
            return {
                type: 'tower_crane',
                icon: 'crane',
                label: 'Tower Crane',
                shortLabel: 'Tower Crane',
                modalTitle: 'Add Tower Crane Defects',
                defectsSectionTitle: 'Add crane tower defects',
                searchPlaceholder: 'Search tower crane & rigging defects...',
                safetySafeLabel: 'Safe to operate',
                safetyDisclaimer:
                    'Any crane tower attributes not displayed are certified safe by the crane operator',
                filterPillLabel: 'Tower Crane',
                designatedBadgeLabel: 'Tower Crane (Designated)',
            };
        case 'carrier':
            return {
                type: 'carrier',
                icon: 'truck',
                label: 'Vehicle / Carrier',
                shortLabel: 'Vehicle',
                modalTitle: 'Add Vehicle Defects',
                defectsSectionTitle: 'Add vehicle defects',
                searchPlaceholder: 'Search vehicle & carrier defects...',
                safetySafeLabel: 'Safe to drive',
                safetyDisclaimer:
                    'Any vehicle attributes not displayed are certified safe by the driver',
                filterPillLabel: 'Carrier & Road',
                designatedBadgeLabel: 'Carrier & Road (Designated)',
            };
        case 'mobile_crane':
        default:
            return {
                type: 'mobile_crane',
                icon: 'crane',
                label: 'Mobile Crane',
                shortLabel: 'Mobile Crane',
                modalTitle: 'Add Mobile Crane Defects',
                defectsSectionTitle: 'Add mobile crane defects',
                searchPlaceholder: 'Search mobile crane & chassis defects...',
                safetySafeLabel: 'Safe to drive',
                safetyDisclaimer:
                    'Any mobile crane attributes not displayed are certified safe by the crane operator',
                filterPillLabel: 'Mobile Crane',
                designatedBadgeLabel: 'Mobile Crane (Designated)',
            };
    }
}

/**
 * Returns tailored initial DVIR walkaround checks matching the specific
 * mechanical realities of the equipment.
 */
export function getDefaultInspectionChecks(
    type: DesignatedEquipmentType,
): TechnicianInspectionCheck[] {
    switch (type) {
        case 'tower_crane':
            return [
                {
                    id: 'chk-tower-mast-01',
                    category: 'structural',
                    label: 'Tower mast connection pins, base stools & anchors',
                    status: 'good',
                    statusLabel: 'Pass · Foundation & pins secure',
                    icon: '',
                },
                {
                    id: 'chk-tower-jib-01',
                    category: 'structural',
                    label: 'Main jib lattice, pendant ropes & cathead',
                    status: 'good',
                    statusLabel: 'Pass · Lattice & pendants intact',
                    icon: '',
                },
                {
                    id: 'chk-tower-trolley-01',
                    category: 'structural',
                    label: 'Trolley winch, wire rope & rail buffers',
                    status: 'good',
                    statusLabel: 'Pass · Smooth travel & buffers intact',
                    icon: '',
                },
                {
                    id: 'chk-tower-elec-01',
                    category: 'electrical',
                    label: 'Load Moment Indicator (LMI), A2B & anemometer',
                    status: 'good',
                    statusLabel: 'Pass · Calibrated & wind alarm active',
                    icon: '',
                },
                {
                    id: 'chk-tower-safe-01',
                    category: 'safety_devices',
                    label: 'Emergency e-stop, aviation beacon & warning lights',
                    status: 'good',
                    statusLabel: 'Pass · Functional',
                    icon: '',
                },
            ];

        case 'carrier':
            return [
                {
                    id: 'chk-veh-brake-01',
                    category: 'hydraulics',
                    label: 'Air brake pressures, lines & gladhands',
                    status: 'good',
                    statusLabel: 'Pass · 100+ PSI baseline verified',
                    icon: '',
                },
                {
                    id: 'chk-veh-fluids-01',
                    category: 'fluids',
                    label: 'Engine oil, coolant & hydraulic fluid levels',
                    status: 'good',
                    statusLabel: 'Pass · Normal operating levels',
                    icon: '',
                },
                {
                    id: 'chk-veh-steer-01',
                    category: 'structural',
                    label: 'Steering linkage, suspension & belts',
                    status: 'good',
                    statusLabel: 'Pass · Firm response & zero play',
                    icon: '',
                },
                {
                    id: 'chk-tire-01',
                    category: 'tires_tracks',
                    label: 'Tire pressures & wheel lug torque',
                    status: 'good',
                    statusLabel: 'Pass · 120 PSI baseline verified',
                    icon: '',
                },
                {
                    id: 'chk-safe-01',
                    category: 'safety_devices',
                    label: 'Headlights, brake lights, horn & warning triangles',
                    status: 'good',
                    statusLabel: 'Pass · All signals functional',
                    icon: '',
                },
            ];

        case 'mobile_crane':
        default:
            return [
                {
                    id: 'chk-hyd-01',
                    category: 'hydraulics',
                    label: 'Hydraulic cylinders, rams & outrigger hoses',
                    status: 'good',
                    statusLabel: 'Pass · No fluid leaks',
                    icon: '',
                },
                {
                    id: 'chk-elec-01',
                    category: 'electrical',
                    label: 'Load Moment Indicator (LMI) & A2B Alarm',
                    status: 'good',
                    statusLabel: 'Pass · Audible alarm active',
                    icon: '',
                },
                {
                    id: 'chk-struct-01',
                    category: 'structural',
                    label: 'Telescopic boom & wear pads',
                    status: 'good',
                    statusLabel: 'Pass · Structural integrity intact',
                    icon: '',
                },
                {
                    id: 'chk-tire-01',
                    category: 'tires_tracks',
                    label: 'Tire pressures & wheel lug torque',
                    status: 'good',
                    statusLabel: 'Pass · 120 PSI baseline verified',
                    icon: '',
                },
                {
                    id: 'chk-safe-01',
                    category: 'safety_devices',
                    label: 'Emergency e-stop, beacon & horn',
                    status: 'good',
                    statusLabel: 'Pass · Functional',
                    icon: '',
                },
            ];
    }
}
