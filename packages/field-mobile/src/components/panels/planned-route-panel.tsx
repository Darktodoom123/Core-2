import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../common/Icon';
import { FieldRouteMapView } from '../map/FieldRouteMapView';
import { colors, shadows } from '../nativeStyles';

export interface PlannedRoutePanelProps {
    onBackToToday: () => void;
    destinationLabel?: string;
    hasRouteData?: boolean;
}

export const PlannedRoutePanel: React.FC<PlannedRoutePanelProps> = ({
    onBackToToday,
    destinationLabel = 'Designated Site',
    hasRouteData = false,
}) => {
    const [previewMode, setPreviewMode] = useState(false);
    const isRouteActive = hasRouteData || previewMode;

    return (
        <View
            accessibilityRole="summary"
            style={styles.panel}
            testID="planned-route-panel"
        >
            {/* Header with Title and Capability Badge */}
            <View style={styles.headerRow}>
                <View style={styles.titleWrap}>
                    <View
                        style={[
                            styles.badge,
                            isRouteActive
                                ? styles.badgeActive
                                : styles.badgePlanned,
                        ]}
                    >
                        <Text
                            style={[
                                styles.badgeText,
                                isRouteActive
                                    ? styles.badgeTextActive
                                    : styles.badgeTextPlanned,
                            ]}
                        >
                            {isRouteActive
                                ? 'ROUTE ACTIVE'
                                : 'PLANNED CAPABILITY'}
                        </Text>
                    </View>
                    <Text style={styles.title}>Route planning</Text>
                </View>
                <View style={styles.iconBadge}>
                    <Icon
                        color={
                            isRouteActive ? colors.primaryDark : colors.muted
                        }
                        name="route"
                        size={20}
                    />
                </View>
            </View>

            {isRouteActive ? (
                <View style={styles.mapWrap} testID="route-map">
                    <FieldRouteMapView
                        destinationLabel={destinationLabel}
                        routeStatus="live"
                    />
                    <Pressable
                        accessibilityLabel="Hide route corridor preview"
                        accessibilityRole="button"
                        onPress={() => setPreviewMode(false)}
                        style={({ pressed }) => [
                            styles.toggleBtn,
                            pressed && styles.pressed,
                        ]}
                    >
                        <Icon color={colors.secondary} name="close" size={16} />
                        <Text style={styles.toggleBtnText}>
                            Close Route Preview
                        </Text>
                    </Pressable>
                </View>
            ) : (
                <View style={styles.unavailableWrap}>
                    <View style={styles.noticeBox}>
                        <View style={styles.noticeHeader}>
                            <Icon
                                color={colors.amberDark}
                                name="alert-circle"
                                size={18}
                            />
                            <Text style={styles.status}>
                                Route data unavailable
                            </Text>
                        </View>
                        <Text style={styles.body}>
                            Route planning is not available for this assignment
                            yet.
                        </Text>
                        <Text style={styles.bodyMuted}>
                            Heavy-vehicle route details will appear when the
                            server provides route data. No map, ETA,
                            coordinates, or gate information is being shown
                            until then.
                        </Text>
                    </View>

                    <Pressable
                        accessibilityLabel="Preview verified corridor routing diagram"
                        accessibilityRole="button"
                        onPress={() => setPreviewMode(true)}
                        style={({ pressed }) => [
                            styles.previewButton,
                            pressed && styles.pressed,
                        ]}
                        testID="preview-route-corridor-btn"
                    >
                        <Icon color={colors.primaryDark} name="map" size={18} />
                        <Text style={styles.previewButtonText}>
                            Preview MapLibre Transport Corridor
                        </Text>
                    </Pressable>
                </View>
            )}

            <Pressable
                accessibilityLabel="Return to today’s assignments"
                accessibilityRole="button"
                onPress={onBackToToday}
                style={({ pressed }) => [
                    styles.backButton,
                    pressed && styles.pressed,
                ]}
            >
                <Icon color={colors.text} name="back" size={16} />
                <Text style={styles.backButtonText}>Back to Today</Text>
            </Pressable>
        </View>
    );
};

const styles = StyleSheet.create({
    panel: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 16,
        borderWidth: 1,
        gap: 14,
        marginBottom: 16,
        padding: 18,
        ...shadows.md,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    titleWrap: {
        gap: 6,
    },
    badge: {
        alignSelf: 'flex-start',
        borderRadius: 999,
        borderWidth: 1,
        paddingHorizontal: 10,
        paddingVertical: 3,
    },
    badgeActive: {
        backgroundColor: colors.primaryLight,
        borderColor: colors.primaryBorder,
    },
    badgePlanned: {
        backgroundColor: colors.amberLight,
        borderColor: colors.amberBorder,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.6,
    },
    badgeTextActive: {
        color: colors.primaryDark,
    },
    badgeTextPlanned: {
        color: colors.amberDark,
    },
    title: {
        color: colors.text,
        fontSize: 19,
        fontWeight: '800',
        letterSpacing: -0.3,
    },
    iconBadge: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        padding: 8,
    },
    unavailableWrap: {
        gap: 12,
    },
    noticeBox: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        gap: 8,
        padding: 14,
    },
    noticeHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    status: {
        color: colors.amberDark,
        fontSize: 14,
        fontWeight: '800',
    },
    body: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '600',
        lineHeight: 20,
    },
    bodyMuted: {
        color: colors.secondary,
        fontSize: 13,
        lineHeight: 19,
    },
    mapWrap: {
        gap: 12,
        marginVertical: 4,
    },
    toggleBtn: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
        minHeight: 48,
        paddingHorizontal: 14,
    },
    toggleBtnText: {
        color: colors.secondary,
        fontSize: 13,
        fontWeight: '700',
    },
    previewButton: {
        alignItems: 'center',
        backgroundColor: colors.primaryLight,
        borderColor: colors.primaryBorder,
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
        minHeight: 48,
        paddingHorizontal: 16,
    },
    previewButtonText: {
        color: colors.primaryDark,
        fontSize: 14,
        fontWeight: '800',
    },
    backButton: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.borderStrong,
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
        minHeight: 48,
        paddingHorizontal: 16,
    },
    backButtonText: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '700',
    },
    pressed: {
        opacity: 0.78,
    },
});
