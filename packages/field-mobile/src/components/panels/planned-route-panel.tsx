import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FieldRouteMapView } from '../map/FieldRouteMapView';
import { colors } from '../nativeStyles';

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

    return (
        <View
            accessibilityRole="summary"
            style={styles.panel}
            testID="planned-route-panel"
        >
            <View style={styles.badge}>
                <Text style={styles.badgeText}>
                    {hasRouteData || previewMode
                        ? 'ROUTE ACTIVE'
                        : 'PLANNED CAPABILITY'}
                </Text>
            </View>
            <Text style={styles.title}>Route planning</Text>

            {hasRouteData || previewMode ? (
                <View style={styles.mapWrap} testID="route-map">
                    <FieldRouteMapView
                        destinationLabel={destinationLabel}
                        routeStatus="live"
                    />
                    <Pressable
                        accessibilityLabel="Hide route corridor preview"
                        accessibilityRole="button"
                        onPress={() => setPreviewMode(false)}
                        style={styles.toggleBtn}
                    >
                        <Text style={styles.toggleBtnText}>
                            Close Route Preview
                        </Text>
                    </Pressable>
                </View>
            ) : (
                <>
                    <Text style={styles.status}>Route data unavailable</Text>
                    <Text style={styles.body}>
                        Route planning is not available for this assignment yet.
                    </Text>
                    <Text style={styles.body}>
                        Heavy-vehicle route details will appear when the server
                        provides route data. No map, ETA, coordinates, or gate
                        information is being shown until then.
                    </Text>

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
                        <Text style={styles.previewButtonText}>
                            🗺️ Preview Heavy Transport Corridor
                        </Text>
                    </Pressable>
                </>
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
                <Text style={styles.backButtonText}>Back to Today</Text>
            </Pressable>
        </View>
    );
};

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
    mapWrap: {
        gap: 10,
        marginVertical: 4,
    },
    toggleBtn: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.borderStrong,
        borderRadius: 8,
        borderWidth: 1,
        justifyContent: 'center',
        minHeight: 44,
        paddingHorizontal: 12,
    },
    toggleBtnText: {
        color: colors.secondary,
        fontSize: 13,
        fontWeight: '700',
    },
    previewButton: {
        alignItems: 'center',
        backgroundColor: colors.amberSoft,
        borderColor: colors.amberBorder,
        borderRadius: 8,
        borderWidth: 1,
        justifyContent: 'center',
        minHeight: 48,
        paddingHorizontal: 14,
    },
    previewButtonText: {
        color: colors.amberDark,
        fontSize: 14,
        fontWeight: '800',
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
