import React, { useEffect, useMemo, useState } from 'react';
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import type { IconName } from '../components/common/Icon';
import { Icon } from '../components/common/Icon';
import { MapLibreWebContainer } from '../components/map/MapLibreWebContainer';
import { shadows } from '../components/nativeStyles';
import { NativeLocationAdapter } from '../native/locationAdapter';
import type {
    HeavyClearanceCheckResult,
    LocationPreset,
} from '../services/routingService';
import {
    evaluateHeavyEquipmentClearance,
    fetchRealRoadRoute,
    FLEET_ORIGIN_PRESETS,
    PROJECT_SITE_PRESETS,
} from '../services/routingService';
import { useTheme } from '../theme';
import type { DispatchJob, HeavyRouteInstruction } from '../types/index';

export interface HeavyCraneDriveModeScreenProps {
    activeJob?: DispatchJob | null;
    jobs?: DispatchJob[];
    assetCode?: string;
    assetName?: string;
    operatorName?: string;
    stadiaApiKey?: string;
    onBack?: () => void;
    onArrived?: (jobId: number, version: number) => void;
    onReportDelay?: (delayReason: string) => void;
}

export interface TurnManeuverStep {
    id: string;
    stepNumber: number;
    maneuverIcon: IconName;
    maneuverArrow: string;
    distanceNext: string;
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
}

export interface NavWaypointProgress {
    coords: [number, number];
    bearing: number;
    speed: number;
    stepIndex: number;
    roadName: string;
    distanceNext: string;
    remainingEta: string;
    remainingDistance: string;
}

const FALLBACK_TURN_STEPS: TurnManeuverStep[] = [
    {
        id: 'turn-1',
        stepNumber: 1,
        maneuverIcon: 'route',
        maneuverArrow: '↱',
        distanceNext: 'In 500 m',
        roadName: 'Highway 10 North (Corridor 10-N)',
        instruction:
            'Follow designated heavy transport corridor via Highway 10 North.',
        laneGuidance:
            'Stay in right lane for wide-load escort · Speed limit 50 km/h',
        activeLaneIndex: 2,
        speedLimit: 50,
        voiceAnnouncement:
            'In 500 meters, merge right onto Highway 10 North Corridor.',
        remainingEta: '18 min',
        remainingDistance: '7.4 km',
        caution: 'Bridge clearance only 4.1m — DO NOT ENTER Old Mill Road.',
        isHazard: false,
        coords: [120.9842, 14.5995],
    },
    {
        id: 'turn-2',
        stepNumber: 2,
        maneuverIcon: 'alert',
        maneuverArrow: '↰',
        distanceNext: 'In 4.2 km',
        roadName: 'Exit 24 · Old Mill Overpass Approach',
        instruction:
            'Approach South Construction Gate 3. Avoid overhead bridge on Old Mill Road.',
        laneGuidance:
            'Keep center-right · Bridge clearance only 4.1m — DO NOT ENTER Old Mill Road.',
        activeLaneIndex: 1,
        speedLimit: 40,
        voiceAnnouncement:
            'Caution ahead: 4.1 meter low clearance bridge on Old Mill Road. Maintain center-right lane.',
        remainingEta: '12 min',
        remainingDistance: '4.6 km',
        caution: 'Bridge clearance only 4.1m — DO NOT ENTER Old Mill Road.',
        isHazard: true,
        coords: [121.168, 13.945],
    },
    {
        id: 'turn-3',
        stepNumber: 3,
        maneuverIcon: 'chevron-down',
        maneuverArrow: '↰',
        distanceNext: 'In 2.8 km',
        roadName: 'Batangas Industrial Parkway',
        instruction:
            'Turn left at industrial signals toward Batangas Power Station.',
        laneGuidance:
            'Signal wide-radius turn 300m early · Engage escort lead vehicle',
        activeLaneIndex: 0,
        speedLimit: 30,
        voiceAnnouncement:
            'In 2.8 kilometers, turn left onto Industrial Access Parkway.',
        remainingEta: '4 min',
        remainingDistance: '1.2 km',
        caution: 'Heavy vehicle turning radius requires full outside lane.',
        isHazard: false,
        coords: [121.085, 13.805],
    },
    {
        id: 'turn-4',
        stepNumber: 4,
        maneuverIcon: 'flag',
        maneuverArrow: '↑',
        distanceNext: 'In 400 m',
        roadName: 'Gate 3 · Heavy Haul Access',
        instruction:
            'Check in with Site Marshaling Officer at designated heavy vehicle staging bay.',
        laneGuidance:
            'Proceed to Bay 4 — Heavy Rigging Marshalling for induction',
        activeLaneIndex: 2,
        speedLimit: 15,
        voiceAnnouncement:
            'Arriving at Gate 3. Stop vehicle for marshalling inspection.',
        remainingEta: '1 min',
        remainingDistance: '400 m',
        caution: 'Engage hazard beacons upon gate entrance.',
        isHazard: false,
        coords: [121.05, 13.7565],
    },
];

const LIVE_NAVIGATION_TRACK: NavWaypointProgress[] = [
    {
        coords: [120.9842, 14.5995],
        bearing: 155,
        speed: 42,
        stepIndex: 0,
        roadName: 'Highway 10 North (Corridor 10-N)',
        distanceNext: 'In 500 m',
        remainingEta: '18 min',
        remainingDistance: '7.4 km',
    },
    {
        coords: [121.012, 14.502],
        bearing: 160,
        speed: 45,
        stepIndex: 0,
        roadName: 'Highway 10 North (Corridor 10-N)',
        distanceNext: 'In 250 m',
        remainingEta: '16 min',
        remainingDistance: '6.8 km',
    },
    {
        coords: [121.042, 14.412],
        bearing: 165,
        speed: 48,
        stepIndex: 1,
        roadName: 'SLEX Alabang Interchange',
        distanceNext: 'In 4.2 km',
        remainingEta: '14 min',
        remainingDistance: '5.9 km',
    },
    {
        coords: [121.076, 14.289],
        bearing: 150,
        speed: 50,
        stepIndex: 1,
        roadName: 'South Luzon Expressway',
        distanceNext: 'In 2.5 km',
        remainingEta: '13 min',
        remainingDistance: '5.1 km',
    },
    {
        coords: [121.135, 14.205],
        bearing: 175,
        speed: 44,
        stepIndex: 1,
        roadName: 'STAR Tollway Approach',
        distanceNext: 'In 1.1 km',
        remainingEta: '12 min',
        remainingDistance: '4.6 km',
    },
    {
        coords: [121.168, 13.945],
        bearing: 190,
        speed: 38,
        stepIndex: 2,
        roadName: 'Old Mill Overpass Bypass',
        distanceNext: 'In 2.8 km',
        remainingEta: '8 min',
        remainingDistance: '3.2 km',
    },
    {
        coords: [121.145, 13.88],
        bearing: 200,
        speed: 32,
        stepIndex: 2,
        roadName: 'STAR Tollway Southbound',
        distanceNext: 'In 1.4 km',
        remainingEta: '6 min',
        remainingDistance: '2.1 km',
    },
    {
        coords: [121.085, 13.805],
        bearing: 185,
        speed: 28,
        stepIndex: 2,
        roadName: 'Batangas Industrial Parkway',
        distanceNext: 'In 400 m',
        remainingEta: '4 min',
        remainingDistance: '1.2 km',
    },
    {
        coords: [121.065, 13.78],
        bearing: 195,
        speed: 20,
        stepIndex: 3,
        roadName: 'South Power Plant Access Road',
        distanceNext: 'In 400 m',
        remainingEta: '2 min',
        remainingDistance: '600 m',
    },
    {
        coords: [121.05, 13.7565],
        bearing: 210,
        speed: 0,
        stepIndex: 3,
        roadName: 'Gate 3 · Heavy Rigging Bay 4',
        distanceNext: 'Bay 4 Arrived',
        remainingEta: '1 min',
        remainingDistance: '400 m',
    },
];

