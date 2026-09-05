import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import type {
    CraneHazardItem,
    CraneSetupSafetyChecklist,
    CraneSetupState,
} from '../../types/index';
import { Icon } from '../common/Icon';
import { colors, shadows } from '../nativeStyles';

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
    const { isDarkHud } = useTheme();

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
                isDarkHud && styles.darkCard,
                isSetupComplete ? styles.cardComplete : styles.cardPending,
                isDarkHud && isSetupComplete && styles.darkCardComplete,
            ]}
            testID={testID}
        >
            {/* Completion Banner */}
            {isSetupComplete ? (
                <View
                    style={[
                        styles.verifiedBanner,
                        isDarkHud && styles.darkVerifiedBanner,
                    ]}
                >
                    <Icon
                        color={isDarkHud ? '#34D399' : colors.greenDark}
                        name="shield-check"
                        size={16}
                    />
                    <Text
                        style={[
                            styles.verifiedBannerText,
                            isDarkHud && styles.darkVerifiedBannerText,
                        ]}
                    >
                        SAFETY GATE VERIFIED · LIFTING CONTROLS UNLOCKED
                    </Text>
                </View>
            ) : null}

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
                    <Text
                        style={[
                            styles.eyebrow,
                            isDarkHud && styles.darkEyebrow,
                        ]}
                    >
                        CRANE SAFETY GATE
                    </Text>
                    <Text
                        accessibilityRole="header"
                        style={[
                            styles.heading,
                            isDarkHud && styles.darkHeading,
                        ]}
                    >
                        Setup & Exclusion Zone Verification
                    </Text>
                </View>
            </View>

            <Text
                style={[
                    styles.description,
                    isDarkHud && styles.darkDescription,
                ]}
            >
                {isSetupComplete
                    ? 'Crane setup, hazard mitigations, and exclusion zone safety checks verified. Operational lifting controls are active.'
                    : 'Mandatory pre-operation safety verification. Complete all hazard checks and outrigger verifications before initiating lifting operations.'}
            </Text>

            {/* Site Setup Diagram Card */}
            <View
                style={[
                    styles.diagramCard,
                    isDarkHud && styles.darkDiagramCard,
                ]}
                testID="site-setup-diagram"
            >
                <View style={styles.diagramHeaderRow}>
                    <Icon
                        color={isDarkHud ? colors.hudAmber : colors.amber}
                        name="compass"
                        size={14}
                    />
                    <Text
                        style={[
                            styles.diagramTitle,
                            isDarkHud && styles.darkDiagramTitle,
                        ]}
                    >
                        SITE SETUP MAP & EXCLUSION ZONE
                    </Text>
                </View>

                <View style={styles.diagramVisual}>
                    <View
                        style={[
                            styles.exclusionCircle,
                            isDarkHud && styles.darkExclusionCircle,
                        ]}
                    >
                        {/* Radial guidelines */}
                        <View
                            style={[
                                styles.radialGuideH,
                                isDarkHud && styles.darkRadialGuide,
                            ]}
                        />
                        <View
                            style={[
                                styles.radialGuideV,
                                isDarkHud && styles.darkRadialGuide,
                            ]}
                        />

                        {/* Outrigger Beams */}
                        <View
                            style={[
                                styles.outriggerBeam,
                                styles.beamFL,
                                isDarkHud && styles.darkOutriggerBeam,
                            ]}
                        />
                        <View
                            style={[
                                styles.outriggerBeam,
                                styles.beamFR,
                                isDarkHud && styles.darkOutriggerBeam,
                            ]}
                        />
                        <View
                            style={[
                                styles.outriggerBeam,
                                styles.beamRL,
                                isDarkHud && styles.darkOutriggerBeam,
                            ]}
                        />
                        <View
                            style={[
                                styles.outriggerBeam,
                                styles.beamRR,
                                isDarkHud && styles.darkOutriggerBeam,
                            ]}
                        />

                        {/* Crane Center Placement */}
                        <View
                            style={[
                                styles.cranePlacement,
                                isDarkHud && styles.darkCranePlacement,
                            ]}
                        >
                            <Icon
                                color={
                                    isDarkHud
                                        ? colors.hudAmber
                                        : colors.amberDark
                                }
                                name="crane"
                                size={12}
                            />
                            <Text
                                style={[
                                    styles.cranePlacementText,
                                    isDarkHud && styles.darkCranePlacementText,
                                ]}
                            >
                                CRANE
                            </Text>
                        </View>

                        {/* 4 Outrigger Pad Indicators */}
                        <View
                            style={[
                                styles.padDot,
                                styles.padFL,
                                isDarkHud && styles.darkPadDot,
                            ]}
                        >
                            <View style={styles.padLed} />
                            <Text
                                style={[
                                    styles.padText,
                                    isDarkHud && styles.darkPadText,
                                ]}
                            >
                                FL
                            </Text>
                        </View>

                        <View
                            style={[
                                styles.padDot,
                                styles.padFR,
                                isDarkHud && styles.darkPadDot,
                            ]}
                        >
                            <View style={styles.padLed} />
                            <Text
                                style={[
                                    styles.padText,
                                    isDarkHud && styles.darkPadText,
                                ]}
                            >
                                FR
                            </Text>
                        </View>

                        <View
                            style={[
                                styles.padDot,
                                styles.padRL,
                                isDarkHud && styles.darkPadDot,
                            ]}
                        >
                            <View style={styles.padLed} />
                            <Text
                                style={[
                                    styles.padText,
                                    isDarkHud && styles.darkPadText,
                                ]}
                            >
                                RL
                            </Text>
                        </View>

                        <View
                            style={[
                                styles.padDot,
                                styles.padRR,
                                isDarkHud && styles.darkPadDot,
                            ]}
                        >
                            <View style={styles.padLed} />
                            <Text
                                style={[
                                    styles.padText,
                                    isDarkHud && styles.darkPadText,
                                ]}
                            >
                                RR
                            </Text>
                        </View>

                        <Text
                            style={[
                                styles.exclusionLabel,
                                isDarkHud && styles.darkExclusionLabel,
                            ]}
                        >
                            15m Exclusion Zone
                        </Text>
                    </View>
                </View>

                <View
                    style={[
                        styles.diagramLegend,
                        isDarkHud && styles.darkDiagramLegend,
                    ]}
                >
                    <View style={styles.legendRow}>
                        <Icon
                            color={
                                isDarkHud ? colors.hudAmber : colors.amberDark
                            }
                            name="alert"
                            size={14}
                        />
                        <Text
                            style={[
                                styles.legendItem,
                                isDarkHud && styles.darkLegendItem,
                            ]}
                        >
                            Power Line: 8.5m clearance
                        </Text>
                    </View>
                    <View style={styles.legendRow}>
                        <Icon
                            color={isDarkHud ? '#60A5FA' : colors.blueDark}
                            name="speed"
                            size={14}
                        />
                        <Text
                            style={[
                                styles.legendItem,
                                isDarkHud && styles.darkLegendItem,
                            ]}
                        >
                            Current Wind: 14 km/h (Limit: 38 km/h)
                        </Text>
                    </View>
                </View>
            </View>

            {/* Identified Hazards Section */}
            <Text
                accessibilityRole="header"
                style={[
                    styles.sectionHeader,
                    isDarkHud && styles.darkSectionHeader,
                ]}
            >
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
                            isDarkHud && styles.darkHazardRow,
                            hazard.isMitigated && styles.hazardRowMitigated,
                            isDarkHud &&
                                hazard.isMitigated &&
                                styles.darkHazardRowMitigated,
                            pressed && !isSetupComplete && styles.pressed,
                        ]}
                        testID={`hazard-item-${hazard.id}`}
                    >
                        <View
                            style={[
                                styles.checkbox,
                                isDarkHud && styles.darkCheckbox,
                                hazard.isMitigated && styles.checkboxChecked,
                                isDarkHud &&
                                    hazard.isMitigated &&
                                    styles.darkCheckboxChecked,
                            ]}
                        >
                            {hazard.isMitigated ? (
                                <Icon color="#ffffff" name="check" size={14} />
                            ) : null}
                        </View>
                        <View style={styles.hazardTextGroup}>
                            <View style={styles.hazardTitleRow}>
                                <Text
                                    style={[
                                        styles.hazardTitle,
                                        isDarkHud && styles.darkHazardTitle,
                                    ]}
                                >
                                    {hazard.title}
                                </Text>
                                <Text
                                    style={[
                                        styles.hazardSeverity,
                                        hazard.severity === 'critical'
                                            ? styles.severityCritical
                                            : styles.severityWarning,
                                        isDarkHud &&
                                            hazard.severity === 'critical' &&
                                            styles.darkSeverityCritical,
                                        isDarkHud &&
                                            hazard.severity === 'warning' &&
                                            styles.darkSeverityWarning,
                                    ]}
                                >
                                    {hazard.severity.toUpperCase()}
                                </Text>
                            </View>
                            <Text
                                style={[
                                    styles.hazardDescription,
                                    isDarkHud && styles.darkHazardDescription,
                                ]}
                            >
                                {hazard.description}
                            </Text>
                        </View>
                    </Pressable>
                ))}
            </View>

            {/* Mandatory Safety Verification Checklist */}
            <Text
                accessibilityRole="header"
                style={[
                    styles.sectionHeader,
                    isDarkHud && styles.darkSectionHeader,
                ]}
            >
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
                        isDarkHud && styles.darkCheckRow,
                        checklist.groundBearingVerified &&
                            styles.checkRowChecked,
                        isDarkHud &&
                            checklist.groundBearingVerified &&
                            styles.darkCheckRowChecked,
                        pressed && !isSetupComplete && styles.pressed,
                    ]}
                    testID="setup-check-ground"
                >
                    <View
                        style={[
                            styles.checkbox,
                            isDarkHud && styles.darkCheckbox,
                            checklist.groundBearingVerified &&
                                styles.checkboxChecked,
                            isDarkHud &&
                                checklist.groundBearingVerified &&
                                styles.darkCheckboxChecked,
                        ]}
                    >
                        {checklist.groundBearingVerified ? (
                            <Icon color="#ffffff" name="check" size={14} />
                        ) : null}
                    </View>
                    <View style={styles.checkTextGroup}>
                        <Text
                            style={[
                                styles.checkLabel,
                                isDarkHud && styles.darkCheckLabel,
                            ]}
                        >
                            Ground bearing & sole pads
                        </Text>
                        <Text
                            style={[
                                styles.checkDetail,
                                isDarkHud && styles.darkCheckDetail,
                            ]}
                        >
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
                        isDarkHud && styles.darkCheckRow,
                        checklist.outriggersFullyExtended &&
                            styles.checkRowChecked,
                        isDarkHud &&
                            checklist.outriggersFullyExtended &&
                            styles.darkCheckRowChecked,
                        pressed && !isSetupComplete && styles.pressed,
                    ]}
                    testID="setup-check-outriggers"
                >
                    <View
                        style={[
                            styles.checkbox,
                            isDarkHud && styles.darkCheckbox,
                            checklist.outriggersFullyExtended &&
                                styles.checkboxChecked,
                            isDarkHud &&
                                checklist.outriggersFullyExtended &&
                                styles.darkCheckboxChecked,
                        ]}
                    >
                        {checklist.outriggersFullyExtended ? (
                            <Icon color="#ffffff" name="check" size={14} />
                        ) : null}
                    </View>
                    <View style={styles.checkTextGroup}>
                        <Text
                            style={[
                                styles.checkLabel,
                                isDarkHud && styles.darkCheckLabel,
                            ]}
                        >
                            Outriggers 100% extended
                        </Text>
                        <Text
                            style={[
                                styles.checkDetail,
                                isDarkHud && styles.darkCheckDetail,
                            ]}
                        >
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
                        isDarkHud && styles.darkCheckRow,
                        checklist.levelBubbleCentered && styles.checkRowChecked,
                        isDarkHud &&
                            checklist.levelBubbleCentered &&
                            styles.darkCheckRowChecked,
                        pressed && !isSetupComplete && styles.pressed,
                    ]}
                    testID="setup-check-level"
                >
                    <View
                        style={[
                            styles.checkbox,
                            isDarkHud && styles.darkCheckbox,
                            checklist.levelBubbleCentered &&
                                styles.checkboxChecked,
                            isDarkHud &&
                                checklist.levelBubbleCentered &&
                                styles.darkCheckboxChecked,
                        ]}
                    >
                        {checklist.levelBubbleCentered ? (
                            <Icon color="#ffffff" name="check" size={14} />
                        ) : null}
                    </View>
                    <View style={styles.checkTextGroup}>
                        <Text
                            style={[
                                styles.checkLabel,
                                isDarkHud && styles.darkCheckLabel,
                            ]}
                        >
                            Crane level indicator centered
                        </Text>
                        <Text
                            style={[
                                styles.checkDetail,
                                isDarkHud && styles.darkCheckDetail,
                            ]}
                        >
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
                        isDarkHud && styles.darkCheckRow,
                        checklist.powerLineClearanceVerified &&
                            styles.checkRowChecked,
                        isDarkHud &&
                            checklist.powerLineClearanceVerified &&
                            styles.darkCheckRowChecked,
                        pressed && !isSetupComplete && styles.pressed,
                    ]}
                    testID="setup-check-powerline"
                >
                    <View
                        style={[
                            styles.checkbox,
                            isDarkHud && styles.darkCheckbox,
                            checklist.powerLineClearanceVerified &&
                                styles.checkboxChecked,
                            isDarkHud &&
                                checklist.powerLineClearanceVerified &&
                                styles.darkCheckboxChecked,
                        ]}
                    >
                        {checklist.powerLineClearanceVerified ? (
                            <Icon color="#ffffff" name="check" size={14} />
                        ) : null}
                    </View>
                    <View style={styles.checkTextGroup}>
                        <Text
                            style={[
                                styles.checkLabel,
                                isDarkHud && styles.darkCheckLabel,
                            ]}
                        >
                            Power line clearance verified
                        </Text>
                        <Text
                            style={[
                                styles.checkDetail,
                                isDarkHud && styles.darkCheckDetail,
                            ]}
                        >
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
                        isDarkHud && styles.darkCheckRow,
                        checklist.exclusionZoneBarricaded &&
                            styles.checkRowChecked,
                        isDarkHud &&
                            checklist.exclusionZoneBarricaded &&
                            styles.darkCheckRowChecked,
                        pressed && !isSetupComplete && styles.pressed,
                    ]}
                    testID="setup-check-barricade"
                >
                    <View
                        style={[
                            styles.checkbox,
                            isDarkHud && styles.darkCheckbox,
                            checklist.exclusionZoneBarricaded &&
                                styles.checkboxChecked,
                            isDarkHud &&
                                checklist.exclusionZoneBarricaded &&
                                styles.darkCheckboxChecked,
                        ]}
                    >
                        {checklist.exclusionZoneBarricaded ? (
                            <Icon color="#ffffff" name="check" size={14} />
                        ) : null}
                    </View>
                    <View style={styles.checkTextGroup}>
                        <Text
                            style={[
                                styles.checkLabel,
                                isDarkHud && styles.darkCheckLabel,
                            ]}
                        >
                            Exclusion zone barricaded
                        </Text>
                        <Text
                            style={[
                                styles.checkDetail,
                                isDarkHud && styles.darkCheckDetail,
                            ]}
                        >
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
                        isDarkHud && styles.darkCheckRow,
                        checklist.windSpeedChecked && styles.checkRowChecked,
                        isDarkHud &&
                            checklist.windSpeedChecked &&
                            styles.darkCheckRowChecked,
                        pressed && !isSetupComplete && styles.pressed,
                    ]}
                    testID="setup-check-wind"
                >
                    <View
                        style={[
                            styles.checkbox,
                            isDarkHud && styles.darkCheckbox,
                            checklist.windSpeedChecked &&
                                styles.checkboxChecked,
                            isDarkHud &&
                                checklist.windSpeedChecked &&
                                styles.darkCheckboxChecked,
                        ]}
                    >
                        {checklist.windSpeedChecked ? (
                            <Icon color="#ffffff" name="check" size={14} />
                        ) : null}
                    </View>
                    <View style={styles.checkTextGroup}>
                        <Text
                            style={[
                                styles.checkLabel,
                                isDarkHud && styles.darkCheckLabel,
                            ]}
                        >
                            Wind speed within chart limits
                        </Text>
                        <Text
                            style={[
                                styles.checkDetail,
                                isDarkHud && styles.darkCheckDetail,
                            ]}
                        >
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
                        styles.verifyButton,
                        isDarkHud && styles.darkVerifyButton,
                        !allChecksVerified && styles.verifyButtonDisabled,
                        isDarkHud &&
                            !allChecksVerified &&
                            styles.darkVerifyButtonDisabled,
                        pressed && allChecksVerified && styles.pressed,
                    ]}
                    testID="verify-crane-setup-btn"
                >
                    <Icon
                        color={
                            allChecksVerified
                                ? isDarkHud
                                    ? colors.surfaceDark
                                    : '#FFFFFF'
                                : colors.muted
                        }
                        name="check"
                        size={18}
                    />
                    <Text
                        style={[
                            styles.verifyButtonText,
                            isDarkHud && styles.darkVerifyButtonText,
                            !allChecksVerified &&
                                styles.verifyButtonTextDisabled,
                            isDarkHud &&
                                !allChecksVerified &&
                                styles.darkVerifyButtonTextDisabled,
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
        borderRadius: 16,
        borderWidth: 1.5,
        marginBottom: 16,
        padding: 18,
        ...shadows.md,
    },
    darkCard: {
        backgroundColor: colors.hudSurface,
        borderColor: colors.hudBorder,
        shadowColor: 'transparent',
    },
    cardPending: {
        backgroundColor: colors.surface,
        borderColor: colors.borderStrong,
    },
    cardComplete: {
        backgroundColor: colors.surface,
        borderColor: colors.green,
    },
    darkCardComplete: {
        backgroundColor: colors.hudSurface,
        borderColor: '#059669',
    },
    verifiedBanner: {
        alignItems: 'center',
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
        borderRadius: 8,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 8,
        marginBottom: 14,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    darkVerifiedBanner: {
        backgroundColor: 'rgba(5, 150, 105, 0.2)',
        borderColor: '#059669',
    },
    verifiedBannerText: {
        color: colors.greenDark,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    darkVerifiedBannerText: {
        color: '#34D399',
    },
    headerRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 10,
        marginBottom: 8,
    },
    statusDot: {
        borderRadius: 5,
        height: 10,
        width: 10,
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
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.6,
    },
    darkEyebrow: {
        color: colors.hudAmber,
    },
    heading: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: -0.2,
    },
    darkHeading: {
        color: colors.hudText,
    },
    description: {
        color: colors.secondary,
        fontSize: 13,
        lineHeight: 19,
        marginBottom: 14,
    },
    darkDescription: {
        color: colors.hudTextDim,
    },
    diagramCard: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 16,
        padding: 14,
    },
    darkDiagramCard: {
        backgroundColor: colors.surfaceDark,
        borderColor: colors.hudBorder,
    },
    diagramHeaderRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6,
        marginBottom: 10,
    },
    diagramTitle: {
        color: colors.text,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    darkDiagramTitle: {
        color: colors.hudText,
    },
    diagramVisual: {
        alignItems: 'center',
        height: 160,
        justifyContent: 'center',
        marginVertical: 4,
    },
    exclusionCircle: {
        alignItems: 'center',
        borderColor: colors.amber,
        borderRadius: 75,
        borderStyle: 'dashed',
        borderWidth: 1.5,
        height: 150,
        justifyContent: 'center',
        position: 'relative',
        width: 150,
    },
    darkExclusionCircle: {
        borderColor: colors.hudAmber,
    },
    radialGuideH: {
        backgroundColor: 'rgba(217, 119, 6, 0.2)',
        height: 1,
        left: 10,
        position: 'absolute',
        right: 10,
    },
    radialGuideV: {
        backgroundColor: 'rgba(217, 119, 6, 0.2)',
        bottom: 10,
        position: 'absolute',
        top: 10,
        width: 1,
    },
    darkRadialGuide: {
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
    },
    outriggerBeam: {
        backgroundColor: 'rgba(217, 119, 6, 0.35)',
        position: 'absolute',
    },
    darkOutriggerBeam: {
        backgroundColor: 'rgba(245, 158, 11, 0.45)',
    },
    beamFL: {
        height: 2,
        left: 26,
        top: 32,
        transform: [{ rotate: '45deg' }],
        width: 32,
    },
    beamFR: {
        height: 2,
        right: 26,
        top: 32,
        transform: [{ rotate: '-45deg' }],
        width: 32,
    },
    beamRL: {
        bottom: 40,
        height: 2,
        left: 26,
        transform: [{ rotate: '-45deg' }],
        width: 32,
    },
    beamRR: {
        bottom: 40,
        height: 2,
        right: 26,
        transform: [{ rotate: '45deg' }],
        width: 32,
    },
    cranePlacement: {
        alignItems: 'center',
        backgroundColor: colors.amberSoft,
        borderColor: colors.amberBorder,
        borderRadius: 8,
        borderWidth: 1,
        height: 40,
        justifyContent: 'center',
        width: 58,
        zIndex: 2,
    },
    darkCranePlacement: {
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        borderColor: colors.hudAmber,
    },
    cranePlacementText: {
        color: colors.amberDark,
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    darkCranePlacementText: {
        color: colors.hudAmber,
    },
    padDot: {
        alignItems: 'center',
        backgroundColor: colors.blueSoft,
        borderColor: colors.blueBorder,
        borderRadius: 6,
        borderWidth: 1,
        height: 24,
        justifyContent: 'center',
        position: 'absolute',
        width: 24,
        zIndex: 3,
    },
    darkPadDot: {
        backgroundColor: 'rgba(37, 99, 235, 0.25)',
        borderColor: '#3B82F6',
    },
    padLed: {
        backgroundColor: '#10B981',
        borderRadius: 2,
        height: 3,
        position: 'absolute',
        top: 2,
        width: 8,
    },
    padText: {
        color: colors.blueDark,
        fontSize: 9,
        fontWeight: '900',
        marginTop: 2,
    },
    darkPadText: {
        color: '#93C5FD',
    },
    padFL: { top: 12, left: 14 },
    padFR: { top: 12, right: 14 },
    padRL: { bottom: 26, left: 14 },
    padRR: { bottom: 26, right: 14 },
    exclusionLabel: {
        bottom: 6,
        color: colors.amberDark,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.3,
        position: 'absolute',
    },
    darkExclusionLabel: {
        color: colors.hudAmber,
    },
    diagramLegend: {
        borderTopColor: colors.border,
        borderTopWidth: 1,
        gap: 6,
        marginTop: 8,
        paddingTop: 8,
    },
    darkDiagramLegend: {
        borderTopColor: colors.hudBorder,
    },
    legendRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6,
    },
    legendItem: {
        color: colors.secondary,
        fontSize: 12,
        fontWeight: '600',
    },
    darkLegendItem: {
        color: colors.hudTextDim,
    },
    sectionHeader: {
        color: colors.muted,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.6,
        marginBottom: 8,
        marginTop: 10,
    },
    darkSectionHeader: {
        color: colors.hudTextDim,
    },
    hazardList: {
        gap: 8,
        marginBottom: 14,
    },
    hazardRow: {
        alignItems: 'flex-start',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 12,
        minHeight: 52,
        padding: 12,
    },
    darkHazardRow: {
        backgroundColor: colors.hudSurface,
        borderColor: colors.hudBorder,
    },
    hazardRowMitigated: {
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
    },
    darkHazardRowMitigated: {
        backgroundColor: 'rgba(5, 150, 105, 0.15)',
        borderColor: '#059669',
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
        fontWeight: '700',
    },
    darkHazardTitle: {
        color: colors.hudText,
    },
    hazardSeverity: {
        borderRadius: 6,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.4,
        paddingHorizontal: 7,
        paddingVertical: 3,
    },
    severityCritical: {
        backgroundColor: colors.redSoft,
        color: colors.redDark,
    },
    darkSeverityCritical: {
        backgroundColor: 'rgba(239, 68, 68, 0.25)',
        color: '#F87171',
    },
    severityWarning: {
        backgroundColor: colors.warningSoft,
        color: colors.warningDark,
    },
    darkSeverityWarning: {
        backgroundColor: 'rgba(245, 158, 11, 0.25)',
        color: colors.hudAmber,
    },
    hazardDescription: {
        color: colors.secondary,
        fontSize: 12,
        lineHeight: 16,
        marginTop: 4,
    },
    darkHazardDescription: {
        color: colors.hudTextDim,
    },
    checklist: {
        gap: 8,
        marginBottom: 16,
    },
    checkRow: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 12,
        minHeight: 52,
        padding: 12,
    },
    darkCheckRow: {
        backgroundColor: colors.hudSurface,
        borderColor: colors.hudBorder,
    },
    checkRowChecked: {
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
    },
    darkCheckRowChecked: {
        backgroundColor: 'rgba(5, 150, 105, 0.15)',
        borderColor: '#059669',
    },
    checkbox: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.borderStrong,
        borderRadius: 6,
        borderWidth: 1.5,
        height: 24,
        justifyContent: 'center',
        width: 24,
    },
    darkCheckbox: {
        backgroundColor: colors.surfaceDark,
        borderColor: colors.hudBorder,
    },
    checkboxChecked: {
        backgroundColor: colors.green,
        borderColor: colors.green,
    },
    darkCheckboxChecked: {
        backgroundColor: '#10B981',
        borderColor: '#10B981',
    },
    checkTextGroup: {
        flex: 1,
        gap: 2,
    },
    checkLabel: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '700',
    },
    darkCheckLabel: {
        color: colors.hudText,
    },
    checkDetail: {
        color: colors.secondary,
        fontSize: 12,
        lineHeight: 16,
    },
    darkCheckDetail: {
        color: colors.hudTextDim,
    },
    verifyButton: {
        alignItems: 'center',
        backgroundColor: colors.amber,
        borderRadius: 12,
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
        marginTop: 8,
        minHeight: 48,
        paddingHorizontal: 16,
        ...shadows.sm,
    },
    darkVerifyButton: {
        backgroundColor: colors.hudAmber,
    },
    verifyButtonDisabled: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderWidth: 1,
    },
    darkVerifyButtonDisabled: {
        backgroundColor: colors.surfaceDark,
        borderColor: colors.hudBorder,
    },
    verifyButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
    },
    darkVerifyButtonText: {
        color: colors.surfaceDark,
    },
    verifyButtonTextDisabled: {
        color: colors.muted,
    },
    darkVerifyButtonTextDisabled: {
        color: colors.hudTextDim,
    },
    pressed: {
        opacity: 0.82,
        transform: [{ scale: 0.985 }],
    },
});
