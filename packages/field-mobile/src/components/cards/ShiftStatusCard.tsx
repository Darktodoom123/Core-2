import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ShiftInfo } from '../../types/index';
import { colors } from '../nativeStyles';

export interface ShiftStatusCardProps {
    shiftInfo?: ShiftInfo;
    locationSharingActive?: boolean;
    onToggleLocationSharing?: () => void;
    onToggleShift?: () => void;
}

export const ShiftStatusCard: React.FC<ShiftStatusCardProps> = ({
    shiftInfo = { status: 'on_shift', startedAt: '08:00 AM', hoursElapsed: 4 },
    locationSharingActive = true,
    onToggleLocationSharing,
}) => {
    return (
        <View style={styles.statusStrip} testID="shift-status-strip">
            <View style={styles.shiftCard} testID="shift-status-card">
                <View style={styles.shiftDot} />
                <View style={styles.shiftCopy}>
                    <Text style={styles.shiftLabel}>ACTIVE SHIFT</Text>
                    <Text style={styles.shiftValue}>
                        {shiftInfo.status === 'on_shift'
                            ? `On Shift · ${shiftInfo.hoursElapsed ?? 4}h active`
                            : 'Standby / Break'}
                    </Text>
                </View>
            </View>

            <Pressable
                accessibilityLabel={`Location sharing: ${locationSharingActive ? 'Active transmitting' : 'Paused'}`}
                accessibilityRole="button"
                onPress={onToggleLocationSharing}
                style={({ pressed }) => [
                    styles.locationPill,
                    locationSharingActive ? styles.locActive : styles.locPaused,
                    pressed && styles.pressed,
                ]}
                testID="location-sharing-indicator"
            >
                <View
                    style={[
                        styles.locDot,
                        locationSharingActive
                            ? styles.locDotActive
                            : styles.locDotPaused,
                    ]}
                />
                <Text style={styles.locText}>
                    {locationSharingActive ? 'GPS Sharing: ON' : 'GPS: Paused'}
                </Text>
            </Pressable>
        </View>
    );
};

const styles = StyleSheet.create({
    statusStrip: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
    },
    shiftCard: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 10,
        borderWidth: 1,
        flex: 1,
        flexDirection: 'row',
        gap: 8,
        minHeight: 48,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    shiftDot: {
        backgroundColor: colors.green,
        borderRadius: 5,
        height: 10,
        width: 10,
    },
    shiftCopy: {
        flex: 1,
    },
    shiftLabel: {
        color: colors.muted,
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    shiftValue: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '700',
    },
    locationPill: {
        alignItems: 'center',
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 6,
        justifyContent: 'center',
        minHeight: 48,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    locActive: {
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
    },
    locPaused: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
    },
    locDot: {
        borderRadius: 4,
        height: 8,
        width: 8,
    },
    locDotActive: {
        backgroundColor: colors.green,
    },
    locDotPaused: {
        backgroundColor: colors.muted,
    },
    locText: {
        fontSize: 12,
        fontWeight: '800',
    },
    pressed: {
        opacity: 0.78,
    },
});
