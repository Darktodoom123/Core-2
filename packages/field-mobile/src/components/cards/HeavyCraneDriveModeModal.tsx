import React, { useState } from 'react';
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import type { HeavyRouteInstruction } from '../../types/index';
import { colors } from '../nativeStyles';

export interface HeavyCraneDriveModeModalProps {
    visible: boolean;
    assetLabel: string;
    jobReference: string;
    destination: string;
    siteEntrance?: string | null;
    stagingPoint?: string | null;
    etaLabel?: string | null;
    distanceLabel?: string | null;
    instructions?: HeavyRouteInstruction[];
    isFresh?: boolean;
    lastSyncedAt?: string | null;
    onArrived: () => void;
    onReportDelay?: (delayReason: string) => void;
    onClose: () => void;
}

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

export const HeavyCraneDriveModeModal: React.FC<
    HeavyCraneDriveModeModalProps
> = ({
    visible,
    assetLabel,
    jobReference,
    destination,
    siteEntrance,
    stagingPoint,
    etaLabel = '18 min',
    distanceLabel = '7.4 km',
    instructions = DEFAULT_INSTRUCTIONS,
    isFresh = true,
    lastSyncedAt,
    onArrived,
    onReportDelay,
    onClose,
}) => {
    const [showDelayPicker, setShowDelayPicker] = useState(false);
    const [delayReported, setDelayReported] = useState<string | null>(null);

    const handleConfirmDelay = (reason: string) => {
        setDelayReported(reason);
        setShowDelayPicker(false);
        onReportDelay?.(reason);
    };

    return (
        <Modal
            animationType="slide"
            onRequestClose={onClose}
            transparent={false}
            visible={visible}
        >
            <View
                style={styles.container}
                testID="heavy-crane-drive-mode-modal"
            >
                <View style={styles.topBanner}>
                    <View style={styles.modeBadge}>
                        <View style={styles.beaconDot} />
                        <Text style={styles.modeBadgeText}>
                            HEAVY CRANE DRIVE MODE
                        </Text>
                    </View>
                    <Pressable
                        accessibilityLabel="Exit drive mode"
                        accessibilityRole="button"
                        onPress={onClose}
                        style={({ pressed }) => [
                            styles.exitButton,
                            pressed && styles.pressed,
                        ]}
                        testID="exit-drive-mode-btn"
                    >
                        <Text style={styles.exitButtonText}>✕ Exit</Text>
                    </Pressable>
                </View>

                <ScrollView
                    accessibilityLabel="Drive mode navigation instructions"
                    contentContainerStyle={styles.scrollContent}
                >
                    {/* Freshness Banner */}
                    <View
                        accessible
                        accessibilityRole="summary"
                        style={[
                            styles.freshnessBanner,
                            !isFresh && styles.freshnessBannerStale,
                        ]}
                    >
                        <View
                            style={[
                                styles.freshnessDot,
                                !isFresh && styles.freshnessDotStale,
                            ]}
                        />
                        <Text style={styles.freshnessText}>
                            {isFresh
                                ? 'Route active & verified for heavy transport'
                                : 'Route offline cache — proceed with caution'}
                            {lastSyncedAt
                                ? ` · Last synced: ${lastSyncedAt}`
                                : ''}
                        </Text>
                    </View>

                    {/* Glanceable Metrics Card */}
                    <View style={styles.metricsCard}>
                        <View style={styles.metricCol}>
                            <Text style={styles.metricCaption}>
                                ESTIMATED ARRIVAL
                            </Text>
                            <Text style={styles.metricValueLarge}>
                                {etaLabel}
                            </Text>
                        </View>
                        <View style={styles.metricDivider} />
                        <View style={styles.metricCol}>
                            <Text style={styles.metricCaption}>
                                DISTANCE REMAINING
                            </Text>
                            <Text style={styles.metricValueLarge}>
                                {distanceLabel}
                            </Text>
                        </View>
                    </View>

                    {/* Destination & Access Gate Info */}
                    <View style={styles.destCard}>
                        <Text style={styles.destEyebrow}>
                            DESTINATION & SITE GATE
                        </Text>
                        <Text style={styles.destTitle} selectable>
                            {jobReference} · {destination}
                        </Text>
                        <Text style={styles.destAsset}>{assetLabel}</Text>

                        {siteEntrance ? (
                            <View style={styles.gateRow}>
                                <Text style={styles.gateTag}>ENTRANCE</Text>
                                <Text style={styles.gateText} selectable>
                                    {siteEntrance}
                                </Text>
                            </View>
                        ) : null}

                        {stagingPoint ? (
                            <View style={styles.gateRow}>
                                <Text style={styles.gateTag}>STAGING</Text>
                                <Text style={styles.gateText} selectable>
                                    {stagingPoint}
                                </Text>
                            </View>
                        ) : null}
                    </View>

                    {/* Glanceable Step-by-Step Instructions (No typing required) */}
                    <View style={styles.instructionsContainer}>
                        <Text
                            accessibilityRole="header"
                            style={styles.sectionHeader}
                        >
                            HEAVY VEHICLE CORRIDOR INSTRUCTIONS
                        </Text>
                        {instructions.map((step) => (
                            <View
                                key={step.id}
                                style={[
                                    styles.stepCard,
                                    step.isHazard && styles.stepCardHazard,
                                ]}
                                testID={`drive-instruction-${step.stepNumber}`}
                            >
                                <View style={styles.stepHeader}>
                                    <View
                                        style={[
                                            styles.stepNumberBadge,
                                            step.isHazard &&
                                                styles.hazardNumberBadge,
                                        ]}
                                    >
                                        <Text style={styles.stepNumberText}>
                                            {step.stepNumber}
                                        </Text>
                                    </View>
                                    <Text style={styles.stepDistance}>
                                        {step.distanceLabel}
                                    </Text>
                                </View>
                                <Text style={styles.stepInstruction}>
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
                                        <Text style={styles.cautionIcon}>
                                            {step.isHazard
                                                ? '⛔ HAZARD'
                                                : '⚠️ CAUTION'}
                                        </Text>
                                        <Text style={styles.cautionText}>
                                            {step.caution}
                                        </Text>
                                    </View>
                                ) : null}
                            </View>
                        ))}
                    </View>

                    {/* Delay Notice Banner if reported */}
                    {delayReported ? (
                        <View style={styles.reportedDelayCard}>
                            <Text style={styles.reportedDelayTitle}>
                                ✓ Delay reported to Dispatch:
                            </Text>
                            <Text style={styles.reportedDelayText}>
                                {delayReported}
                            </Text>
                        </View>
                    ) : null}

                    {/* One-tap Delay / Obstruction Reporting */}
                    {showDelayPicker ? (
                        <View style={styles.delayPickerCard}>
                            <Text style={styles.delayPickerTitle}>
                                Report route delay or obstruction:
                            </Text>
                            {DELAY_REASONS.map((reason) => (
                                <Pressable
                                    key={reason}
                                    accessibilityLabel={`Report: ${reason}`}
                                    accessibilityRole="button"
                                    onPress={() => handleConfirmDelay(reason)}
                                    style={({ pressed }) => [
                                        styles.delayOptionButton,
                                        pressed && styles.pressed,
                                    ]}
                                >
                                    <Text style={styles.delayOptionText}>
                                        {reason}
                                    </Text>
                                </Pressable>
                            ))}
                            <Pressable
                                accessibilityLabel="Cancel delay report"
                                accessibilityRole="button"
                                onPress={() => setShowDelayPicker(false)}
                                style={styles.cancelDelayButton}
                            >
                                <Text style={styles.cancelDelayText}>
                                    Cancel
                                </Text>
                            </Pressable>
                        </View>
                    ) : (
                        <Pressable
                            accessibilityLabel="Report delay or obstruction"
                            accessibilityRole="button"
                            onPress={() => setShowDelayPicker(true)}
                            style={({ pressed }) => [
                                styles.reportDelayTrigger,
                                pressed && styles.pressed,
                            ]}
                            testID="report-delay-trigger-btn"
                        >
                            <Text style={styles.reportDelayTriggerText}>
                                ⚠️ Report Route Delay / Obstruction
                            </Text>
                        </Pressable>
                    )}
                </ScrollView>

                {/* Fixed Bottom Action Bar */}
                <View style={styles.bottomBar}>
                    <Pressable
                        accessibilityLabel="Confirm arrival at destination site"
                        accessibilityRole="button"
                        onPress={() => {
                            onArrived();
                            onClose();
                        }}
                        style={({ pressed }) => [
                            styles.arrivedButton,
                            pressed && styles.pressed,
                        ]}
                        testID="drive-mode-arrived-btn"
                    >
                        <Text style={styles.arrivedButtonText}>
                            ✓ I HAVE ARRIVED AT SITE
                        </Text>
                        <Text style={styles.arrivedButtonSubtext}>
                            Tap upon vehicle stop to proceed to Parked & Secured
                            check
                        </Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.surfaceDark,
        flex: 1,
    },
    topBanner: {
        alignItems: 'center',
        backgroundColor: colors.surfaceDarkElevated,
        borderBottomColor: '#334155',
        borderBottomWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        minHeight: 56,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    modeBadge: {
        alignItems: 'center',
        backgroundColor: colors.amberDark,
        borderRadius: 20,
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    beaconDot: {
        backgroundColor: '#fbbf24',
        borderRadius: 4,
        height: 8,
        width: 8,
    },
    modeBadgeText: {
        color: colors.white,
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 0.8,
    },
    exitButton: {
        alignItems: 'center',
        backgroundColor: '#334155',
        borderRadius: 8,
        justifyContent: 'center',
        minHeight: 48,
        minWidth: 72,
        paddingHorizontal: 12,
    },
    exitButtonText: {
        color: colors.textOnDark,
        fontSize: 14,
        fontWeight: '800',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 120,
    },
    freshnessBanner: {
        alignItems: 'center',
        backgroundColor: '#064e3b',
        borderRadius: 8,
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    freshnessBannerStale: {
        backgroundColor: '#78350f',
    },
    freshnessDot: {
        backgroundColor: '#34d399',
        borderRadius: 4,
        height: 8,
        width: 8,
    },
    freshnessDotStale: {
        backgroundColor: '#fbbf24',
    },
    freshnessText: {
        color: colors.textOnDark,
        flex: 1,
        fontSize: 12,
        fontWeight: '700',
    },
    metricsCard: {
        backgroundColor: colors.surfaceDarkElevated,
        borderColor: '#334155',
        borderRadius: 14,
        borderWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 16,
        paddingVertical: 18,
    },
    metricCol: {
        alignItems: 'center',
        flex: 1,
        gap: 4,
    },
    metricDivider: {
        backgroundColor: '#334155',
        width: 1,
    },
    metricCaption: {
        color: colors.mutedOnDark,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.8,
    },
    metricValueLarge: {
        color: '#fbbf24',
        fontSize: 32,
        fontWeight: '900',
        fontVariant: ['tabular-nums'],
    },
    destCard: {
        backgroundColor: colors.surfaceDarkElevated,
        borderColor: '#334155',
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 16,
        padding: 16,
    },
    destEyebrow: {
        color: colors.mutedOnDark,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.8,
    },
    destTitle: {
        color: colors.textOnDark,
        fontSize: 20,
        fontWeight: '800',
        marginTop: 4,
    },
    destAsset: {
        color: '#fbbf24',
        fontSize: 14,
        fontWeight: '700',
        marginTop: 2,
    },
    gateRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
        marginTop: 10,
    },
    gateTag: {
        backgroundColor: colors.amberDark,
        borderRadius: 4,
        color: colors.white,
        fontSize: 10,
        fontWeight: '900',
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    gateText: {
        color: colors.textOnDark,
        fontSize: 14,
        fontWeight: '700',
    },
    instructionsContainer: {
        gap: 12,
        marginBottom: 20,
    },
    sectionHeader: {
        color: colors.mutedOnDark,
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.8,
        marginBottom: 4,
    },
    stepCard: {
        backgroundColor: colors.surfaceDarkElevated,
        borderColor: '#334155',
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
    },
    stepCardHazard: {
        backgroundColor: '#451a03',
        borderColor: '#b45309',
    },
    stepHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    stepNumberBadge: {
        alignItems: 'center',
        backgroundColor: colors.blue,
        borderRadius: 14,
        height: 28,
        justifyContent: 'center',
        width: 28,
    },
    hazardNumberBadge: {
        backgroundColor: colors.red,
    },
    stepNumberText: {
        color: colors.white,
        fontSize: 14,
        fontWeight: '900',
    },
    stepDistance: {
        color: colors.mutedOnDark,
        fontSize: 13,
        fontWeight: '800',
    },
    stepInstruction: {
        color: colors.textOnDark,
        fontSize: 17,
        fontWeight: '800',
        lineHeight: 24,
    },
    cautionBox: {
        backgroundColor: '#1e293b',
        borderRadius: 8,
        gap: 4,
        marginTop: 10,
        padding: 10,
    },
    hazardCautionBox: {
        backgroundColor: '#7f1d1d',
    },
    cautionIcon: {
        color: '#f87171',
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    cautionText: {
        color: colors.textOnDark,
        fontSize: 13,
        fontWeight: '700',
        lineHeight: 18,
    },
    reportDelayTrigger: {
        alignItems: 'center',
        backgroundColor: '#334155',
        borderColor: '#475569',
        borderRadius: 10,
        borderWidth: 1,
        justifyContent: 'center',
        minHeight: 52,
        paddingHorizontal: 16,
    },
    reportDelayTriggerText: {
        color: '#fbbf24',
        fontSize: 15,
        fontWeight: '800',
    },
    delayPickerCard: {
        backgroundColor: colors.surfaceDarkElevated,
        borderColor: '#475569',
        borderRadius: 12,
        borderWidth: 1,
        gap: 8,
        padding: 14,
    },
    delayPickerTitle: {
        color: colors.textOnDark,
        fontSize: 14,
        fontWeight: '800',
        marginBottom: 4,
    },
    delayOptionButton: {
        alignItems: 'center',
        backgroundColor: '#334155',
        borderRadius: 8,
        justifyContent: 'center',
        minHeight: 48,
        paddingHorizontal: 12,
    },
    delayOptionText: {
        color: colors.textOnDark,
        fontSize: 14,
        fontWeight: '700',
    },
    cancelDelayButton: {
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
        marginTop: 4,
    },
    cancelDelayText: {
        color: colors.mutedOnDark,
        fontSize: 13,
        fontWeight: '700',
    },
    reportedDelayCard: {
        backgroundColor: '#064e3b',
        borderRadius: 10,
        gap: 2,
        marginBottom: 12,
        padding: 12,
    },
    reportedDelayTitle: {
        color: '#34d399',
        fontSize: 12,
        fontWeight: '800',
    },
    reportedDelayText: {
        color: colors.white,
        fontSize: 14,
        fontWeight: '700',
    },
    bottomBar: {
        backgroundColor: colors.surfaceDarkElevated,
        borderTopColor: '#334155',
        borderTopWidth: 1,
        bottom: 0,
        left: 0,
        padding: 16,
        position: 'absolute',
        right: 0,
    },
    arrivedButton: {
        alignItems: 'center',
        backgroundColor: '#16a34a',
        borderRadius: 12,
        justifyContent: 'center',
        minHeight: 64,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    arrivedButtonText: {
        color: colors.white,
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    arrivedButtonSubtext: {
        color: '#dcfce7',
        fontSize: 11,
        fontWeight: '600',
        marginTop: 2,
    },
    pressed: {
        opacity: 0.8,
    },
});
