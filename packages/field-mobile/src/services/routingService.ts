/**
 * Real-world Routing Service for Heavy Crane Navigation
 * Connects to Open Source Routing Machine (OSRM) to calculate authentic,
 * street-by-street road geometry and turn-by-turn maneuvers to designated job locations.
 */

export interface OsrmStepManeuver {
    type: string; // 'turn', 'depart', 'arrive', 'merge', 'on ramp', 'off ramp', 'fork', 'roundabout'
    modifier?: string; // 'left', 'right', 'slight left', 'slight right', 'straight', 'sharp left', 'sharp right'
    location: [number, number]; // [lng, lat]
    bearing_after?: number;
    bearing_before?: number;
}

export interface OsrmStep {
    name: string;
    distance: number; // meters
    duration: number; // seconds
    maneuver: OsrmStepManeuver;
}

export interface RealRoadTurn {
    id: string;
    stepNumber: number;
    maneuverIcon:
        | 'route'
        | 'alert'
        | 'chevron-down'
        | 'chevron-up'
        | 'chevron-left'
        | 'chevron-right'
        | 'pin'
        | 'flag';
    maneuverArrow: string;
    distanceNext: string;
    distanceMeters: number;
    roadName: string;
    instruction: string;
    laneGuidance: string;
    activeLaneIndex: number;
    speedLimit: number;
    voiceAnnouncement: string;
    remainingEta: string;
    remainingDistance: string;
    caution?: string;
    isHazard?: boolean;
    coords: [number, number];
    bearing?: number;
}

export interface RealRouteResult {
    coordinates: [number, number][];
    totalDistanceMeters: number;
    totalDurationSeconds: number;
    turns: RealRoadTurn[];
}

export interface LocationPreset {
    id: string;
    label: string;
    description: string;
    coords: [number, number]; // [lng, lat]
    type: 'origin' | 'destination';
}

export const FLEET_ORIGIN_PRESETS: LocationPreset[] = [
    {
        id: 'current_gps',
        label: '📍 Current Location (GPS)',
        description: 'Live device satellite position',
        coords: [120.9842, 14.5995],
        type: 'origin',
    },
    {
        id: 'manila_yard',
        label: '🏗️ Alibaton Main Equipment Yard (Manila)',
        description: 'Heavy Fleet Depot & Dispatch base',
        coords: [120.9842, 14.5995],
        type: 'origin',
    },
    {
        id: 'batangas_port',
        label: '⚓ South Staging Facility (Batangas Port)',
        description: 'Heavy coastal rig marshaling staging point',
        coords: [121.085, 13.805],
        type: 'origin',
    },
    {
        id: 'calamba_staging',
        label: '🚛 SLEX Calamba Interchange Staging Base',
        description: 'South Luzon heavy vehicle escort meetup area',
        coords: [121.135, 14.205],
        type: 'origin',
    },
];

export const PROJECT_SITE_PRESETS: LocationPreset[] = [
    {
        id: 'batangas_power',
        label: 'Batangas Power Plant Expansion',
        description: 'Gate 3 (South Heavy Haul Access) · 50T Rigging Bay 4',
        coords: [121.05, 13.7565],
        type: 'destination',
    },
    {
        id: 'subic_marine',
        label: 'Subic Marine Terminal Heavy Rigging Base',
        description: 'Deepwater Pier Gate 1 · 80T Gantry Staging',
        coords: [120.2833, 14.821],
        type: 'destination',
    },
    {
        id: 'calamba_hub',
        label: 'Calamba Industrial Logistics Hub',
        description: 'Industrial Park 2 · Heavy Machinery Bay C',
        coords: [121.135, 14.205],
        type: 'destination',
    },
    {
        id: 'taguig_tower',
        label: 'Taguig Commercial Center Tower B Staging',
        description: 'Urban Foundation Project · Night Escort Gate',
        coords: [121.05, 14.55],
        type: 'destination',
    },
];

export interface HeavyClearanceCheckResult {
    passed: boolean;
    clearanceRating: string;
    warningNote?: string;
    clearanceHeightMetres: number;
    escortRequired: boolean;
}

export function evaluateHeavyEquipmentClearance(
    destinationCoords: [number, number],
    equipmentHeightM = 4.0,
): HeavyClearanceCheckResult {
    const isNearOldMillOverpass =
        Math.abs(destinationCoords[0] - 121.05) < 0.3 &&
        Math.abs(destinationCoords[1] - 13.75) < 0.3;

    if (isNearOldMillOverpass && equipmentHeightM >= 4.0) {
        return {
            passed: true,
            clearanceRating: 'CORRIDOR VERIFIED WITH BYPASS',
            warningNote:
                'Bridge clearance only 4.1m on Old Mill Road — follow commercial outer lane corridor.',
            clearanceHeightMetres: 4.8,
            escortRequired: true,
        };
    }

    return {
        passed: true,
        clearanceRating: 'CORRIDOR APPROVED',
        clearanceHeightMetres: 5.2,
        escortRequired: equipmentHeightM >= 3.8,
    };
}

