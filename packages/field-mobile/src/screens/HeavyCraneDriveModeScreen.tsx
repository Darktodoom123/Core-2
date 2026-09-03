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
import { useTheme } from '../theme';
import type { DispatchJob, HeavyRouteInstruction } from '../types/index';

export interface HeavyCraneDriveModeScreenProps {
    activeJob?: DispatchJob | null;
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

const TURN_STEPS: TurnManeuverStep[] = [
    {
        id: 'turn-1',
        stepNumber: 1,
        maneuverIcon: 'route',
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
        coords: [121.045, 14.312],
    },
    {
        id: 'turn-2',
        stepNumber: 2,
        maneuverIcon: 'alert',
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
        coords: [121.162, 13.945],
    },
    {
        id: 'turn-3',
        stepNumber: 3,
        maneuverIcon: 'chevron-down',
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
        coords: [121.055, 13.765],
    },
    {
        id: 'turn-4',
        stepNumber: 4,
        maneuverIcon: 'flag',
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
    const [isSimulatingDrive, setIsSimulatingDrive] = useState(false);
    const [showDelayPicker, setShowDelayPicker] = useState(false);
    const [delayReported, setDelayReported] = useState<string | null>(null);
    const [showCorridorSheet, setShowCorridorSheet] = useState(false);
    const [isMuted, setIsMuted] = useState(false);

    useEffect(() => {
        if (!isSimulatingDrive) {
            return;
        }

        const interval = setInterval(() => {
            setCurrentStepIndex((prev) => {
                if (prev < TURN_STEPS.length - 1) {
                    return prev + 1;
                }

                setIsSimulatingDrive(false);

                return prev;
            });
        }, 3500);

        return () => clearInterval(interval);
    }, [isSimulatingDrive]);

    const jobReference = activeJob?.reference || 'DISP-2026-0891';
    const destination = activeJob?.site || 'Batangas Power Plant Expansion';
    const siteEntrance = 'Gate 3 (South Heavy Haul Access)';
    const stagingPoint = 'Bay 4 — Heavy Rigging Marshalling';

    const currentTurn = TURN_STEPS[currentStepIndex] || TURN_STEPS[0];

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
        if (currentStepIndex < TURN_STEPS.length - 1) {
            setCurrentStepIndex((prev) => prev + 1);
        }
    };

    const handlePrevTurn = () => {
        if (currentStepIndex > 0) {
            setCurrentStepIndex((prev) => prev - 1);
        }
    };

    return (
        <View
            style={[styles.screenRoot, isDarkHud && styles.darkScreenRoot]}
            testID="heavy-crane-drive-mode-screen"
        >
            {/* 1. Full-Screen Interactive Map Canvas (Real-world navigation background) */}
            <View style={styles.mapCanvasWrap} testID="drive-mode-map-section">
                <MapLibreWebContainer
                    apiKey={stadiaApiKey}
                    destinationCoords={[121.05, 13.7565]}
                    destinationLabel={destination}
                    originCoords={[120.9842, 14.5995]}
                    originLabel="Equipment Yard (Departure)"
                    style={styles.fullscreenMap}
                    styleVariant="dark"
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

            {/* 2. Compact, Streamlined Top Navigation Maneuver HUD */}
            <View style={styles.topHudContainer} testID="drive-mode-top-banner">
                {/* Slim Header Meta Row */}
                <View style={styles.topMetaRow}>
                    <Pressable
                        accessibilityLabel="Exit drive mode and return to dashboard"
                        accessibilityRole="button"
                        onPress={onBack}
                        style={styles.exitBtn}
                        testID="drive-mode-back-btn"
                    >
                        <Icon color="#F8FAFC" name="close" size={14} />
                        <Text style={styles.exitBtnText}>Exit</Text>
                    </Pressable>

                    <View style={styles.titleCenterWrap}>
                        <Text style={styles.categoryBadgeText}>
                            HEAVY TRANSIT · CORRIDOR NAVIGATION
                        </Text>
                        <Text
                            accessibilityRole="header"
                            style={styles.screenTitle}
                        >
                            Heavy Crane Drive Mode
                        </Text>
                    </View>

                    <View style={styles.topRightControls}>
                        <Pressable
                            accessibilityLabel={
                                isSimulatingDrive
                                    ? 'Pause drive simulation'
                                    : 'Start turn by turn drive simulation'
                            }
                            accessibilityRole="button"
                            onPress={() =>
                                setIsSimulatingDrive(!isSimulatingDrive)
                            }
                            style={[
                                styles.simDriveBtn,
                                isSimulatingDrive && styles.simDriveBtnActive,
                            ]}
                            testID="toggle-nav-sim-btn"
                        >
                            <Icon
                                color={
                                    isSimulatingDrive ? '#10B981' : '#38BDF8'
                                }
                                name={isSimulatingDrive ? 'check' : 'flash'}
                                size={11}
                            />
                            <Text
                                style={[
                                    styles.simDriveBtnText,
                                    isSimulatingDrive &&
                                        styles.simDriveBtnTextActive,
                                ]}
                            >
                                {isSimulatingDrive ? 'SIM' : 'DEMO'}
                            </Text>
                        </Pressable>

                        <View style={styles.liveBeaconBadge}>
                            <View style={styles.liveDot} />
                            <Text style={styles.liveBadgeText}>LIVE</Text>
                        </View>
                    </View>
                </View>

                {/* Main Maneuver Guidance Row */}
                <View style={styles.maneuverCard}>
                    <View
                        style={[
                            styles.maneuverIconBox,
                            currentTurn.isHazard &&
                                styles.hazardManeuverIconBox,
                        ]}
                    >
                        <Icon
                            color="#FFFFFF"
                            name={currentTurn.maneuverIcon}
                            size={26}
                        />
                    </View>

                    <View style={styles.maneuverTextCol}>
                        <View style={styles.distanceNextRow}>
                            <Text style={styles.distanceNextVal}>
                                {currentTurn.distanceNext}
                            </Text>
                            <View style={styles.turnStepperBadge}>
                                <Text style={styles.turnStepperBadgeText}>
                                    TURN {currentStepIndex + 1} OF{' '}
                                    {TURN_STEPS.length}
                                </Text>
                            </View>
                        </View>

                        <Text
                            numberOfLines={1}
                            style={styles.maneuverInstructionText}
                        >
                            {currentTurn.instruction}
                        </Text>

                        {/* Lane Guidance Assistant */}
                        <View
                            style={styles.laneGuidanceRow}
                            testID="lane-guidance-bar"
                        >
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
                                    LANE 1
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
                                    CENTER
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
                                    🚛 WIDE ESCORT
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Step Navigation Controls (Prev / Next Turn) */}
                    <View style={styles.turnControlsCol}>
                        <Pressable
                            accessibilityLabel="Advance to next turn maneuver"
                            accessibilityRole="button"
                            disabled={currentStepIndex >= TURN_STEPS.length - 1}
                            onPress={handleNextTurn}
                            style={({ pressed }) => [
                                styles.turnStepBtn,
                                currentStepIndex >= TURN_STEPS.length - 1 &&
                                    styles.turnStepBtnDisabled,
                                pressed && styles.pressed,
                            ]}
                            testID="turn-next-btn"
                        >
                            <Icon
                                color={
                                    currentStepIndex >= TURN_STEPS.length - 1
                                        ? '#475569'
                                        : '#FFFFFF'
                                }
                                name="chevron-down"
                                size={15}
                            />
                        </Pressable>

                        <Pressable
                            accessibilityLabel="Previous turn maneuver"
                            accessibilityRole="button"
                            disabled={currentStepIndex === 0}
                            onPress={handlePrevTurn}
                            style={({ pressed }) => [
                                styles.turnStepBtn,
                                currentStepIndex === 0 &&
                                    styles.turnStepBtnDisabled,
                                pressed && styles.pressed,
                            ]}
                            testID="turn-prev-btn"
                        >
                            <Icon
                                color={
                                    currentStepIndex === 0
                                        ? '#475569'
                                        : '#FFFFFF'
                                }
                                name="chevron-up"
                                size={15}
                            />
                        </Pressable>
                    </View>
                </View>

                {/* Voice Guidance Announcement Audio Strip */}
                {!isMuted ? (
                    <View
                        style={styles.voiceGuidanceStrip}
                        testID="voice-guidance-banner"
                    >
                        <Icon color="#38BDF8" name="bell" size={13} />
                        <Text
                            numberOfLines={1}
                            style={styles.voiceGuidanceText}
                        >
                            {currentTurn.voiceAnnouncement}
                        </Text>
                    </View>
                ) : null}

                {/* Real-time Heavy Vehicle Height Clearance Alert Strip */}
                <View style={styles.hazardAlertStrip}>
                    <Icon color="#F59E0B" name="alert" size={13} />
                    <Text numberOfLines={1} style={styles.hazardAlertText}>
                        CAUTION: Bridge clearance only 4.1m — DO NOT ENTER Old
                        Mill Road.
                    </Text>
                </View>
            </View>

            {/* 3. Floating In-Cab Telemetry Badges (Positioned safely above bottom dock) */}
            <View
                pointerEvents="box-none"
                style={styles.floatingControlsOverlay}
            >
                {/* Unified In-Dash Speedometer & Speed Limit Pill */}
                <View style={styles.inDashSpeedGauge}>
                    <View style={styles.speedSection}>
                        <Text style={styles.speedVal}>42</Text>
                        <Text style={styles.speedUnit}>km/h</Text>
                    </View>
                    <View style={styles.speedDivider} />
                    <View style={styles.speedLimitSign}>
                        <Text style={styles.speedLimitVal}>
                            {currentTurn.speedLimit}
                        </Text>
                    </View>
                </View>

                {/* Floating Quick Action Cluster on Right */}
                <View style={styles.rightActionCol}>
                    <View style={styles.compassPill}>
                        <Icon color="#EF4444" name="compass" size={13} />
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
                        <Icon color="#F59E0B" name="alert" size={19} />
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
                            size={18}
                        />
                    </Pressable>

                    <Pressable
                        accessibilityLabel="Re-center GPS map"
                        accessibilityRole="button"
                        style={({ pressed }) => [
                            styles.floatingRoundBtn,
                            pressed && styles.pressed,
                        ]}
                    >
                        <Icon color="#38BDF8" name="location" size={18} />
                    </Pressable>
                </View>
            </View>

            {/* 4. Active Reported Delay Notification Banner */}
            {delayReported ? (
                <View style={styles.floatingReportedDelayCard}>
                    <Icon color="#F59E0B" name="check-circle" size={15} />
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
                        <Icon color="#94A3B8" name="close" size={13} />
                    </Pressable>
                </View>
            ) : null}

            {/* 5. Streamlined Glanceable Bottom Navigation Dock */}
            <View style={styles.bottomDockCard}>
                {/* Trip ETA, Distance & Destination Glance */}
                <View style={styles.dockHeaderRow}>
                    <View style={styles.dockEtaWrap}>
                        <View style={styles.etaRow}>
                            <Text style={styles.etaValue}>
                                {currentTurn.remainingEta}
                            </Text>
                            <Text style={styles.metricCaption}>
                                ESTIMATED ARRIVAL
                            </Text>
                        </View>
                        <View style={styles.distanceSubRow}>
                            <Text style={styles.distanceValue}>
                                {currentTurn.remainingDistance}
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
                            size={15}
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

                {/* Target Site Gate & Heavy Crane Specs */}
                <View style={styles.dockDestinationRow}>
                    <View style={styles.destPinIcon}>
                        <Icon color="#10B981" name="pin" size={15} />
                    </View>
                    <View style={styles.destTextCol}>
                        <Text numberOfLines={1} style={styles.dockDestTitle}>
                            {destination}
                        </Text>
                        <View style={styles.dockSpecsRow}>
                            <Text style={styles.dockGateBadge}>
                                {siteEntrance}
                            </Text>
                            <Text
                                numberOfLines={1}
                                style={styles.dockAssetBadge}
                            >
                                {assetLabel}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Primary Action: Confirm Arrival at Site */}
                <Pressable
                    accessibilityLabel="Confirm arrival at destination site"
                    accessibilityRole="button"
                    onPress={handleConfirmArrival}
                    style={({ pressed }) => [
                        styles.arrivedBtn,
                        currentStepIndex === TURN_STEPS.length - 1 &&
                            styles.finalArrivedBtn,
                        pressed && styles.pressed,
                    ]}
                    testID="drive-mode-arrived-btn"
                >
                    <Icon color="#FFFFFF" name="check-circle" size={18} />
                    <Text style={styles.arrivedBtnText}>
                        ✓ I HAVE ARRIVED AT SITE
                    </Text>
                </Pressable>
            </View>

