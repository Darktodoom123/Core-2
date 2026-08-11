import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../nativeStyles';

export interface PlannedRoutePanelProps {
    onBackToToday: () => void;
}

export const PlannedRoutePanel: React.FC<PlannedRoutePanelProps> = ({
    onBackToToday,
}) => (
    <View
        accessibilityRole="summary"
        style={styles.panel}
        testID="planned-route-panel"
    >
        <View style={styles.badge}>
            <Text style={styles.badgeText}>PLANNED CAPABILITY</Text>
        </View>
        <Text style={styles.title}>Route planning</Text>
        <Text style={styles.status}>Route data unavailable</Text>
        <Text style={styles.body}>
            Route planning is not available for this assignment yet.
        </Text>
        <Text style={styles.body}>
            Heavy-vehicle route details will appear when the server provides
            route data. No map, ETA, coordinates, or gate information is being
            shown until then.
        </Text>
        <Pressable
            accessibilityLabel="Return to today’s assignments"
            accessibilityRole="button"
            onPress={onBackToToday}
            style={({ pressed }) => [
                styles.backButton,
                pressed && styles.pressed,
            ]}
        >
            <Text style={styles.backButtonText}>Back to Today</Text>
        </Pressable>
    </View>
);

const styles = StyleSheet.create({
    panel: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 12,
        borderStyle: 'dashed',
        borderWidth: 1,
        gap: 10,
        marginBottom: 16,
        padding: 16,
    },
    badge: {
        alignSelf: 'flex-start',
        backgroundColor: colors.surfaceMuted,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    badgeText: {
        color: colors.secondary,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    title: {
        color: colors.text,
        fontSize: 20,
        fontWeight: '800',
    },
    status: {
        color: colors.warningDark,
        fontSize: 15,
        fontWeight: '800',
    },
    body: {
        color: colors.secondary,
        fontSize: 14,
        lineHeight: 21,
    },
    backButton: {
        alignItems: 'center',
        borderColor: colors.borderStrong,
        borderRadius: 8,
        borderWidth: 1,
        justifyContent: 'center',
        minHeight: 48,
        paddingHorizontal: 16,
    },
    backButtonText: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '800',
    },
    pressed: {
        opacity: 0.78,
    },
});
