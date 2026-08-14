import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type {
    CraneHazardItem,
    CraneSetupSafetyChecklist,
    CraneSetupState,
} from '../../types/index';
import { colors, sharedStyles } from '../nativeStyles';

export interface CraneSetupSafetyCardProps {
    isParkedAndSecured: boolean;
    isCraneAsset: boolean;
    state?: CraneSetupState | null;
    onVerifySetup: (
        checklist: CraneSetupSafetyChecklist,
        hazards: CraneHazardItem[],
    ) => void;
    testID?: string;
}

const DEFAULT_HAZARDS: CraneHazardItem[] = [
    {
        id: 'hazard-powerlines',
        type: 'powerline',
        title: 'Overhead 13.8kV Distribution Line',
        description:
            'Line passes 8.5m east of setup point. Minimum required clearance is 6.0m.',
        severity: 'critical',
        clearanceRequiredMetres: 6.0,
        isMitigated: false,
    },
    {
        id: 'hazard-ground',
        type: 'unstable_ground',
        title: 'Compacted Gravel over Clay Sub-base',
        description:
            'Ground bearing rating 220 kPa. Requires outrigger sole pads (min 1.2m x 1.2m).',
        severity: 'warning',
        isMitigated: false,
    },
    {
        id: 'hazard-exclusion',
        type: 'overhead_load',
        title: '360° Lift Swing Radius',
        description:
            '15-metre exclusion zone required. Must be barricaded before boom elevation.',
        severity: 'critical',
        clearanceRequiredMetres: 15.0,
        isMitigated: false,
    },
];