const DEFAULT_INSTRUCTIONS: HeavyRouteInstruction[] = [
    {
        id: 'step-1',
        stepNumber: 1,
        instruction:
            'Follow designated heavy transport corridor via Highway 10 North.',
        distanceLabel: '4.2 km',
        caution: 'Stay in right lane for wide-load escort.',
    },
    {
        id: 'step-2',
        stepNumber: 2,
        instruction:
            'Approach South Construction Gate 3. Avoid overhead bridge on Old Mill Road.',
        distanceLabel: '2.8 km',
        caution: 'Bridge clearance only 4.1m — DO NOT ENTER Old Mill Road.',
        isHazard: true,
    },
    {
        id: 'step-3',
        stepNumber: 3,
        instruction:
            'Check in with Site Marshaling Officer at designated heavy vehicle staging bay.',
        distanceLabel: '400 m',
        caution: 'Engage hazard beacons upon gate entrance.',
    },
];

const DELAY_REASONS = [
    'Heavy traffic / escort delay',
    'Low clearance detour required',
    'Site gate locked / check-in queue',
    'Road construction barrier',
];

export const HeavyCraneDriveModeScreen: React.FC<
    HeavyCraneDriveModeScreenProps
> = ({
    activeJob,
    jobs = [],
    assetCode = 'ALB-CRN-050',
    assetName = '50T Tadano All-Terrain Crane',
    operatorName = 'Alex Rivera',
    stadiaApiKey,
    onBack,
    onArrived,
    onReportDelay,
}) => {
    const { isDarkHud } = useTheme();
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [simTrackIndex, setSimTrackIndex] = useState(0);
    const [isSimulatingDrive, setIsSimulatingDrive] = useState(false);
    const [showDelayPicker, setShowDelayPicker] = useState(false);
    const [delayReported, setDelayReported] = useState<string | null>(null);
    const [showCorridorSheet, setShowCorridorSheet] = useState(false);
    const [showRouteSetupModal, setShowRouteSetupModal] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [liveGpsCoords, setLiveGpsCoords] = useState<[number, number] | null>(
        null,
    );
    const [customRouteCoordinates, setCustomRouteCoordinates] = useState<
        [number, number][] | undefined
    >(undefined);

    const locationAdapter = useMemo(() => new NativeLocationAdapter(), []);

    // 1. Resolve Available Project Destinations
    const availableDestinations = useMemo<LocationPreset[]>(() => {
        const presets: LocationPreset[] = [...PROJECT_SITE_PRESETS];

        if (jobs && jobs.length > 0) {
            jobs.forEach((j) => {
                if (j.site && !presets.some((p) => p.label.includes(j.site))) {
                    presets.unshift({
                        id: `job-${j.id}`,
                        label: `${j.site} (Project ${j.reference})`,
                        description: `Client: ${j.client} · Assigned Site`,
                        coords: [
                            j.site_longitude || 121.05,
                            j.site_latitude || 13.7565,
                        ],
                        type: 'destination',
                    });
                }
            });
        }

        return presets;
    }, [jobs]);

    // Active Starting Location (FROM) and Designated Destination (TO)
    const [selectedOriginId, setSelectedOriginId] =
        useState<string>('current_gps');
    const [selectedDestinationId, setSelectedDestinationId] = useState<string>(
        () => {
            if (activeJob?.id) {
                return `job-${activeJob.id}`;
            }

            return 'batangas_power';
        },
    );

    // Active Origin Object
    const activeOrigin = useMemo<LocationPreset>(() => {
        if (selectedOriginId === 'current_gps' && liveGpsCoords) {
            return {
                id: 'current_gps',
                label: 'Current Location (GPS)',
                description: `${liveGpsCoords[1].toFixed(4)}°N, ${liveGpsCoords[0].toFixed(4)}°E (Live Fix)`,
                coords: liveGpsCoords,
                type: 'origin',
            };
        }

        const found = FLEET_ORIGIN_PRESETS.find(
            (p) => p.id === selectedOriginId,
        );

        return found || FLEET_ORIGIN_PRESETS[0];
    }, [selectedOriginId, liveGpsCoords]);

    // Active Destination Object
    const activeDestination = useMemo<LocationPreset>(() => {
        const found = availableDestinations.find(
            (p) => p.id === selectedDestinationId,
        );

        if (found) {
            return found;
        }

        if (activeJob?.site) {
            return {
                id: `job-${activeJob.id}`,
                label: activeJob.site,
                description: `Project Ref: ${activeJob.reference} · Client: ${activeJob.client}`,
                coords: [
                    activeJob.site_longitude || 121.05,
                    activeJob.site_latitude || 13.7565,
                ],
                type: 'destination',
            };
        }

        return availableDestinations[0] || PROJECT_SITE_PRESETS[0];
    }, [availableDestinations, selectedDestinationId, activeJob]);

    // Heavy Equipment Safety & Clearance Assessment
    const clearanceAssessment = useMemo<HeavyClearanceCheckResult>(() => {
        return evaluateHeavyEquipmentClearance(activeDestination.coords, 4.0);
    }, [activeDestination]);

    // 2. Hardware GPS Detection on Mount
    useEffect(() => {
        let isMounted = true;

        async function initLocation() {
            try {
                const perms = await locationAdapter.checkPermissions();

                if (perms.foregroundGranted) {
                    const loc = await locationAdapter.getCurrentLocation(false);

                    if (isMounted && loc) {
                        setLiveGpsCoords([loc.longitude, loc.latitude]);
                    }
                }
            } catch {
                // Graceful fallback for non-native / test environments
            }
        }

        initLocation();

        return () => {
            isMounted = false;
        };
    }, [locationAdapter]);

    // 3. Fetch Real Road Network Geometry via OSRM between Selected Origin & Destination
    useEffect(() => {
        let isMounted = true;

        async function loadRealRoadRoute() {
            try {
                const result = await fetchRealRoadRoute(
                    activeOrigin.coords,
                    activeDestination.coords,
                );

                if (isMounted && result && result.coordinates.length > 0) {
                    setCustomRouteCoordinates(result.coordinates);
                }
            } catch {
                // Graceful fallback to corridor waypoints
            }
        }

        loadRealRoadRoute();

        return () => {
            isMounted = false;
        };
    }, [activeOrigin.coords, activeDestination.coords]);

    // 4. Active Simulation Drive: Animates vehicle movement along the expressway
    useEffect(() => {
        if (!isSimulatingDrive) {
            return;
        }

        const interval = setInterval(() => {
            setSimTrackIndex((prev) => {
                const next = prev + 1;

                if (next < LIVE_NAVIGATION_TRACK.length) {
                    setCurrentStepIndex(LIVE_NAVIGATION_TRACK[next].stepIndex);

                    return next;
                }

                setIsSimulatingDrive(false);

                return prev;
            });
        }, 2500);

        return () => clearInterval(interval);
    }, [isSimulatingDrive]);

    const activeTrackPoint = isSimulatingDrive
        ? LIVE_NAVIGATION_TRACK[simTrackIndex]
        : null;

    const currentTurn =
        FALLBACK_TURN_STEPS[currentStepIndex] || FALLBACK_TURN_STEPS[0];
    const displayDistanceNext =
        activeTrackPoint?.distanceNext || currentTurn.distanceNext;
    const displayEta =
        activeTrackPoint?.remainingEta || currentTurn.remainingEta;
    const displayRemainingDistance =
        activeTrackPoint?.remainingDistance || currentTurn.remainingDistance;
    const displaySpeed = activeTrackPoint?.speed ?? 42;
    const displayRoadName = activeTrackPoint?.roadName || currentTurn.roadName;

    const currentVehicleCoords =
        activeTrackPoint?.coords || liveGpsCoords || currentTurn.coords;
    const currentVehicleBearing = activeTrackPoint?.bearing ?? 160;

    const jobReference = activeJob?.reference || 'DISP-2026-0891';
    const destination =
        activeDestination.label ||
        activeJob?.site ||
        'Batangas Power Plant Expansion';
    const siteEntrance = 'Gate 3 (South Heavy Haul Access)';
    const stagingPoint = 'Bay 4 — Heavy Rigging Marshalling';

    const assetLabel = useMemo(() => {
        const assigned = activeJob?.asset_assignments?.[0];

        if (assigned) {
            return `${assigned.asset_code} · ${assigned.asset_name}`;
        }

        return `${assetCode} · ${assetName}`;
    }, [activeJob, assetCode, assetName]);

    const handleConfirmDelay = (reason: string) => {
        setDelayReported(reason);
        setShowDelayPicker(false);
        onReportDelay?.(reason);
    };

    const handleConfirmArrival = () => {
        if (activeJob && onArrived) {
            onArrived(activeJob.id, activeJob.version);
        } else {
            onBack?.();
        }
    };

    const handleNextTurn = () => {
        if (currentStepIndex < FALLBACK_TURN_STEPS.length - 1) {
            const next = currentStepIndex + 1;

            setCurrentStepIndex(next);
            setSimTrackIndex(
                LIVE_NAVIGATION_TRACK.findIndex((p) => p.stepIndex === next) ||
                    0,
            );
        }
    };

    const handlePrevTurn = () => {
        if (currentStepIndex > 0) {
            const prev = currentStepIndex - 1;

            setCurrentStepIndex(prev);
            setSimTrackIndex(
                LIVE_NAVIGATION_TRACK.findIndex((p) => p.stepIndex === prev) ||
                    0,
            );
        }
    };

    const handleToggleSimulation = () => {
        if (!isSimulatingDrive) {
            if (simTrackIndex >= LIVE_NAVIGATION_TRACK.length - 1) {
                setSimTrackIndex(0);
                setCurrentStepIndex(0);
            }

            setIsSimulatingDrive(true);
        } else {
            setIsSimulatingDrive(false);
        }
    };

    return (
        <View
            style={[styles.screenRoot, isDarkHud && styles.darkScreenRoot]}
            testID="heavy-crane-drive-mode-screen"
        >
            {/* 1. Full-Screen 3D Interactive Map Canvas (80%+ Open Viewport) */}
            <View style={styles.mapCanvasWrap} testID="drive-mode-map-section">
                <MapLibreWebContainer
                    apiKey={stadiaApiKey}
                    currentRoadName={displayRoadName}
                    customRouteCoordinates={customRouteCoordinates}
                    destinationCoords={activeDestination.coords}
                    destinationLabel={destination}
                    followVehicle={true}
                    originCoords={activeOrigin.coords}
                    originLabel={activeOrigin.label}
                    style={styles.fullscreenMap}
                    styleVariant="dark"
                    vehicleBearing={currentVehicleBearing}
                    vehicleCoords={currentVehicleCoords}
                    waypoints={[
                        {
                            id: 'wp-1',
                            label: 'SLEX Alabang Corridor',
                            latitude: 14.412,
                            longitude: 121.042,
                            isPassed: currentStepIndex > 0,
                        },
                        {
                            id: 'wp-2',
                            label: 'SLEX Calamba Interchange',
                            latitude: 14.205,
                            longitude: 121.135,
                            isPassed: currentStepIndex > 0,
                        },
                        {
                            id: 'wp-3',
                            label: 'STAR Tollway Lipa (Old Mill Overpass)',
                            latitude: 13.945,
                            longitude: 121.168,
                            hazardNote:
                                'Bridge 4.1m clearance — DO NOT ENTER Old Mill Road',
                            isPassed: currentStepIndex > 1,
                        },
                        {
                            id: 'wp-4',
                            label: 'STAR Tollway Batangas Industrial Gate 2',
                            latitude: 13.805,
                            longitude: 121.085,
                            isPassed: currentStepIndex > 2,
                        },
                    ]}
                />
            </View>

            {/* 2. Streamlined Top Navigation Maneuver Header (#1A73E8) */}
            <View style={styles.topHudContainer} testID="drive-mode-top-banner">
                {/* Meta Control Bar: High-contrast touch targets, non-colliding layout */}
                <View style={styles.topMetaBar}>
                    <Pressable
                        accessibilityLabel="Exit drive mode and return to dashboard"
                        accessibilityRole="button"
                        onPress={onBack}
                        style={styles.exitTouchBtn}
                        testID="drive-mode-back-btn"
                    >
                        <Icon color="#FFFFFF" name="close" size={16} />
                        <Text style={styles.exitBtnText}>Exit</Text>
                    </Pressable>

                    <View style={styles.metaTitleGroup}>
                        <Text
                            accessibilityRole="header"
                            numberOfLines={1}
                            style={styles.screenTitle}
                        >
                            Heavy Crane Drive Mode
                        </Text>
                        <Text
                            numberOfLines={1}
                            style={styles.categoryBadgeText}
                        >
                            HEAVY TRANSIT · CORRIDOR NAVIGATION
                        </Text>
                    </View>

                    <View style={styles.metaStatusGroup}>
                        <Pressable
                            accessibilityLabel={
                                isSimulatingDrive
                                    ? 'Pause drive simulation'
                                    : 'Start turn by turn drive simulation'
                            }
                            accessibilityRole="button"
                            onPress={handleToggleSimulation}
                            style={[
                                styles.simBtn,
                                isSimulatingDrive && styles.simBtnActive,
                            ]}
                            testID="toggle-nav-sim-btn"
                        >
                            <Icon
                                color={
                                    isSimulatingDrive ? '#34D399' : '#FFFFFF'
                                }
                                name={isSimulatingDrive ? 'check' : 'flash'}
                                size={13}
                            />
                            <Text
                                style={[
                                    styles.simBtnText,
                                    isSimulatingDrive &&
                                        styles.simBtnTextActive,
                                ]}
                            >
                                {isSimulatingDrive ? 'SIM' : 'DEMO'}
                            </Text>
                        </Pressable>

                        <View style={styles.livePill}>
                            <View style={styles.livePillDot} />
                            <Text style={styles.liveBadgeText}>LIVE</Text>
                        </View>
                    </View>
                </View>

                {/* Main Maneuver Area: Glanceable Distance, Bold Arrow, Road Name */}
                <View style={styles.maneuverBody}>
                    <View
                        style={[
                            styles.maneuverArrowBox,
                            currentTurn.isHazard && styles.hazardArrowBox,
                        ]}
                    >
                        <Text style={styles.maneuverArrowGlyph}>
                            {currentTurn.maneuverArrow}
                        </Text>
                    </View>

                    <View style={styles.maneuverDetailsCol}>
                        <View style={styles.distanceNextRow}>
                            <Text style={styles.distanceNextVal}>
                                {displayDistanceNext}
                            </Text>
                            <View style={styles.turnStepperBadge}>
                                <Text style={styles.turnStepperBadgeText}>
                                    TURN {currentStepIndex + 1} OF{' '}
                                    {FALLBACK_TURN_STEPS.length}
                                </Text>
                            </View>
                        </View>

                        <Text numberOfLines={2} style={styles.roadNameHeader}>
                            {displayRoadName}
                        </Text>

                        <Text
                            numberOfLines={1}
                            style={styles.maneuverInstructionText}
                        >
                            {currentTurn.instruction}
                        </Text>
                    </View>

                    {/* Step Navigation Controls (Large 48x48dp crane cab touch targets) */}
                    <View style={styles.turnControlsCol}>
                        <Pressable
                            accessibilityLabel="Advance to next turn maneuver"
                            accessibilityRole="button"
                            disabled={
                                currentStepIndex >=
                                FALLBACK_TURN_STEPS.length - 1
                            }
                            onPress={handleNextTurn}
                            style={({ pressed }) => [
                                styles.turnStepTouchBtn,
                                currentStepIndex >=
                                    FALLBACK_TURN_STEPS.length - 1 &&
                                    styles.turnStepBtnDisabled,
                                pressed && styles.pressed,
                            ]}
                            testID="turn-next-btn"
                        >
                            <Icon
                                color={
                                    currentStepIndex >=
                                    FALLBACK_TURN_STEPS.length - 1
                                        ? '#93C5FD'
                                        : '#FFFFFF'
                                }
                                name="chevron-down"
                                size={20}
                            />
                        </Pressable>

                        <Pressable
                            accessibilityLabel="Previous turn maneuver"
                            accessibilityRole="button"
                            disabled={currentStepIndex === 0}
                            onPress={handlePrevTurn}
                            style={({ pressed }) => [
                                styles.turnStepTouchBtn,
                                currentStepIndex === 0 &&
                                    styles.turnStepBtnDisabled,
                                pressed && styles.pressed,
                            ]}
                            testID="turn-prev-btn"
                        >
                            <Icon
                                color={
                                    currentStepIndex === 0
                                        ? '#93C5FD'
                                        : '#FFFFFF'
                                }
                                name="chevron-up"
                                size={20}
                            />
                        </Pressable>
                    </View>
                </View>

                {/* Minimalist In-Cab Lane Guidance Arrows */}
                <View style={styles.laneGuidanceRow} testID="lane-guidance-bar">
                    <View
                        style={[
                            styles.lanePill,
                            currentTurn.activeLaneIndex === 0 &&
                                styles.lanePillActive,
                        ]}
                    >
                        <Text
                            style={[
                                styles.lanePillText,
                                currentTurn.activeLaneIndex === 0 &&
                                    styles.lanePillTextActive,
                            ]}
                        >
                            ↰ LANE 1
                        </Text>
                    </View>
                    <View
                        style={[
                            styles.lanePill,
                            currentTurn.activeLaneIndex === 1 &&
                                styles.lanePillActive,
                        ]}
                    >
                        <Text
                            style={[
                                styles.lanePillText,
                                currentTurn.activeLaneIndex === 1 &&
                                    styles.lanePillTextActive,
                            ]}
                        >
                            ↑ CENTER
                        </Text>
                    </View>
                    <View
                        style={[
                            styles.lanePill,
                            styles.wideLanePill,
                            currentTurn.activeLaneIndex === 2 &&
                                styles.lanePillActive,
                        ]}
                    >
                        <Text
                            style={[
                                styles.lanePillText,
                                currentTurn.activeLaneIndex === 2 &&
                                    styles.lanePillTextActive,
                            ]}
                        >
                            WIDE ESCORT
                        </Text>
                    </View>
                </View>

                {/* Critical Persistent Overhead Clearance Warning (NEVER TRUNCATED) */}
                <View style={styles.hazardAlertStrip}>
                    <Icon color="#FDE047" name="alert" size={15} />
                    <Text style={styles.hazardAlertText}>
                        CAUTION: Bridge clearance only 4.1m — DO NOT ENTER Old
                        Mill Road.
                    </Text>
                </View>

                {/* Compact Voice Guidance Strip */}
                {!isMuted ? (
                    <View
                        style={styles.voiceGuidanceStrip}
                        testID="voice-guidance-banner"
                    >
                        <Icon color="#93C5FD" name="bell" size={12} />
                        <Text
                            numberOfLines={1}
                            style={styles.voiceGuidanceText}
                        >
                            {currentTurn.voiceAnnouncement}
                        </Text>
                    </View>
                ) : null}
            </View>

            {/* 3. Floating In-Cab Telemetry Badges (Above Bottom Dock) */}
            <View
                pointerEvents="box-none"
                style={styles.floatingControlsOverlay}
            >
                {/* Unified Speedometer & Speed Limit Sign (Google Maps style) */}
                <View style={styles.inDashSpeedGauge}>
                    <View style={styles.speedSection}>
                        <Text style={styles.speedVal}>{displaySpeed}</Text>
                        <Text style={styles.speedUnit}>km/h</Text>
                    </View>
                    <View style={styles.speedDivider} />
                    <View style={styles.speedLimitSign}>
                        <Text style={styles.speedLimitVal}>
                            {currentTurn.speedLimit}
                        </Text>
                    </View>
                </View>

                {/* Floating Quick Action Cluster on Right (Large 50x50dp In-Vehicle HMI Targets) */}
                <View style={styles.rightActionCol}>
                    <View style={styles.compassBtn}>
                        <Icon color="#EF4444" name="compass" size={16} />
                        <Text style={styles.compassText}>N</Text>
                    </View>

                    <Pressable
                        accessibilityLabel="Report Route Delay / Obstruction"
                        accessibilityRole="button"
                        onPress={() => setShowDelayPicker(true)}
                        style={({ pressed }) => [
                            styles.floatingRoundBtn,
                            styles.hazardBtn,
                            pressed && styles.pressed,
                        ]}
                        testID="report-delay-trigger-btn"
                    >
                        <Icon color="#F59E0B" name="alert" size={22} />
                    </Pressable>

                    <Pressable
                        accessibilityLabel={
                            isMuted ? 'Unmute voice' : 'Mute voice guidance'
                        }
                        accessibilityRole="button"
                        onPress={() => setIsMuted(!isMuted)}
                        style={({ pressed }) => [
                            styles.floatingRoundBtn,
                            pressed && styles.pressed,
                        ]}
                    >
                        <Icon
                            color={isMuted ? '#EF4444' : '#F8FAFC'}
                            name="bell"
                            size={20}
                        />
                    </Pressable>

                    <Pressable
                        accessibilityLabel="Re-center GPS map"
                        accessibilityRole="button"
                        onPress={() => {
                            setLiveGpsCoords(currentVehicleCoords);
                        }}
                        style={({ pressed }) => [
                            styles.floatingRoundBtn,
                            pressed && styles.pressed,
                        ]}
                    >
                        <Icon color="#38BDF8" name="location" size={20} />
                    </Pressable>
                </View>
            </View>

            {/* 4. Active Reported Delay Notification Banner */}
            {delayReported ? (
                <View style={styles.floatingReportedDelayCard}>
                    <Icon color="#F59E0B" name="check-circle" size={16} />
                    <View style={styles.reportedDelayTextCol}>
                        <Text style={styles.reportedDelayTitle}>
                            ✓ Delay reported to Dispatch:
                        </Text>
                        <Text style={styles.reportedDelayText}>
                            {delayReported}
                        </Text>
                    </View>
                    <Pressable
                        accessibilityLabel="Dismiss delay alert"
                        onPress={() => setDelayReported(null)}
                        style={styles.dismissDelayBtn}
                    >
                        <Icon color="#94A3B8" name="close" size={14} />
                    </Pressable>
                </View>
            ) : null}

            {/* 5. Streamlined In-Cab Navigation Bottom Dock Card */}
            <View style={styles.bottomDockCard}>
                {/* Trip ETA & Distance Glance (Glanceable in under 1 second) */}
                <View style={styles.dockHeaderRow}>
                    <View style={styles.dockEtaWrap}>
                        <View style={styles.etaRow}>
                            <Text style={styles.etaValue}>{displayEta}</Text>
                            <Text style={styles.metricCaption}>
                                ESTIMATED ARRIVAL
                            </Text>
                        </View>
                        <View style={styles.distanceSubRow}>
                            <Text style={styles.distanceValue}>
                                {displayRemainingDistance}
                            </Text>
                            <Text style={styles.arrivalClockText}>
                                · 8:33 PM ETA
                            </Text>
                            <Text style={styles.distanceCaption}>
                                DISTANCE REMAINING
                            </Text>
                        </View>
                    </View>

                    <Pressable
                        accessibilityLabel="Toggle turn-by-turn route corridor details"
                        accessibilityRole="button"
                        onPress={() => setShowCorridorSheet(!showCorridorSheet)}
                        style={({ pressed }) => [
                            styles.stepsToggleBtn,
                            showCorridorSheet && styles.stepsToggleBtnActive,
                            pressed && styles.pressed,
                        ]}
                        testID="toggle-corridor-steps-btn"
                    >
                        <Icon
                            color={showCorridorSheet ? '#FFFFFF' : '#38BDF8'}
                            name={showCorridorSheet ? 'chevron-down' : 'list'}
                            size={16}
                        />
                        <Text
                            style={[
                                styles.stepsToggleBtnText,
                                showCorridorSheet &&
                                    styles.stepsToggleBtnTextActive,
                            ]}
                        >
                            {showCorridorSheet
                                ? 'Hide Steps'
                                : 'Corridor Steps'}
                        </Text>
                    </Pressable>
                </View>

                {/* Target Site Gate, Heavy Crane Specs, and Route Config Button */}
                <View style={styles.dockDestinationRow}>
                    <View style={styles.destPinIcon}>
                        <Icon color="#10B981" name="pin" size={16} />
                    </View>
                    <View style={styles.destTextCol}>
                        <Text numberOfLines={1} style={styles.dockDestTitle}>
                            {destination}
                        </Text>
                        <Text numberOfLines={1} style={styles.dockGateBadge}>
                            {siteEntrance}
                        </Text>
                        <Text numberOfLines={1} style={styles.dockAssetBadge}>
                            {assetLabel}
                        </Text>
                    </View>

                    <Pressable
                        accessibilityLabel="Open Heavy Equipment Route Configurator"
                        accessibilityRole="button"
                        onPress={() => setShowRouteSetupModal(true)}
                        style={({ pressed }) => [
                            styles.routeConfigInlineBtn,
                            pressed && styles.pressed,
                        ]}
                        testID="open-route-config-btn"
                    >
                        <Icon color="#38BDF8" name="settings" size={14} />
                        <Text style={styles.routeConfigInlineBtnText}>
                            Route
                        </Text>
                    </Pressable>
                </View>

                {/* Primary Action: Confirm Arrival at Site (High-Visibility 54dp Target) */}
                <Pressable
                    accessibilityLabel="Confirm arrival at destination site"
                    accessibilityRole="button"
                    onPress={handleConfirmArrival}
                    style={({ pressed }) => [
                        styles.arrivedBtn,
                        currentStepIndex === FALLBACK_TURN_STEPS.length - 1 &&
                            styles.finalArrivedBtn,
                        pressed && styles.pressed,
                    ]}
                    testID="drive-mode-arrived-btn"
                >
                    <Icon color="#FFFFFF" name="check-circle" size={20} />
                    <Text style={styles.arrivedBtnText}>
                        ✓ I HAVE ARRIVED AT SITE
                    </Text>
                </Pressable>
            </View>

            {/* 6. Heavy Equipment From ➔ To Corridor Route Setup Modal */}
            <Modal
                animationType="slide"
                onRequestClose={() => setShowRouteSetupModal(false)}
                transparent={true}
                visible={showRouteSetupModal}
            >
                <View style={styles.modalBackdrop}>
                    <View
                        style={styles.routeConfigModal}
                        testID="route-config-modal"
                    >
                        <View style={styles.modalHeaderRow}>
                            <View style={styles.modalTitleRow}>
                                <Icon color="#38BDF8" name="route" size={20} />
                                <Text style={styles.delayPickerModalTitle}>
                                    Heavy Transit Route Setup
                                </Text>
                            </View>
                            <Pressable
                                accessibilityLabel="Close route setup"
                                accessibilityRole="button"
                                onPress={() => setShowRouteSetupModal(false)}
                                style={styles.closeModalBtn}
                            >
                                <Icon color="#94A3B8" name="close" size={20} />
                            </Pressable>
                        </View>

                        <Text style={styles.delayPickerSubtitle}>
                            Configure origin, project site destination, and
                            clearance verification:
                        </Text>

                        {/* Starting Location (FROM) */}
                        <Text style={styles.sectionHeaderLabel}>
                            FROM · STARTING LOCATION
                        </Text>
                        <View style={styles.presetOptionsGrid}>
                            {FLEET_ORIGIN_PRESETS.map((origin) => {
                                const isSelected =
                                    selectedOriginId === origin.id;

                                return (
                                    <Pressable
                                        key={origin.id}
                                        accessibilityLabel={`Select starting location: ${origin.label}`}
                                        accessibilityRole="button"
                                        onPress={() =>
                                            setSelectedOriginId(origin.id)
                                        }
                                        style={[
                                            styles.locationOptionCard,
                                            isSelected &&
                                                styles.locationOptionCardSelected,
                                        ]}
                                        testID={`origin-option-${origin.id}`}
                                    >
                                        <Text
                                            style={[
                                                styles.locationOptionLabel,
                                                isSelected &&
                                                    styles.locationOptionLabelSelected,
                                            ]}
                                        >
                                            {origin.label}
                                        </Text>
                                        <Text
                                            style={
                                                styles.locationOptionDescription
                                            }
                                        >
                                            {origin.description}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        {/* Designated Project Destination (TO) */}
                        <Text
                            style={[
                                styles.sectionHeaderLabel,
                                styles.sectionMarginTop,
                            ]}
                        >
                            TO · DESIGNATED PROJECT SITE
                        </Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.destScroll}
                        >
                            {availableDestinations.map((dest) => {
                                const isSelected =
                                    selectedDestinationId === dest.id;

                                return (
                                    <Pressable
                                        key={dest.id}
                                        accessibilityLabel={`Select destination: ${dest.label}`}
                                        accessibilityRole="button"
                                        onPress={() =>
                                            setSelectedDestinationId(dest.id)
                                        }
                                        style={[
                                            styles.destOptionCard,
                                            isSelected &&
                                                styles.locationOptionCardSelected,
                                        ]}
                                        testID={`dest-option-${dest.id}`}
                                    >
                                        <Text
                                            numberOfLines={1}
                                            style={[
                                                styles.locationOptionLabel,
                                                isSelected &&
                                                    styles.locationOptionLabelSelected,
                                            ]}
                                        >
                                            {dest.label}
                                        </Text>
                                        <Text
                                            numberOfLines={1}
                                            style={
                                                styles.locationOptionDescription
                                            }
                                        >
                                            {dest.description}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>

                        {/* Heavy Clearance & Escort Assessment Badge */}
                        <View style={styles.clearanceCard}>
                            <View style={styles.clearanceCardRow}>
                                <Icon
                                    color={
                                        clearanceAssessment.passed
                                            ? '#10B981'
                                            : '#F59E0B'
                                    }
                                    name="shield-check"
                                    size={18}
                                />
                                <Text style={styles.clearanceRatingText}>
                                    {clearanceAssessment.clearanceRating}
                                </Text>
                            </View>
                            <Text style={styles.clearanceDetailsText}>
                                Min Overhead Clearance:{' '}
                                {clearanceAssessment.clearanceHeightMetres}m ·
                                Escort Vehicle:{' '}
                                {clearanceAssessment.escortRequired
                                    ? 'REQUIRED'
                                    : 'STANDARD'}
                            </Text>
                            {clearanceAssessment.warningNote ? (
                                <Text style={styles.clearanceWarningText}>
                                    {clearanceAssessment.warningNote}
                                </Text>
                            ) : null}
                        </View>

                        {/* Apply Button */}
                        <Pressable
                            accessibilityLabel="Apply route and calculate transit corridor"
                            accessibilityRole="button"
                            onPress={() => {
                                setShowRouteSetupModal(false);
                                setCurrentStepIndex(0);
                                setSimTrackIndex(0);
                            }}
                            style={({ pressed }) => [
                                styles.applyRouteBtn,
                                pressed && styles.pressed,
                            ]}
                            testID="apply-route-btn"
                        >
                            <Icon color="#FFFFFF" name="check" size={16} />
                            <Text style={styles.applyRouteBtnText}>
                                Apply & Calculate Heavy Corridor
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>

            {/* 7. Expandable Route Corridor Sheet */}
            {showCorridorSheet ? (
                <View style={styles.corridorSheetModal}>
                    <View style={styles.corridorSheetHeader}>
                        <View style={styles.sheetHandle} />
                        <View style={styles.sheetTitleRow}>
                            <View>
                                <Text style={styles.corridorSheetTitle}>
                                    HEAVY VEHICLE CORRIDOR INSTRUCTIONS
                                </Text>
                                <Text style={styles.corridorSheetSubtitle}>
                                    {jobReference} · Operator: {operatorName} ·
                                    Staging: {stagingPoint}
                                </Text>
                            </View>
                            <Pressable
                                accessibilityLabel="Close corridor steps"
                                accessibilityRole="button"
                                onPress={() => setShowCorridorSheet(false)}
                                style={styles.closeSheetBtn}
                            >
                                <Icon color="#94A3B8" name="close" size={20} />
                            </Pressable>
                        </View>
                    </View>

                    <ScrollView
                        accessibilityLabel="Turn by turn route steps"
                        contentContainerStyle={styles.corridorSheetScroll}
                        style={styles.corridorSheetScrollView}
                    >
                        {DEFAULT_INSTRUCTIONS.map((step, idx) => (
                            <Pressable
                                key={step.id}
                                accessibilityLabel={`Select Step ${step.stepNumber}: ${step.instruction}`}
                                accessibilityRole="button"
                                onPress={() => {
                                    setCurrentStepIndex(idx);
                                    setShowCorridorSheet(false);
                                }}
                                style={[
                                    styles.stepCard,
                                    step.isHazard && styles.stepCardHazard,
                                    currentStepIndex === idx &&
                                        styles.stepCardSelected,
                                ]}
                                testID={`drive-instruction-${step.stepNumber}`}
                            >
                                <View style={styles.stepHeaderRow}>
                                    <View
                                        style={[
                                            styles.stepNumberBadge,
                                            step.isHazard &&
                                                styles.stepNumberHazardBadge,
                                            currentStepIndex === idx &&
                                                styles.stepNumberSelectedBadge,
                                        ]}
                                    >
                                        <Text style={styles.stepNumberText}>
                                            {step.stepNumber}
                                        </Text>
                                    </View>
                                    <Text style={styles.stepDistanceText}>
                                        {step.distanceLabel}
                                    </Text>
                                </View>

                                <Text style={styles.stepInstructionText}>
                                    {step.instruction}
                                </Text>

                                {step.caution ? (
                                    <View
                                        style={[
                                            styles.cautionBox,
                                            step.isHazard &&
                                                styles.hazardCautionBox,
                                        ]}
                                    >
                                        <Text style={styles.cautionTag}>
                                            {step.isHazard
                                                ? 'HAZARD'
                                                : 'CAUTION'}
                                        </Text>
                                        <Text style={styles.cautionDescription}>
                                            {step.caution}
                                        </Text>
                                    </View>
                                ) : null}
                            </Pressable>
                        ))}
                    </ScrollView>
                </View>
            ) : null}

            {/* 8. Delay Reporting Modal */}
            <Modal
                animationType="slide"
                onRequestClose={() => setShowDelayPicker(false)}
                transparent={true}
                visible={showDelayPicker}
            >
                <View style={styles.modalBackdrop}>
                    <View style={styles.delayPickerModal}>
                        <View style={styles.modalHeaderRow}>
                            <View style={styles.modalTitleRow}>
                                <Icon color="#F59E0B" name="alert" size={20} />
                                <Text style={styles.delayPickerModalTitle}>
                                    Report Route Delay / Obstruction
                                </Text>
                            </View>
                            <Pressable
                                accessibilityLabel="Cancel delay report"
                                accessibilityRole="button"
                                onPress={() => setShowDelayPicker(false)}
                                style={styles.closeModalBtn}
                            >
                                <Icon color="#94A3B8" name="close" size={20} />
                            </Pressable>
                        </View>

                        <Text style={styles.delayPickerSubtitle}>
                            Notifies dispatcher and adjusts heavy escort
                            corridor ETA:
                        </Text>

                        {DELAY_REASONS.map((reason) => (
                            <Pressable
                                key={reason}
                                accessibilityLabel={`Report: ${reason}`}
                                accessibilityRole="button"
                                onPress={() => handleConfirmDelay(reason)}
                                style={({ pressed }) => [
                                    styles.delayOptionCard,
                                    pressed && styles.pressed,
                                ]}
                            >
                                <Text style={styles.delayOptionTitle}>
                                    {reason}
                                </Text>
                                <Icon
                                    color="#38BDF8"
                                    name="chevron-right"
                                    size={18}
                                />
                            </Pressable>
                        ))}
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    screenRoot: {
        backgroundColor: '#0B1120',
        flex: 1,
        position: 'relative',
    },
    darkScreenRoot: {
        backgroundColor: '#0B1120',
    },
    mapCanvasWrap: {
        bottom: 0,
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0,
    },
    fullscreenMap: {
        flex: 1,
        height: '100%',
        width: '100%',
    },
    topHudContainer: {
        backgroundColor: '#1A73E8',
        borderRadius: 18,
        left: 10,
        overflow: 'hidden',
        position: 'absolute',
        right: 10,
        top: 10,
        zIndex: 10,
        ...shadows.lg,
    },
    topMetaBar: {
        alignItems: 'center',
        backgroundColor: '#1558B0',
        borderBottomColor: 'rgba(255, 255, 255, 0.15)',
        borderBottomWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    exitTouchBtn: {
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.25)',
        borderRadius: 14,
        flexDirection: 'row',
        flexShrink: 0,
        gap: 4,
        minHeight: 48,
        minWidth: 48,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    exitBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800',
    },
    metaTitleGroup: {
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 6,
    },
    screenTitle: {
        color: '#FFFFFF',
        fontSize: 11.5,
        fontWeight: '800',
        textAlign: 'center',
    },
    categoryBadgeText: {
        color: '#FDE047',
        fontSize: 7.5,
        fontWeight: '800',
        letterSpacing: 0.3,
        textAlign: 'center',
    },
    metaStatusGroup: {
        alignItems: 'center',
        flexDirection: 'row',
        flexShrink: 0,
        gap: 6,
    },
    simBtn: {
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.25)',
        borderRadius: 10,
        flexDirection: 'row',
        gap: 4,
        minHeight: 40,
        minWidth: 48,
        paddingHorizontal: 8,
        paddingVertical: 6,
    },
    simBtnActive: {
        backgroundColor: '#064E3B',
    },
    simBtnText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '800',
    },
    simBtnTextActive: {
        color: '#34D399',
    },
    livePill: {
        alignItems: 'center',
        backgroundColor: '#064E3B',
        borderRadius: 8,
        flexDirection: 'row',
        gap: 4,
        paddingHorizontal: 6,
        paddingVertical: 4,
    },
    livePillDot: {
        backgroundColor: '#10B981',
        borderRadius: 3,
        height: 6,
        width: 6,
    },
    liveBadgeText: {
        color: '#34D399',
        fontSize: 9,
        fontWeight: '800',
    },
    maneuverBody: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    maneuverArrowBox: {
        alignItems: 'center',
        backgroundColor: '#1558B0',
        borderRadius: 14,
        height: 54,
        justifyContent: 'center',
        width: 54,
        ...shadows.md,
    },
    hazardArrowBox: {
        backgroundColor: '#DC2626',
    },
    maneuverArrowGlyph: {
        color: '#FFFFFF',
        fontSize: 34,
        fontWeight: '900',
        lineHeight: 36,
        textAlign: 'center',
    },
    maneuverDetailsCol: {
        flex: 1,
        gap: 2,
    },
    distanceNextRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    distanceNextVal: {
        color: '#FFFFFF',
        fontSize: 28,
        fontWeight: '900',
        letterSpacing: -0.5,
    },
    turnStepperBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    turnStepperBadgeText: {
        color: '#FFFFFF',
        fontSize: 9,
        fontWeight: '800',
    },
    roadNameHeader: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '800',
        lineHeight: 21,
    },
    maneuverInstructionText: {
        color: '#E0F2FE',
        fontSize: 11.5,
        fontWeight: '600',
    },
    turnControlsCol: {
        gap: 6,
    },
    turnStepTouchBtn: {
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 10,
        height: 48,
        justifyContent: 'center',
        width: 48,
    },
    turnStepBtnDisabled: {
        opacity: 0.3,
    },
    laneGuidanceRow: {
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 12,
        paddingBottom: 6,
    },
    lanePill: {
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 6,
        justifyContent: 'center',
        minHeight: 32,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    wideLanePill: {
        backgroundColor: 'rgba(253, 224, 71, 0.2)',
    },
    lanePillActive: {
        backgroundColor: '#FFFFFF',
    },
    lanePillText: {
        color: '#BFDBFE',
        fontSize: 10,
        fontWeight: '800',
    },
    lanePillTextActive: {
        color: '#1A73E8',
    },
    hazardAlertStrip: {
        alignItems: 'center',
        backgroundColor: '#DC2626',
        borderTopColor: '#B91C1C',
        borderTopWidth: 1,
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    hazardAlertText: {
        color: '#FFFFFF',
        flex: 1,
        fontSize: 11,
        fontWeight: '800',
        lineHeight: 15,
    },
    voiceGuidanceStrip: {
        alignItems: 'center',
        backgroundColor: '#1558B0',
        borderTopColor: 'rgba(255, 255, 255, 0.12)',
        borderTopWidth: 1,
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 4,
    },
    voiceGuidanceText: {
        color: '#FFFFFF',
        flex: 1,
        fontSize: 11,
        fontWeight: '600',
    },
    floatingControlsOverlay: {
        bottom: 175,
        flexDirection: 'row',
        justifyContent: 'space-between',
        left: 12,
        position: 'absolute',
        right: 12,
        zIndex: 5,
    },
    inDashSpeedGauge: {
        alignItems: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.94)',
        borderColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 16,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        ...shadows.md,
    },
    speedSection: {
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    speedVal: {
        color: '#F8FAFC',
        fontSize: 22,
        fontWeight: '900',
        lineHeight: 24,
    },
    speedUnit: {
        color: '#10B981',
        fontSize: 9,
        fontWeight: '800',
    },
    speedDivider: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        height: 26,
        width: 1,
    },
    speedLimitSign: {
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderColor: '#DC2626',
        borderRadius: 16,
        borderWidth: 2.5,
        height: 32,
        justifyContent: 'center',
        width: 32,
    },
    speedLimitVal: {
        color: '#000000',
        fontSize: 14,
        fontWeight: '900',
    },
    rightActionCol: {
        alignItems: 'center',
        gap: 10,
    },
    compassBtn: {
        alignItems: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        borderColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 16,
        borderWidth: 1,
        height: 48,
        justifyContent: 'center',
        width: 48,
        ...shadows.md,
    },
    compassText: {
        color: '#F8FAFC',
        fontSize: 10,
        fontWeight: '800',
    },
    floatingRoundBtn: {
        alignItems: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.94)',
        borderColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 25,
        borderWidth: 1,
        height: 50,
        justifyContent: 'center',
        width: 50,
        ...shadows.md,
    },
    hazardBtn: {
        backgroundColor: 'rgba(69, 26, 3, 0.96)',
        borderColor: '#F59E0B',
    },
    floatingReportedDelayCard: {
        alignItems: 'center',
        backgroundColor: '#451A03',
        borderColor: '#B45309',
        borderRadius: 12,
        borderWidth: 1,
        bottom: 185,
        flexDirection: 'row',
        gap: 8,
        left: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        position: 'absolute',
        right: 12,
        zIndex: 15,
        ...shadows.lg,
    },
    reportedDelayTextCol: {
        flex: 1,
    },
    reportedDelayTitle: {
        color: '#FDE68A',
        fontSize: 11,
        fontWeight: '800',
    },
    reportedDelayText: {
        color: '#FEF3C7',
        fontSize: 11,
    },
    dismissDelayBtn: {
        padding: 4,
    },
    bottomDockCard: {
        backgroundColor: 'rgba(15, 23, 42, 0.97)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 22,
        borderWidth: 1,
        bottom: 10,
        gap: 10,
        left: 10,
        padding: 14,
        position: 'absolute',
        right: 10,
        zIndex: 10,
        ...shadows.lg,
    },
    dockHeaderRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    dockEtaWrap: {
        flex: 1,
        gap: 2,
    },
    etaRow: {
        alignItems: 'baseline',
        flexDirection: 'row',
        gap: 6,
    },
    etaValue: {
        color: '#10B981',
        fontSize: 28,
        fontWeight: '900',
        letterSpacing: -0.5,
    },
    metricCaption: {
        color: '#94A3B8',
        fontSize: 8.5,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    distanceSubRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 4,
    },
    distanceValue: {
        color: '#F8FAFC',
        fontSize: 14,
        fontWeight: '800',
    },
    arrivalClockText: {
        color: '#94A3B8',
        fontSize: 12,
        fontWeight: '600',
    },
    distanceCaption: {
        color: '#64748B',
        fontSize: 7.5,
        fontWeight: '700',
        marginLeft: 4,
    },
    stepsToggleBtn: {
        alignItems: 'center',
        backgroundColor: '#1E293B',
        borderColor: '#38BDF8',
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 6,
        minHeight: 48,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    stepsToggleBtnActive: {
        backgroundColor: '#0284C7',
        borderColor: '#0284C7',
    },
    stepsToggleBtnText: {
        color: '#38BDF8',
        fontSize: 11.5,
        fontWeight: '800',
    },
    stepsToggleBtnTextActive: {
        color: '#FFFFFF',
    },
    dockDestinationRow: {
        alignItems: 'center',
        backgroundColor: '#1E293B',
        borderColor: '#334155',
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    destPinIcon: {
        alignItems: 'center',
        height: 20,
        justifyContent: 'center',
        width: 20,
    },
    destTextCol: {
        flex: 1,
    },
    dockDestTitle: {
        color: '#F8FAFC',
        fontSize: 13,
        fontWeight: '800',
    },
    dockGateBadge: {
        color: '#F59E0B',
        fontSize: 10.5,
        fontWeight: '700',
    },
    dockAssetBadge: {
        color: '#94A3B8',
        fontSize: 10,
        fontWeight: '500',
    },
    routeConfigInlineBtn: {
        alignItems: 'center',
        backgroundColor: '#0F172A',
        borderColor: '#0284C7',
        borderRadius: 8,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 4,
        minHeight: 40,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    routeConfigInlineBtnText: {
        color: '#38BDF8',
        fontSize: 10.5,
        fontWeight: '800',
    },
    arrivedBtn: {
        alignItems: 'center',
        backgroundColor: '#059669',
        borderRadius: 12,
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
        minHeight: 54,
        paddingVertical: 14,
        ...shadows.md,
    },
    finalArrivedBtn: {
        backgroundColor: '#10B981',
    },
    arrivedBtnText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    modalBackdrop: {
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        flex: 1,
        justifyContent: 'flex-end',
    },
    routeConfigModal: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        borderWidth: 1,
        gap: 8,
        maxHeight: '85%',
        padding: 16,
        paddingBottom: 28,
        width: '100%',
        ...shadows.lg,
    },
    modalHeaderRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    modalTitleRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    closeModalBtn: {
        minHeight: 48,
        minWidth: 48,
        padding: 8,
    },
    delayPickerModalTitle: {
        color: '#F8FAFC',
        fontSize: 16,
        fontWeight: '800',
    },
    delayPickerSubtitle: {
        color: '#94A3B8',
        fontSize: 12,
        marginBottom: 4,
    },
    sectionHeaderLabel: {
        color: '#38BDF8',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.5,
        marginTop: 4,
    },
    sectionMarginTop: {
        marginTop: 8,
    },
    presetOptionsGrid: {
        gap: 6,
    },
    locationOptionCard: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
        borderRadius: 10,
        borderWidth: 1,
        minHeight: 48,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    locationOptionCardSelected: {
        backgroundColor: '#0C4A6E',
        borderColor: '#38BDF8',
        borderWidth: 1.5,
    },
    locationOptionLabel: {
        color: '#F8FAFC',
        fontSize: 12.5,
        fontWeight: '800',
    },
    locationOptionLabelSelected: {
        color: '#38BDF8',
    },
    locationOptionDescription: {
        color: '#94A3B8',
        fontSize: 10.5,
        marginTop: 2,
    },
    destScroll: {
        maxHeight: 76,
    },
    destOptionCard: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
        borderRadius: 10,
        borderWidth: 1,
        marginRight: 8,
        minHeight: 48,
        minWidth: 190,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    clearanceCard: {
        backgroundColor: '#1C1917',
        borderColor: '#78350F',
        borderRadius: 8,
        borderWidth: 1,
        gap: 3,
        marginTop: 8,
        padding: 10,
    },
    clearanceCardRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6,
    },
    clearanceRatingText: {
        color: '#F59E0B',
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    clearanceDetailsText: {
        color: '#E2E8F0',
        fontSize: 10.5,
        fontWeight: '600',
    },
    clearanceWarningText: {
        color: '#FECA57',
        fontSize: 10,
        fontWeight: '700',
        marginTop: 2,
    },
    applyRouteBtn: {
        alignItems: 'center',
        backgroundColor: '#0284C7',
        borderRadius: 12,
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
        minHeight: 50,
        marginTop: 8,
        paddingVertical: 12,
        ...shadows.md,
    },
    applyRouteBtnText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
    },
    corridorSheetModal: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderWidth: 1,
        bottom: 0,
        left: 0,
        maxHeight: '65%',
        position: 'absolute',
        right: 0,
        zIndex: 25,
        ...shadows.lg,
    },
    corridorSheetHeader: {
        borderBottomColor: '#1E293B',
        borderBottomWidth: 1,
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 12,
    },
    sheetHandle: {
        alignSelf: 'center',
        backgroundColor: '#475569',
        borderRadius: 3,
        height: 4,
        marginBottom: 8,
        width: 36,
    },
    sheetTitleRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    corridorSheetTitle: {
        color: '#F8FAFC',
        fontSize: 13,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    corridorSheetSubtitle: {
        color: '#94A3B8',
        fontSize: 11,
    },
    closeSheetBtn: {
        minHeight: 48,
        minWidth: 48,
        padding: 8,
    },
    corridorSheetScrollView: {
        flex: 1,
    },
    corridorSheetScroll: {
        gap: 10,
        padding: 16,
        paddingBottom: 28,
    },
    stepCard: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
        borderRadius: 12,
        borderWidth: 1,
        gap: 6,
        padding: 12,
    },
    stepCardHazard: {
        backgroundColor: '#1C1917',
        borderColor: '#DC2626',
        borderWidth: 1.5,
    },
    stepCardSelected: {
        backgroundColor: '#0B2545',
        borderColor: '#38BDF8',
        borderWidth: 1.5,
    },
    stepHeaderRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    stepNumberBadge: {
        alignItems: 'center',
        backgroundColor: '#2563EB',
        borderRadius: 12,
        height: 24,
        justifyContent: 'center',
        width: 24,
    },
    stepNumberHazardBadge: {
        backgroundColor: '#DC2626',
    },
    stepNumberSelectedBadge: {
        backgroundColor: '#0284C7',
    },
    stepNumberText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800',
    },
    stepDistanceText: {
        color: '#94A3B8',
        fontSize: 12,
        fontWeight: '700',
    },
    stepInstructionText: {
        color: '#F8FAFC',
        fontSize: 13,
        fontWeight: '600',
        lineHeight: 18,
    },
    cautionBox: {
        backgroundColor: '#292524',
        borderColor: '#78350F',
        borderRadius: 6,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 8,
        padding: 8,
    },
    hazardCautionBox: {
        backgroundColor: '#450A0A',
        borderColor: '#991B1B',
    },
    cautionTag: {
        color: '#F59E0B',
        fontSize: 9.5,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    cautionDescription: {
        color: '#FEF3C7',
        flex: 1,
        fontSize: 11,
        fontWeight: '600',
    },
    delayPickerModal: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderWidth: 1,
        gap: 10,
        padding: 18,
        paddingBottom: 32,
        width: '100%',
        ...shadows.lg,
    },
    delayOptionCard: {
        alignItems: 'center',
        backgroundColor: '#1E293B',
        borderColor: '#334155',
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        minHeight: 50,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    delayOptionTitle: {
        color: '#F8FAFC',
        fontSize: 13.5,
        fontWeight: '600',
    },
    pressed: {
        opacity: 0.8,
    },
});
