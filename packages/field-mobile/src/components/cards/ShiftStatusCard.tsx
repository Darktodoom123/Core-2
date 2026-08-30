import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ShiftInfo } from '../../types/index';
import { Icon } from '../common/Icon';
import { colors, shadows } from '../nativeStyles';

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
    onToggleShift,
}) => {
    const isOnShift = shiftInfo.status === 'on_shift';

    return (
        <View style={styles.statusStrip} testID="shift-status-strip">
            <Pressable
                accessibilityLabel={`Shift status: ${isOnShift ? `On Shift, ${shiftInfo.hoursElapsed ?? 4} hours active` : 'Standby or Break'}`}
                accessibilityRole={onToggleShift ? 'button' : undefined}
                disabled={!onToggleShift}
                onPress={onToggleShift}
                style={({ pressed }) => [
                    styles.card,
                    !isOnShift && styles.cardStandby,
                    pressed && Boolean(onToggleShift) && styles.pressed,
                ]}
                testID="shift-status-card"
            >
                <View
                    style={[
                        styles.badge,
                        isOnShift ? styles.badgeActive : styles.badgeStandby,
                    ]}
                >
                    <Icon
                        name="clock"
                        size={15}
                        color={isOnShift ? colors.greenDark : colors.muted}
                    />
                </View>
                <View style={styles.cardCopy}>
                    <Text style={styles.cardLabel}>ACTIVE SHIFT</Text>
                    <Text numberOfLines={1} style={styles.cardValue}>
                        {isOnShift
                            ? `On Shift · ${shiftInfo.hoursElapsed ?? 4}h`
                            : 'Standby / Break'}
                    </Text>
                </View>
            </Pressable>

            <Pressable
                accessibilityLabel={`Location sharing: ${locationSharingActive ? 'Active transmitting' : 'Paused'}`}
                accessibilityRole="button"
                onPress={onToggleLocationSharing}
                style={({ pressed }) => [
                    styles.card,
                    !locationSharingActive && styles.cardStandby,
                    pressed && styles.pressed,
                ]}
                testID="location-sharing-indicator"
            >
                <View
                    style={[
                        styles.badge,
                        locationSharingActive
                            ? styles.badgeActive
                            : styles.badgeStandby,
                    ]}
                >
                    <Icon
                        name="location"
                        size={15}
                        color={
                            locationSharingActive
                                ? colors.greenDark
                                : colors.muted
                        }
                    />
                </View>
                <View style={styles.cardCopy}>
                    <Text style={styles.cardLabel}>GPS SHARING</Text>
                    <Text
                        numberOfLines={1}
                        style={[
                            styles.cardValue,
                            locationSharingActive
                                ? styles.cardValueActive
                                : styles.cardValueStandby,
                        ]}
                    >
                        {locationSharingActive ? 'Live Sharing' : 'Paused'}
                    </Text>
                </View>
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
    card: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 14,
        borderWidth: 1,
        flex: 1,
        flexDirection: 'row',
        gap: 10,
        minHeight: 56,
        paddingHorizontal: 12,
        paddingVertical: 10,
        ...shadows.sm,
    },
    cardStandby: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
    },
    badge: {
        alignItems: 'center',
        borderRadius: 8,
        borderWidth: 1,
        height: 30,
        justifyContent: 'center',
        width: 30,
    },
    badgeActive: {
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
    },
    badgeStandby: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
    },
    cardCopy: {
        flex: 1,
        justifyContent: 'center',
    },
    cardLabel: {
        color: colors.muted,
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    cardValue: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '700',
        marginTop: 1,
    },
    cardValueActive: {
        color: colors.text,
    },
    cardValueStandby: {
        color: colors.muted,
    },
    pressed: {
        opacity: 0.78,
        transform: [{ scale: 0.985 }],
    },
});