export const CraneSetupSafetyCard: React.FC<CraneSetupSafetyCardProps> = ({
    isParkedAndSecured,
    isCraneAsset,
    state,
    onVerifySetup,
    testID = 'crane-setup-safety-card',
}) => {
    const [checklist, setChecklist] = useState<CraneSetupSafetyChecklist>({
        groundBearingVerified: state?.checklist.groundBearingVerified ?? false,
        outriggersFullyExtended:
            state?.checklist.outriggersFullyExtended ?? false,
        levelBubbleCentered: state?.checklist.levelBubbleCentered ?? false,
        powerLineClearanceVerified:
            state?.checklist.powerLineClearanceVerified ?? false,
        exclusionZoneBarricaded:
            state?.checklist.exclusionZoneBarricaded ?? false,
        windSpeedChecked: state?.checklist.windSpeedChecked ?? false,
    });

    const [hazards, setHazards] = useState<CraneHazardItem[]>(
        state?.hazards ?? DEFAULT_HAZARDS,
    );

    if (!isParkedAndSecured || !isCraneAsset) {
        return null;
    }

    const isSetupComplete = Boolean(state?.isSetupComplete);
    const allChecksVerified =
        checklist.groundBearingVerified &&
        checklist.outriggersFullyExtended &&
        checklist.levelBubbleCentered &&
        checklist.powerLineClearanceVerified &&
        checklist.exclusionZoneBarricaded &&
        checklist.windSpeedChecked;

    const toggleCheck = (key: keyof CraneSetupSafetyChecklist) => {
        if (isSetupComplete) {
            return;
        }

        setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const toggleHazard = (id: string) => {
        if (isSetupComplete) {
            return;
        }

        setHazards((prev) =>
            prev.map((h) =>
                h.id === id ? { ...h, isMitigated: !h.isMitigated } : h,
            ),
        );
    };

    const handleVerify = () => {
        if (allChecksVerified) {
            onVerifySetup(checklist, hazards);
        }
    };

    return (
        <View
            style={[
                styles.card,
                isSetupComplete ? styles.cardComplete : styles.cardPending,
            ]}
            testID={testID}
        >
            <View style={styles.headerRow}>
                <View
                    style={[
                        styles.statusDot,
                        isSetupComplete
                            ? styles.statusDotComplete
                            : styles.statusDotPending,
                    ]}
                />
                <View style={styles.headerCopy}>
                    <Text style={styles.eyebrow}>CRANE SAFETY GATE</Text>
                    <Text accessibilityRole="header" style={styles.heading}>
                        Setup & Exclusion Zone Verification
                    </Text>
                </View>
            </View>

            <Text style={styles.description}>
                {isSetupComplete
                    ? 'Crane setup, hazard mitigations, and exclusion zone safety checks verified. Operational lifting controls are active.'
                    : 'Mandatory pre-operation safety verification. Complete all hazard checks and outrigger verifications before initiating lifting operations.'}
            </Text>

            {/* Site Setup Diagram Card */}
            <View style={styles.diagramCard} testID="site-setup-diagram">
                <Text style={styles.diagramTitle}>
                    SITE SETUP MAP & EXCLUSION ZONE
                </Text>
                <View style={styles.diagramVisual}>
                    <View style={styles.exclusionCircle}>
                        <Text style={styles.exclusionLabel}>
                            15m Exclusion Zone
                        </Text>
                        <View style={styles.cranePlacement}>
                            <Text style={styles.cranePlacementText}>CRANE</Text>
                        </View>
                        {/* 4 Outrigger Pad Indicators */}
                        <View style={[styles.padDot, styles.padFL]}>
                            <Text style={styles.padText}>FL</Text>
                        </View>
                        <View style={[styles.padDot, styles.padFR]}>
                            <Text style={styles.padText}>FR</Text>
                        </View>
                        <View style={[styles.padDot, styles.padRL]}>
                            <Text style={styles.padText}>RL</Text>
                        </View>
                        <View style={[styles.padDot, styles.padRR]}>
                            <Text style={styles.padText}>RR</Text>
                        </View>
                    </View>
                </View>
                <View style={styles.diagramLegend}>
                    <Text style={styles.legendItem}>
                        ⚡ Power Line: 8.5m clearance
                    </Text>
                    <Text style={styles.legendItem}>
                        💨 Current Wind: 14 km/h (Limit: 38 km/h)
                    </Text>
                </View>
            </View>

            {/* Identified Hazards Section */}
            <Text accessibilityRole="header" style={styles.sectionHeader}>
                IDENTIFIED SITE HAZARDS
            </Text>
            <View style={styles.hazardList}>
                {hazards.map((hazard) => (
                    <Pressable
                        key={hazard.id}
                        accessibilityLabel={`${hazard.title}: ${
                            hazard.isMitigated
                                ? 'Mitigated'
                                : 'Requires verification'
                        }`}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: hazard.isMitigated }}
                        disabled={isSetupComplete}
                        onPress={() => toggleHazard(hazard.id)}
                        style={({ pressed }) => [
                            styles.hazardRow,
                            hazard.isMitigated && styles.hazardRowMitigated,
                            pressed && !isSetupComplete && styles.pressed,
                        ]}
                        testID={`hazard-item-${hazard.id}`}
                    >
                        <View
                            style={[
                                styles.checkbox,
                                hazard.isMitigated && styles.checkboxChecked,
                            ]}
                        >
                            {hazard.isMitigated ? (
                                <Text style={styles.checkMark}>✓</Text>
                            ) : null}
                        </View>
                        <View style={styles.hazardTextGroup}>
                            <View style={styles.hazardTitleRow}>
                                <Text style={styles.hazardTitle}>
                                    {hazard.title}
                                </Text>
                                <Text
                                    style={[
                                        styles.hazardSeverity,
                                        hazard.severity === 'critical'
                                            ? styles.severityCritical
                                            : styles.severityWarning,
                                    ]}
                                >
                                    {hazard.severity.toUpperCase()}
                                </Text>
                            </View>
                            <Text style={styles.hazardDescription}>
                                {hazard.description}
                            </Text>
                        </View>
                    </Pressable>
                ))}
            </View>

            {/* Mandatory Safety Verification Checklist */}
            <Text accessibilityRole="header" style={styles.sectionHeader}>
                BLOCKING SETUP SAFETY CHECKLIST
            </Text>
            <View style={styles.checklist}>
                {/* 1. Ground Bearing */}
                <Pressable
                    accessibilityLabel="Ground bearing capacity verified and outrigger sole pads placed"
                    accessibilityRole="checkbox"
                    accessibilityState={{
                        checked: checklist.groundBearingVerified,
                    }}
                    disabled={isSetupComplete}
                    onPress={() => toggleCheck('groundBearingVerified')}
                    style={({ pressed }) => [
                        styles.checkRow,
                        checklist.groundBearingVerified &&
                            styles.checkRowChecked,
                        pressed && !isSetupComplete && styles.pressed,
                    ]}
                    testID="setup-check-ground"
                >
                    <View
                        style={[
                            styles.checkbox,
                            checklist.groundBearingVerified &&
                                styles.checkboxChecked,
                        ]}
                    >
                        {checklist.groundBearingVerified ? (
                            <Text style={styles.checkMark}>✓</Text>
                        ) : null}
                    </View>
                    <View style={styles.checkTextGroup}>
                        <Text style={styles.checkLabel}>
                            Ground bearing & sole pads
                        </Text>
                        <Text style={styles.checkDetail}>
                            Sole pads positioned squarely under all 4 outrigger
                            floats
                        </Text>
                    </View>
                </Pressable>

                {/* 2. Outriggers Extended */}
                <Pressable
                    accessibilityLabel="All 4 outrigger beams 100 percent extended and mechanical lock pins set"
                    accessibilityRole="checkbox"
                    accessibilityState={{
                        checked: checklist.outriggersFullyExtended,
                    }}
                    disabled={isSetupComplete}
                    onPress={() => toggleCheck('outriggersFullyExtended')}
                    style={({ pressed }) => [
                        styles.checkRow,
                        checklist.outriggersFullyExtended &&
                            styles.checkRowChecked,
                        pressed && !isSetupComplete && styles.pressed,
                    ]}
                    testID="setup-check-outriggers"
                >
                    <View
                        style={[
                            styles.checkbox,
                            checklist.outriggersFullyExtended &&
                                styles.checkboxChecked,
                        ]}
                    >
                        {checklist.outriggersFullyExtended ? (
                            <Text style={styles.checkMark}>✓</Text>
                        ) : null}
                    </View>
                    <View style={styles.checkTextGroup}>
                        <Text style={styles.checkLabel}>
                            Outriggers 100% extended
                        </Text>
                        <Text style={styles.checkDetail}>
                            Beams fully extended to chart width; lock pins
                            engaged
                        </Text>
                    </View>
                </Pressable>

                {/* 3. Level Bubble */}
                <Pressable
                    accessibilityLabel="Crane carrier leveled with bubble centered within 1 percent grade"
                    accessibilityRole="checkbox"
                    accessibilityState={{
                        checked: checklist.levelBubbleCentered,
                    }}
                    disabled={isSetupComplete}
                    onPress={() => toggleCheck('levelBubbleCentered')}
                    style={({ pressed }) => [
                        styles.checkRow,
                        checklist.levelBubbleCentered && styles.checkRowChecked,
                        pressed && !isSetupComplete && styles.pressed,
                    ]}
                    testID="setup-check-level"
                >
                    <View
                        style={[
                            styles.checkbox,
                            checklist.levelBubbleCentered &&
                                styles.checkboxChecked,
                        ]}
                    >
                        {checklist.levelBubbleCentered ? (
                            <Text style={styles.checkMark}>✓</Text>
                        ) : null}
                    </View>
                    <View style={styles.checkTextGroup}>
                        <Text style={styles.checkLabel}>
                            Crane level indicator centered
                        </Text>
                        <Text style={styles.checkDetail}>
                            Bullseye bubble centered; tyres clear of ground
                            contact
                        </Text>
                    </View>
                </Pressable>

                {/* 4. Power Line Clearance */}
                <Pressable
                    accessibilityLabel="Power line safe approach distance confirmed"
                    accessibilityRole="checkbox"
                    accessibilityState={{
                        checked: checklist.powerLineClearanceVerified,
                    }}
                    disabled={isSetupComplete}
                    onPress={() => toggleCheck('powerLineClearanceVerified')}
                    style={({ pressed }) => [
                        styles.checkRow,
                        checklist.powerLineClearanceVerified &&
                            styles.checkRowChecked,
                        pressed && !isSetupComplete && styles.pressed,
                    ]}
                    testID="setup-check-powerline"
                >
                    <View
                        style={[
                            styles.checkbox,
                            checklist.powerLineClearanceVerified &&
                                styles.checkboxChecked,
                        ]}
                    >
                        {checklist.powerLineClearanceVerified ? (
                            <Text style={styles.checkMark}>✓</Text>
                        ) : null}
                    </View>
                    <View style={styles.checkTextGroup}>
                        <Text style={styles.checkLabel}>
                            Power line clearance verified
                        </Text>
                        <Text style={styles.checkDetail}>
                            Dedicated spotter assigned; clearance exceeds 6.0m
                            rule
                        </Text>
                    </View>
                </Pressable>

                {/* 5. Exclusion Zone */}
                <Pressable
                    accessibilityLabel="360 degree exclusion zone barricaded with safety cones and danger tape"
                    accessibilityRole="checkbox"
                    accessibilityState={{
                        checked: checklist.exclusionZoneBarricaded,
                    }}
                    disabled={isSetupComplete}
                    onPress={() => toggleCheck('exclusionZoneBarricaded')}
                    style={({ pressed }) => [
                        styles.checkRow,
                        checklist.exclusionZoneBarricaded &&
                            styles.checkRowChecked,
                        pressed && !isSetupComplete && styles.pressed,
                    ]}
                    testID="setup-check-barricade"
                >
                    <View
                        style={[
                            styles.checkbox,
                            checklist.exclusionZoneBarricaded &&
                                styles.checkboxChecked,
                        ]}
                    >
                        {checklist.exclusionZoneBarricaded ? (
                            <Text style={styles.checkMark}>✓</Text>
                        ) : null}
                    </View>
                    <View style={styles.checkTextGroup}>
                        <Text style={styles.checkLabel}>
                            Exclusion zone barricaded
                        </Text>
                        <Text style={styles.checkDetail}>
                            Perimeter taped & barricaded; unauthorized personnel
                            removed
                        </Text>
                    </View>
                </Pressable>

                {/* 6. Wind Speed */}
                <Pressable
                    accessibilityLabel="Anemometer wind speed check below 38 km per hour maximum limit"
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: checklist.windSpeedChecked }}
                    disabled={isSetupComplete}
                    onPress={() => toggleCheck('windSpeedChecked')}
                    style={({ pressed }) => [
                        styles.checkRow,
                        checklist.windSpeedChecked && styles.checkRowChecked,
                        pressed && !isSetupComplete && styles.pressed,
                    ]}
                    testID="setup-check-wind"
                >
                    <View
                        style={[
                            styles.checkbox,
                            checklist.windSpeedChecked &&
                                styles.checkboxChecked,
                        ]}
                    >
                        {checklist.windSpeedChecked ? (
                            <Text style={styles.checkMark}>✓</Text>
                        ) : null}
                    </View>
                    <View style={styles.checkTextGroup}>
                        <Text style={styles.checkLabel}>
                            Wind speed within chart limits
                        </Text>
                        <Text style={styles.checkDetail}>
                            Measured at 14 km/h (crane rated limit: 38 km/h max)
                        </Text>
                    </View>
                </Pressable>
            </View>

            {!isSetupComplete ? (
                <Pressable
                    accessibilityLabel="Complete setup verification and unlock crane operation controls"
                    accessibilityRole="button"
                    disabled={!allChecksVerified}
                    onPress={handleVerify}
                    style={({ pressed }) => [
                        sharedStyles.button,
                        styles.verifyButton,
                        !allChecksVerified && styles.verifyButtonDisabled,
                        pressed && allChecksVerified && styles.pressed,
                    ]}
                    testID="verify-crane-setup-btn"
                >
                    <Text
                        style={[
                            sharedStyles.buttonText,
                            !allChecksVerified &&
                                styles.verifyButtonTextDisabled,
                        ]}
                    >
                        Unlock Crane Operation Controls
                    </Text>
                </Pressable>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 16,
        padding: 16,
    },
    cardPending: {
        backgroundColor: colors.surface,
        borderColor: colors.borderStrong,
    },
    cardComplete: {
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
    },
    headerRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 10,
    },
    statusDot: {
        borderRadius: 6,
        height: 12,
        width: 12,
    },
    statusDotPending: {
        backgroundColor: colors.amber,
    },
    statusDotComplete: {
        backgroundColor: colors.green,
    },
    headerCopy: {
        flex: 1,
    },
    eyebrow: {
        color: colors.amberDark,
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.8,
    },
    heading: {
        color: colors.text,
        fontSize: 17,
        fontWeight: '800',
    },
    description: {
        color: colors.secondary,
        fontSize: 14,
        lineHeight: 20,
        marginVertical: 10,
    },
    diagramCard: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 10,
        borderWidth: 1,
        marginBottom: 16,
        padding: 12,
    },
    diagramTitle: {
        color: colors.text,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    diagramVisual: {
        alignItems: 'center',
        height: 140,
        justifyContent: 'center',
        marginVertical: 4,
    },
    exclusionCircle: {
        alignItems: 'center',
        borderColor: colors.amber,
        borderRadius: 65,
        borderStyle: 'dashed',
        borderWidth: 2,
        height: 130,
        justifyContent: 'center',
        position: 'relative',
        width: 130,
    },
    exclusionLabel: {
        bottom: 6,
        color: colors.amberDark,
        fontSize: 9,
        fontWeight: '800',
        position: 'absolute',
    },
    cranePlacement: {
        alignItems: 'center',
        backgroundColor: colors.amberSoft,
        borderColor: colors.amberBorder,
        borderRadius: 6,
        borderWidth: 1,
        height: 36,
        justifyContent: 'center',
        width: 54,
    },
    cranePlacementText: {
        color: colors.amberDark,
        fontSize: 10,
        fontWeight: '900',
    },
    padDot: {
        alignItems: 'center',
        backgroundColor: colors.blueSoft,
        borderColor: colors.blueBorder,
        borderRadius: 4,
        borderWidth: 1,
        height: 18,
        justifyContent: 'center',
        position: 'absolute',
        width: 18,
    },
    padText: {
        color: colors.blueDark,
        fontSize: 8,
        fontWeight: '900',
    },
    padFL: { top: 12, left: 16 },
    padFR: { top: 12, right: 16 },
    padRL: { bottom: 22, left: 16 },
    padRR: { bottom: 22, right: 16 },
    diagramLegend: {
        borderTopColor: colors.border,
        borderTopWidth: 1,
        gap: 4,
        marginTop: 8,
        paddingTop: 8,
    },
    legendItem: {
        color: colors.secondary,
        fontSize: 12,
        fontWeight: '600',
    },
    sectionHeader: {
        color: colors.muted,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.8,
        marginBottom: 8,
        marginTop: 10,
    },
    hazardList: {
        gap: 8,
        marginBottom: 12,
    },
    hazardRow: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 12,
        minHeight: 52,
        padding: 10,
    },
    hazardRowMitigated: {
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
    },
    hazardTextGroup: {
        flex: 1,
    },
    hazardTitleRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    hazardTitle: {
        color: colors.text,
        flex: 1,
        fontSize: 13,
        fontWeight: '800',
    },
    hazardSeverity: {
        borderRadius: 4,
        fontSize: 9,
        fontWeight: '900',
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    severityCritical: {
        backgroundColor: colors.redSoft,
        color: colors.redDark,
    },
    severityWarning: {
        backgroundColor: colors.warningSoft,
        color: colors.warningDark,
    },
    hazardDescription: {
        color: colors.secondary,
        fontSize: 12,
        lineHeight: 16,
        marginTop: 2,
    },
    checklist: {
        gap: 8,
        marginBottom: 16,
    },
    checkRow: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 12,
        minHeight: 52,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    checkRowChecked: {
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
    },
    checkbox: {
        alignItems: 'center',
        borderColor: colors.borderStrong,
        borderRadius: 6,
        borderWidth: 2,
        height: 24,
        justifyContent: 'center',
        width: 24,
    },
    checkboxChecked: {
        backgroundColor: colors.green,
        borderColor: colors.green,
    },
    checkMark: {
        color: colors.white,
        fontSize: 14,
        fontWeight: '900',
    },
    checkTextGroup: {
        flex: 1,
    },
    checkLabel: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '800',
    },
    checkDetail: {
        color: colors.secondary,
        fontSize: 12,
        lineHeight: 16,
        marginTop: 2,
    },
    verifyButton: {
        backgroundColor: colors.amber,
        minHeight: 48,
        width: '100%',
    },
    verifyButtonDisabled: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderWidth: 1,
    },
    verifyButtonTextDisabled: {
        color: colors.muted,
    },
    pressed: {
        opacity: 0.78,
    },
});