            {/* 6. Expandable Route Corridor Sheet (Slides up over the map) */}
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
                                <Icon color="#94A3B8" name="close" size={18} />
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

            {/* 7. Delay / Obstruction Reporting Modal */}
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
                                <Icon color="#94A3B8" name="close" size={18} />
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
                                    size={16}
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
        backgroundColor: 'rgba(11, 17, 32, 0.96)',
        borderColor: 'rgba(51, 65, 85, 0.8)',
        borderRadius: 16,
        borderWidth: 1,
        left: 10,
        overflow: 'hidden',
        position: 'absolute',
        right: 10,
        top: 8,
        zIndex: 10,
        ...shadows.lg,
    },
    topMetaRow: {
        alignItems: 'center',
        borderBottomColor: 'rgba(51, 65, 85, 0.5)',
        borderBottomWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    exitBtn: {
        alignItems: 'center',
        backgroundColor: 'rgba(30, 41, 59, 0.8)',
        borderColor: '#334155',
        borderRadius: 6,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 3,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    exitBtnText: {
        color: '#F8FAFC',
        fontSize: 11,
        fontWeight: '700',
    },
    titleCenterWrap: {
        alignItems: 'center',
        flex: 1,
    },
    categoryBadgeText: {
        color: '#F59E0B',
        fontSize: 8.5,
        fontWeight: '800',
        letterSpacing: 0.6,
    },
    screenTitle: {
        color: '#F8FAFC',
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: -0.2,
    },
    topRightControls: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 5,
    },
    simDriveBtn: {
        alignItems: 'center',
        backgroundColor: '#1E293B',
        borderColor: '#0284C7',
        borderRadius: 6,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 3,
        paddingHorizontal: 6,
        paddingVertical: 3,
    },
    simDriveBtnActive: {
        backgroundColor: '#064E3B',
        borderColor: '#10B981',
    },
    simDriveBtnText: {
        color: '#38BDF8',
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    simDriveBtnTextActive: {
        color: '#34D399',
    },
    liveBeaconBadge: {
        alignItems: 'center',
        backgroundColor: '#064E3B',
        borderColor: '#059669',
        borderRadius: 8,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 4,
        paddingHorizontal: 6,
        paddingVertical: 3,
    },
    liveDot: {
        backgroundColor: '#10B981',
        borderRadius: 3,
        height: 6,
        width: 6,
    },
    liveBadgeText: {
        color: '#34D399',
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    maneuverCard: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 10,
        paddingVertical: 7,
    },
    maneuverIconBox: {
        alignItems: 'center',
        backgroundColor: '#059669',
        borderRadius: 12,
        height: 44,
        justifyContent: 'center',
        width: 44,
        ...shadows.md,
    },
    hazardManeuverIconBox: {
        backgroundColor: '#DC2626',
    },
    maneuverTextCol: {
        flex: 1,
        gap: 2,
    },
    distanceNextRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6,
    },
    distanceNextVal: {
        color: '#F8FAFC',
        fontSize: 20,
        fontWeight: '900',
        letterSpacing: -0.5,
    },
    turnStepperBadge: {
        backgroundColor: '#1E293B',
        borderColor: '#38BDF8',
        borderRadius: 4,
        borderWidth: 1,
        paddingHorizontal: 5,
        paddingVertical: 1,
    },
    turnStepperBadgeText: {
        color: '#38BDF8',
        fontSize: 8.5,
        fontWeight: '800',
        letterSpacing: 0.4,
    },
    maneuverInstructionText: {
        color: '#E2E8F0',
        fontSize: 11.5,
        fontWeight: '600',
        lineHeight: 15,
    },
    laneGuidanceRow: {
        flexDirection: 'row',
        gap: 4,
        marginTop: 2,
    },
    lanePill: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
        borderRadius: 4,
        borderWidth: 1,
        paddingHorizontal: 5,
        paddingVertical: 1,
    },
    wideLanePill: {
        borderColor: '#0284C7',
    },
    lanePillActive: {
        backgroundColor: '#0369A1',
        borderColor: '#38BDF8',
    },
    lanePillText: {
        color: '#64748B',
        fontSize: 8,
        fontWeight: '800',
    },
    lanePillTextActive: {
        color: '#F0F9FF',
    },
    turnControlsCol: {
        gap: 4,
    },
    turnStepBtn: {
        alignItems: 'center',
        backgroundColor: '#1E293B',
        borderColor: '#334155',
        borderRadius: 6,
        borderWidth: 1,
        height: 24,
        justifyContent: 'center',
        width: 24,
    },
    turnStepBtnDisabled: {
        opacity: 0.3,
    },
    voiceGuidanceStrip: {
        alignItems: 'center',
        backgroundColor: '#0C4A6E',
        borderTopColor: '#0369A1',
        borderTopWidth: 1,
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    voiceGuidanceText: {
        color: '#E0F2FE',
        flex: 1,
        fontSize: 10.5,
        fontWeight: '600',
    },
    hazardAlertStrip: {
        alignItems: 'center',
        backgroundColor: '#450A0A',
        borderTopColor: '#DC2626',
        borderTopWidth: 1,
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    hazardAlertText: {
        color: '#FEF2F2',
        flex: 1,
        fontSize: 10,
        fontWeight: '700',
    },
    floatingControlsOverlay: {
        bottom: 165,
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
        borderColor: '#334155',
        borderRadius: 14,
        borderWidth: 1.5,
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
        ...shadows.md,
    },
    speedSection: {
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    speedVal: {
        color: '#F8FAFC',
        fontSize: 20,
        fontWeight: '900',
        lineHeight: 22,
    },
    speedUnit: {
        color: '#10B981',
        fontSize: 8.5,
        fontWeight: '800',
    },
    speedDivider: {
        backgroundColor: '#334155',
        height: 24,
        width: 1,
    },
    speedLimitSign: {
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderColor: '#DC2626',
        borderRadius: 15,
        borderWidth: 2.5,
        height: 30,
        justifyContent: 'center',
        width: 30,
    },
    speedLimitVal: {
        color: '#000000',
        fontSize: 13,
        fontWeight: '900',
    },
    rightActionCol: {
        alignItems: 'center',
        gap: 8,
    },
    floatingRoundBtn: {
        alignItems: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.94)',
        borderColor: '#334155',
        borderRadius: 20,
        borderWidth: 1,
        height: 40,
        justifyContent: 'center',
        width: 40,
        ...shadows.md,
    },
    hazardBtn: {
        backgroundColor: 'rgba(69, 26, 3, 0.94)',
        borderColor: '#F59E0B',
        borderWidth: 1.5,
    },
    compassPill: {
        alignItems: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        borderColor: '#334155',
        borderRadius: 8,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 3,
        paddingHorizontal: 6,
        paddingVertical: 3,
    },
    compassText: {
        color: '#F8FAFC',
        fontSize: 9,
        fontWeight: '800',
    },
    floatingReportedDelayCard: {
        alignItems: 'center',
        backgroundColor: '#451A03',
        borderColor: '#B45309',
        borderRadius: 12,
        borderWidth: 1,
        bottom: 175,
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
        borderColor: '#1E293B',
        borderRadius: 18,
        borderWidth: 1,
        bottom: 10,
        gap: 8,
        left: 10,
        padding: 12,
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
        gap: 1,
    },
    etaRow: {
        alignItems: 'baseline',
        flexDirection: 'row',
        gap: 6,
    },
    etaValue: {
        color: '#10B981',
        fontSize: 22,
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
        fontSize: 13,
        fontWeight: '800',
    },
    arrivalClockText: {
        color: '#94A3B8',
        fontSize: 11,
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
        borderRadius: 8,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    stepsToggleBtnActive: {
        backgroundColor: '#0284C7',
        borderColor: '#0284C7',
    },
    stepsToggleBtnText: {
        color: '#38BDF8',
        fontSize: 11,
        fontWeight: '700',
    },
    stepsToggleBtnTextActive: {
        color: '#FFFFFF',
    },
    dockDestinationRow: {
        alignItems: 'center',
        backgroundColor: '#1E293B',
        borderColor: '#334155',
        borderRadius: 8,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 8,
        paddingVertical: 6,
    },
    destPinIcon: {
        alignItems: 'center',
        height: 18,
        justifyContent: 'center',
        width: 18,
    },
    destTextCol: {
        flex: 1,
    },
    dockDestTitle: {
        color: '#F8FAFC',
        fontSize: 12,
        fontWeight: '800',
    },
    dockSpecsRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6,
        marginTop: 1,
    },
    dockGateBadge: {
        color: '#F59E0B',
        fontSize: 9.5,
        fontWeight: '700',
    },
    dockAssetBadge: {
        color: '#94A3B8',
        fontSize: 9.5,
        fontWeight: '500',
    },
    arrivedBtn: {
        alignItems: 'center',
        backgroundColor: '#059669',
        borderRadius: 10,
        flexDirection: 'row',
        gap: 6,
        justifyContent: 'center',
        paddingVertical: 12,
        ...shadows.md,
    },
    finalArrivedBtn: {
        backgroundColor: '#10B981',
        borderColor: '#34D399',
        borderWidth: 1,
    },
    arrivedBtnText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 0.5,
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
        padding: 6,
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
    modalBackdrop: {
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        flex: 1,
        justifyContent: 'flex-end',
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
    delayPickerModalTitle: {
        color: '#F8FAFC',
        fontSize: 15,
        fontWeight: '800',
    },
    closeModalBtn: {
        padding: 4,
    },
    delayPickerSubtitle: {
        color: '#94A3B8',
        fontSize: 12,
        marginBottom: 4,
    },
    delayOptionCard: {
        alignItems: 'center',
        backgroundColor: '#1E293B',
        borderColor: '#334155',
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    delayOptionTitle: {
        color: '#F8FAFC',
        fontSize: 13,
        fontWeight: '600',
    },
    pressed: {
        opacity: 0.8,
    },
});
