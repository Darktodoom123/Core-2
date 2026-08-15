import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
                            <Icon name="check" size={14} color="#ffffff" />
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
                            <Icon name="check" size={14} color="#ffffff" />
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
                            <Icon name="check" size={14} color="#ffffff" />
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
                            <Icon name="check" size={14} color="#ffffff" />
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
                        styles.confirmButton,
                        !allChecked && styles.confirmButtonDisabled,
                        pressed && allChecked && styles.pressed,
                    ]}
                    testID="confirm-parked-secured-btn"
                >
                    <Icon
                        name="check"
                        size={18}
                        color={allChecked ? '#0f172a' : colors.muted}
                    />
                    <Text
                        style={[
                            styles.confirmButtonText,
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
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 1.5,
        marginBottom: 16,
        padding: 18,
        ...shadows.md,
    },
    cardPending: {
        borderColor: colors.amberBorder,
    },
    cardConfirmed: {
        borderColor: colors.greenBorder,
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
        fontWeight: '700',
        letterSpacing: 0.6,
    },
    heading: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: -0.2,
    },
    description: {
        color: colors.secondary,
        fontSize: 13,
        lineHeight: 19,
        marginBottom: 14,
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
        padding: 12,
    },
    checkRowChecked: {
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
    },
    checkbox: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.borderStrong,
        borderRadius: 6,
        borderWidth: 1.5,
        height: 22,
        justifyContent: 'center',
        width: 22,
    },
    checkboxChecked: {
        backgroundColor: colors.green,
        borderColor: colors.green,
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
    checkDetail: {
        color: colors.secondary,
        fontSize: 12,
        lineHeight: 16,
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
    confirmButtonDisabled: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderWidth: 1,
    },
    confirmButtonText: {
        color: '#0f172a',
        fontSize: 14,
        fontWeight: '700',
    },
    confirmButtonTextDisabled: {
        color: colors.muted,
    },
    pressed: {
        opacity: 0.78,
        transform: [{ scale: 0.985 }],
    },
});