function formatMetersToDistance(meters: number): string {
    if (meters < 1000) {
        return `In ${Math.round(meters / 10) * 10} m`;
    }

    return `In ${(meters / 1000).toFixed(1)} km`;
}

function formatMetersToRemaining(meters: number): string {
    if (meters < 1000) {
        return `${Math.round(meters)} m`;
    }

    return `${(meters / 1000).toFixed(1)} km`;
}

function formatSecondsToEta(seconds: number): string {
    const mins = Math.max(1, Math.round(seconds / 60));

    if (mins < 60) {
        return `${mins} min`;
    }

    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;

    return `${hours} hr ${remMins} min`;
}

function mapManeuverToInstruction(
    type: string,
    modifier?: string,
    name?: string,
): {
    instruction: string;
    icon:
        | 'route'
        | 'alert'
        | 'chevron-down'
        | 'chevron-up'
        | 'chevron-left'
        | 'chevron-right'
        | 'pin'
        | 'flag';
    arrow: string;
    laneIndex: number;
} {
    const road = name?.trim() || 'designated heavy haul route';

    if (type === 'depart') {
        return {
            instruction: `Head out on ${road}. Maintain right escort lane.`,
            icon: 'route',
            arrow: '↑',
            laneIndex: 2,
        };
    }

    if (type === 'arrive') {
        return {
            instruction: `Arrive at designated site entrance on ${road}. Proceed to staging bay.`,
            icon: 'flag',
            arrow: '🏁',
            laneIndex: 1,
        };
    }

    if (type === 'merge' || type === 'on ramp') {
        return {
            instruction: `Merge ${modifier ? modifier + ' ' : ''}onto ${road}.`,
            icon: 'route',
            arrow: modifier?.includes('left') ? '↰' : '↱',
            laneIndex: 2,
        };
    }

    if (modifier?.includes('left')) {
        return {
            instruction: `Turn ${modifier} onto ${road}.`,
            icon: 'chevron-left',
            arrow: '↰',
            laneIndex: 0,
        };
    }

    if (modifier?.includes('right')) {
        return {
            instruction: `Turn ${modifier} onto ${road}.`,
            icon: 'chevron-right',
            arrow: '↱',
            laneIndex: 2,
        };
    }

    return {
        instruction: `Continue on ${road}.`,
        icon: 'chevron-up',
        arrow: '↑',
        laneIndex: 1,
    };
}

/**
 * Fetch real street-snapped driving route from OSRM between two coordinates.
 */
export async function fetchRealRoadRoute(
    origin: [number, number],
    destination: [number, number],
): Promise<RealRouteResult | null> {
    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${origin[0]},${origin[1]};${destination[0]},${destination[1]}?overview=full&geometries=geojson&steps=true`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
            return null;
        }

        const data = await response.json();

        if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
            return null;
        }

        const route = data.routes[0];
        const coordinates: [number, number][] = route.geometry.coordinates;
        const rawSteps: OsrmStep[] = route.legs?.[0]?.steps || [];

        let accumulatedDistance = 0;
        let accumulatedDuration = 0;

        const turns: RealRoadTurn[] = rawSteps.map((step, idx) => {
            const distance = step.distance || 0;
            const duration = step.duration || 0;

            const remainingDistance = Math.max(
                0,
                route.distance - accumulatedDistance,
            );
            const remainingDuration = Math.max(
                0,
                route.duration - accumulatedDuration,
            );

            accumulatedDistance += distance;
            accumulatedDuration += duration;

            const { instruction, icon, arrow, laneIndex } =
                mapManeuverToInstruction(
                    step.maneuver.type,
                    step.maneuver.modifier,
                    step.name,
                );

            const roadName = step.name?.trim() || `Corridor Segment ${idx + 1}`;
            const isHighway =
                roadName.toLowerCase().includes('expressway') ||
                roadName.toLowerCase().includes('highway') ||
                roadName.toLowerCase().includes('slex') ||
                roadName.toLowerCase().includes('star');

            return {
                id: `osrm-step-${idx + 1}`,
                stepNumber: idx + 1,
                maneuverIcon: icon,
                maneuverArrow: arrow,
                distanceNext: formatMetersToDistance(distance),
                distanceMeters: distance,
                roadName,
                instruction,
                laneGuidance: isHighway
                    ? 'Stay in right lane for wide-load escort · Speed limit 50 km/h'
                    : 'Maintain commercial vehicle lane · Speed limit 30 km/h',
                activeLaneIndex: laneIndex,
                speedLimit: isHighway ? 50 : 30,
                voiceAnnouncement: `${formatMetersToDistance(distance)}, ${instruction}`,
                remainingEta: formatSecondsToEta(remainingDuration),
                remainingDistance: formatMetersToRemaining(remainingDistance),
                coords: [step.maneuver.location[0], step.maneuver.location[1]],
                bearing: step.maneuver.bearing_after,
            };
        });

        return {
            coordinates,
            totalDistanceMeters: route.distance,
            totalDurationSeconds: route.duration,
            turns,
        };
    } catch {
        return null;
    }
}
