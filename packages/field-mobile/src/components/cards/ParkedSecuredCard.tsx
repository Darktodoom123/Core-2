import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type {
    ParkedSecuredChecklist,
    ParkedSecuredState,
} from '../../types/index';
import { colors, sharedStyles } from '../nativeStyles';

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
                isConfirmed ? styles.cardConfirmed : styles.cardPending,
            ]}
            testID={testID}
        >
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
                    <Text style={styles.eyebrow}>
                        {isConfirmed
                            ? 'SAFETY VERIFIED'
                            : 'ACTION REQUIRED UPON ARRIVAL'}
                    </Text>
                    <Text accessibilityRole="header" style={styles.heading}>
                        Parked & Secured Confirmation
                    </Text>
                </View>
            </View>

            <Text style={styles.description}>
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
                        checklist.parkingBrakeEngaged && styles.checkRowChecked,
                        pressed && !isConfirmed && styles.pressed,
                    ]}
                    testID="parked-check-brake"
                >
                    <View
                        style={[
                            styles.checkbox,
                            checklist.parkingBrakeEngaged &&
                                styles.checkboxChecked,
                        ]}
                    >
                        {checklist.parkingBrakeEngaged ? (
                            <Text style={styles.checkMark}>✓</Text>
                        ) : null}
                    </View>
                    <View style={styles.checkTextGroup}>
                        <Text style={styles.checkLabel}>
                            Parking brake engaged
                        </Text>
                        <Text style={styles.checkDetail}>
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
                        checklist.wheelChocksDeployed && styles.checkRowChecked,
                        pressed && !isConfirmed && styles.pressed,
                    ]}
                    testID="parked-check-chocks"
                >
                    <View
                        style={[
                            styles.checkbox,
                            checklist.wheelChocksDeployed &&
                                styles.checkboxChecked,
                        ]}
                    >
                        {checklist.wheelChocksDeployed ? (
                            <Text style={styles.checkMark}>✓</Text>
                        ) : null}
                    </View>
                    <View style={styles.checkTextGroup}>
                        <Text style={styles.checkLabel}>
                            Wheel chocks deployed
                        </Text>
                        <Text style={styles.checkDetail}>
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
                        checklist.hazardBeaconsActive && styles.checkRowChecked,
                        pressed && !isConfirmed && styles.pressed,
                    ]}
                    testID="parked-check-beacons"
                >
                    <View
                        style={[
                            styles.checkbox,
                            checklist.hazardBeaconsActive &&
                                styles.checkboxChecked,
                        ]}
                    >
                        {checklist.hazardBeaconsActive ? (
                            <Text style={styles.checkMark}>✓</Text>
                        ) : null}
                    </View>
                    <View style={styles.checkTextGroup}>
                        <Text style={styles.checkLabel}>
                            Hazard beacons active
                        </Text>
                        <Text style={styles.checkDetail}>
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
                        checklist.surfaceAssessed && styles.checkRowChecked,
                        pressed && !isConfirmed && styles.pressed,
                    ]}
                    testID="parked-check-surface"
                >
                    <View
                        style={[
                            styles.checkbox,
                            checklist.surfaceAssessed && styles.checkboxChecked,
                        ]}
                    >
                        {checklist.surfaceAssessed ? (
                            <Text style={styles.checkMark}>✓</Text>
                        ) : null}
                    </View>
                    <View style={styles.checkTextGroup}>
                        <Text style={styles.checkLabel}>
                            Surface positioning verified
                        </Text>
                        <Text style={styles.checkDetail}>
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
                        sharedStyles.button,
                        styles.confirmButton,
                        !allChecked && styles.confirmButtonDisabled,
                        pressed && allChecked && styles.pressed,
                    ]}
                    testID="confirm-parked-secured-btn"
                >
                    <Text
                        style={[
                            sharedStyles.buttonText,
                            !allChecked && styles.confirmButtonTextDisabled,
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
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 16,
        padding: 16,
    },
    cardPending: {
        backgroundColor: colors.warningLight,
        borderColor: colors.warningBorder,
    },
    cardConfirmed: {
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
    },
    headingRow: {
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
        backgroundColor: colors.warning,
    },
    statusDotConfirmed: {
        backgroundColor: colors.green,
    },
    headingCopy: {
        flex: 1,
    },
    eyebrow: {
        color: colors.warningDark,
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
    checklist: {
        gap: 8,
        marginVertical: 10,
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
    confirmButton: {
        backgroundColor: colors.amber,
        marginTop: 8,
        minHeight: 48,
        width: '100%',
    },
    confirmButtonDisabled: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderWidth: 1,
    },
    confirmButtonTextDisabled: {
        color: colors.muted,
    },
    pressed: {
        opacity: 0.78,
    },
});
