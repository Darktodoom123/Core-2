import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import type {
    ParkedSecuredChecklist,
    ParkedSecuredState,
} from '../../types/index';
import { Icon } from '../common/Icon';
import { colors, shadows } from '../nativeStyles';

export interface ParkedSecuredCardProps {
    isArrived: boolean;
    state?: ParkedSecuredState | null;
    onConfirm: (checklist: ParkedSecuredChecklist) => void;
    testID?: string;
}

export const ParkedSecuredCard: React.FC<ParkedSecuredCardProps> = ({
    isArrived,
    state,
    onConfirm,
    testID = 'parked-secured-card',
}) => {
    const { isDarkHud } = useTheme();

    const [checklist, setChecklist] = useState<ParkedSecuredChecklist>({
        parkingBrakeEngaged: state?.checklist.parkingBrakeEngaged ?? false,
        wheelChocksDeployed: state?.checklist.wheelChocksDeployed ?? false,
        hazardBeaconsActive: state?.checklist.hazardBeaconsActive ?? false,
        surfaceAssessed: state?.checklist.surfaceAssessed ?? false,
    });

    if (!isArrived) {
        return null;
    }

    const isConfirmed = Boolean(state?.isConfirmed);
    const allChecked =
        checklist.parkingBrakeEngaged &&
        checklist.wheelChocksDeployed &&
        checklist.hazardBeaconsActive &&
        checklist.surfaceAssessed;

    const toggleItem = (key: keyof ParkedSecuredChecklist) => {
        if (isConfirmed) {
            return;
        }

        setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const handleConfirm = () => {
        if (allChecked) {
            onConfirm(checklist);
        }
    };

    return (
        <View
            style={[
                styles.card,
                isDarkHud && styles.darkCard,
                isConfirmed ? styles.cardConfirmed : styles.cardPending,
                isDarkHud && isConfirmed && styles.darkCardConfirmed,
            ]}
            testID={testID}
        >
            {/* Verified Banner */}
            {isConfirmed ? (
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
                        EQUIPMENT SECURED · SETUP CONTROLS UNLOCKED
                    </Text>
                </View>
            ) : null}

            <View style={styles.headingRow}>
                <View
                    style={[
                        styles.statusDot,
                        isConfirmed
                            ? styles.statusDotConfirmed
                            : styles.statusDotPending,
                    ]}
                />
                <View style={styles.headingCopy}>
                    <Text
                        style={[
                            styles.eyebrow,
                            isDarkHud && styles.darkEyebrow,
                        ]}
                    >
                        {isConfirmed
                            ? 'SAFETY VERIFIED'
                            : 'ACTION REQUIRED UPON ARRIVAL'}
                    </Text>
                    <Text
                        accessibilityRole="header"
                        style={[
                            styles.heading,
                            isDarkHud && styles.darkHeading,
                        ]}
                    >
                        Parked & Secured Confirmation
                    </Text>
                </View>
            </View>

            <Text
                style={[
                    styles.description,
                    isDarkHud && styles.darkDescription,
                ]}
            >
                {isConfirmed
                    ? `Equipment parked and secured verification completed${
                          state?.confirmedAt
                              ? ` at ${new Date(state.confirmedAt).toLocaleTimeString()}`
                              : ''
                      }. Crane setup safety mode is unlocked.`
                    : 'Heavy crane and support vehicle must be fully secured before crane setup or operation controls are unlocked.'}
            </Text>

            <View style={styles.checklist}>
                {/* Item 1: Parking Brake */}
                <Pressable
                    accessibilityLabel="Parking brake engaged and transmission in neutral or park"
                    accessibilityRole="checkbox"
                    accessibilityState={{
                        checked: checklist.parkingBrakeEngaged,
                    }}
                    disabled={isConfirmed}
                    onPress={() => toggleItem('parkingBrakeEngaged')}
                    style={({ pressed }) => [
                        styles.checkRow,
                        isDarkHud && styles.darkCheckRow,
                        checklist.parkingBrakeEngaged && styles.checkRowChecked,
                        isDarkHud &&
                            checklist.parkingBrakeEngaged &&
                            styles.darkCheckRowChecked,
                        pressed && !isConfirmed && styles.pressed,
                    ]}
                    testID="parked-check-brake"
                >
                    <View
                        style={[
                            styles.checkbox,
                            isDarkHud && styles.darkCheckbox,
                            checklist.parkingBrakeEngaged &&
                                styles.checkboxChecked,
                            isDarkHud &&
                                checklist.parkingBrakeEngaged &&
                                styles.darkCheckboxChecked,
                        ]}
                    >
                        {checklist.parkingBrakeEngaged ? (
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
                            Parking brake engaged
                        </Text>
                        <Text
                            style={[
                                styles.checkDetail,
                                isDarkHud && styles.darkCheckDetail,
                            ]}
                        >
                            Air brake locked and transmission set to
                            neutral/park
                        </Text>
                    </View>
                </Pressable>

                {/* Item 2: Wheel Chocks */}
                <Pressable
                    accessibilityLabel="Wheel chocks and ground stabilizers deployed"
                    accessibilityRole="checkbox"
                    accessibilityState={{
                        checked: checklist.wheelChocksDeployed,
                    }}
                    disabled={isConfirmed}
                    onPress={() => toggleItem('wheelChocksDeployed')}
                    style={({ pressed }) => [
                        styles.checkRow,
                        isDarkHud && styles.darkCheckRow,
                        checklist.wheelChocksDeployed && styles.checkRowChecked,
                        isDarkHud &&
                            checklist.wheelChocksDeployed &&
                            styles.darkCheckRowChecked,
                        pressed && !isConfirmed && styles.pressed,
                    ]}
                    testID="parked-check-chocks"
                >
                    <View
                        style={[
                            styles.checkbox,
                            isDarkHud && styles.darkCheckbox,
                            checklist.wheelChocksDeployed &&
                                styles.checkboxChecked,
                            isDarkHud &&
                                checklist.wheelChocksDeployed &&
                                styles.darkCheckboxChecked,
                        ]}
                    >
                        {checklist.wheelChocksDeployed ? (
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
                            Wheel chocks deployed
                        </Text>
                        <Text
                            style={[
                                styles.checkDetail,
                                isDarkHud && styles.darkCheckDetail,
                            ]}
                        >
                            Heavy rubber chocks placed on downhill/both sides of
                            drive axles
                        </Text>
                    </View>
                </Pressable>

                {/* Item 3: Hazard Beacons */}
                <Pressable
                    accessibilityLabel="Hazard warning beacons and perimeter lighting active"
                    accessibilityRole="checkbox"
                    accessibilityState={{
                        checked: checklist.hazardBeaconsActive,
                    }}
                    disabled={isConfirmed}
                    onPress={() => toggleItem('hazardBeaconsActive')}
                    style={({ pressed }) => [
                        styles.checkRow,
                        isDarkHud && styles.darkCheckRow,
                        checklist.hazardBeaconsActive && styles.checkRowChecked,
                        isDarkHud &&
                            checklist.hazardBeaconsActive &&
                            styles.darkCheckRowChecked,
                        pressed && !isConfirmed && styles.pressed,
                    ]}
                    testID="parked-check-beacons"
                >
                    <View
                        style={[
                            styles.checkbox,
                            isDarkHud && styles.darkCheckbox,
                            checklist.hazardBeaconsActive &&
                                styles.checkboxChecked,
                            isDarkHud &&
                                checklist.hazardBeaconsActive &&
                                styles.darkCheckboxChecked,
                        ]}
                    >
                        {checklist.hazardBeaconsActive ? (
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
                            Hazard beacons active
                        </Text>
                        <Text
                            style={[
                                styles.checkDetail,
                                isDarkHud && styles.darkCheckDetail,
                            ]}
                        >
                            High-visibility amber strobe beacons and perimeter
                            markers on
                        </Text>
                    </View>
                </Pressable>

                {/* Item 4: Surface Assessed */}
                <Pressable
                    accessibilityLabel="Surface stability and clearance from excavations assessed"
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: checklist.surfaceAssessed }}
                    disabled={isConfirmed}
                    onPress={() => toggleItem('surfaceAssessed')}
                    style={({ pressed }) => [
                        styles.checkRow,
                        isDarkHud && styles.darkCheckRow,
                        checklist.surfaceAssessed && styles.checkRowChecked,
                        isDarkHud &&
                            checklist.surfaceAssessed &&
                            styles.darkCheckRowChecked,
                        pressed && !isConfirmed && styles.pressed,
                    ]}
                    testID="parked-check-surface"
                >
                    <View
                        style={[
                            styles.checkbox,
                            isDarkHud && styles.darkCheckbox,
                            checklist.surfaceAssessed && styles.checkboxChecked,
                            isDarkHud &&
                                checklist.surfaceAssessed &&
                                styles.darkCheckboxChecked,
                        ]}
                    >
                        {checklist.surfaceAssessed ? (
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
                            Surface positioning verified
                        </Text>
                        <Text
                            style={[
                                styles.checkDetail,
                                isDarkHud && styles.darkCheckDetail,
                            ]}
                        >
                            Firm ground verified; clear of trenches, slopes, and
                            uncompacted soil
                        </Text>
                    </View>
                </Pressable>
            </View>

            {!isConfirmed ? (
                <Pressable
                    accessibilityLabel="Confirm parked and secured"
                    accessibilityRole="button"
                    disabled={!allChecked}
                    onPress={handleConfirm}
                    style={({ pressed }) => [
                        styles.confirmButton,
                        isDarkHud && styles.darkConfirmButton,
                        !allChecked && styles.confirmButtonDisabled,
                        isDarkHud &&
                            !allChecked &&
                            styles.darkConfirmButtonDisabled,
                        pressed && allChecked && styles.pressed,
                    ]}
                    testID="confirm-parked-secured-btn"
                >
                    <Icon
                        color={
                            allChecked
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
                            styles.confirmButtonText,
                            isDarkHud && styles.darkConfirmButtonText,
                            !allChecked && styles.confirmButtonTextDisabled,
                            isDarkHud &&
                                !allChecked &&
                                styles.darkConfirmButtonTextDisabled,
                        ]}
                    >
                        Confirm Parked & Secured
                    </Text>
                </Pressable>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 1.5,
        marginBottom: 16,
        padding: 18,
        ...shadows.md,
    },
    darkCard: {
        backgroundColor: colors.hudSurface,
        shadowColor: 'transparent',
    },
    cardPending: {
        borderColor: colors.amberBorder,
    },
    cardConfirmed: {
        borderColor: colors.green,
    },
    darkCardConfirmed: {
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
    headingRow: {
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
    statusDotConfirmed: {
        backgroundColor: colors.green,
    },
    headingCopy: {
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
    checklist: {
        gap: 8,
    },
    checkRow: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
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
    confirmButton: {
        alignItems: 'center',
        backgroundColor: colors.amber,
        borderRadius: 12,
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
        marginTop: 14,
        minHeight: 48,
        paddingHorizontal: 16,
        ...shadows.sm,
    },
    darkConfirmButton: {
        backgroundColor: colors.hudAmber,
    },
    confirmButtonDisabled: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderWidth: 1,
    },
    darkConfirmButtonDisabled: {
        backgroundColor: colors.surfaceDark,
        borderColor: colors.hudBorder,
    },
    confirmButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
    },
    darkConfirmButtonText: {
        color: colors.surfaceDark,
    },
    confirmButtonTextDisabled: {
        color: colors.muted,
    },
    darkConfirmButtonTextDisabled: {
        color: colors.hudTextDim,
    },
    pressed: {
        opacity: 0.82,
        transform: [{ scale: 0.985 }],
    },
});
