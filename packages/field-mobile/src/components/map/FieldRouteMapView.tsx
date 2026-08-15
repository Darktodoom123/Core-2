import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../nativeStyles';

export interface RouteWaypoint {
    id: string;
    label: string;
    latitude: number;
    longitude: number;
    hazardNote?: string;
    isPassed?: boolean;
}

export interface FieldRouteMapViewProps {
    originLabel?: string;
    destinationLabel?: string;
    waypoints?: RouteWaypoint[];
    routeStatus?: 'live' | 'cached' | 'planned' | 'unavailable';
    etaMinutes?: number;
    distanceKm?: number;
    clearanceHeightMetres?: number;
    maxAxleWeightTons?: number;
    testID?: string;
}

export const FieldRouteMapView: React.FC<FieldRouteMapViewProps> = ({
    originLabel = 'Yard / Base',
    destinationLabel = 'Project Site',
    waypoints = [
        {
            id: 'wp-1',
            label: 'Highway 4 Bypass',
            latitude: 14.5995,
            longitude: 120.9842,
            isPassed: true,
        },
        {
            id: 'wp-2',
            label: 'Old Mill Overpass',
            latitude: 14.605,
            longitude: 120.99,
            hazardNote: 'Bridge 4.1m clearance — use outer lane',
            isPassed: false,
        },
        {
            id: 'wp-3',
            label: 'Industrial Access Gate 2',
            latitude: 14.612,
            longitude: 121.002,
            isPassed: false,
        },
    ],
    routeStatus = 'live',
    etaMinutes = 32,
    distanceKm = 18.4,
    clearanceHeightMetres = 4.8,
    maxAxleWeightTons = 45,
    testID = 'field-route-map-view',
}) => {
    const [selectedWaypoint, setSelectedWaypoint] =
        useState<RouteWaypoint | null>(null);

    return (
        <View style={styles.container} testID={testID}>
            {/* Map Header Status & Metric Bar */}
            <View style={styles.metricsBar}>
                <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>EST. TIME</Text>
                    <Text style={styles.metricValue}>
                        {etaMinutes} <Text style={styles.metricUnit}>min</Text>
                    </Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>DISTANCE</Text>
                    <Text style={styles.metricValue}>
                        {distanceKm} <Text style={styles.metricUnit}>km</Text>
                    </Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>CLEARANCE</Text>
                    <Text style={styles.metricValue}>
                        {clearanceHeightMetres}{' '}
                        <Text style={styles.metricUnit}>m</Text>
                    </Text>
                </View>
            </View>

            {/* Visual Vector Route Corridor Diagram */}
            <View style={styles.mapCanvas} testID={`${testID}-canvas`}>
                {/* Background Grid & Compass Rose */}
                <View style={styles.compassContainer}>
                    <Text style={styles.compassText}>🧭 N</Text>
                    <Text style={styles.speedRating}>Max {maxAxleWeightTons}T</Text>
                </View>

                {/* Simulated Waypoint Corridor Route Rail */}
                <View style={styles.routeRailContainer}>
                    {/* Origin Pin */}
                    <View style={styles.waypointRow}>
                        <View style={[styles.pinDot, styles.pinOrigin]} />
                        <View style={styles.waypointCopy}>
                            <Text style={styles.waypointName}>{originLabel}</Text>
                            <Text style={styles.waypointType}>Departure Base</Text>
                        </View>
                    </View>

                    <View style={styles.railSegmentActive} />

                    {/* Middle Waypoints */}
                    {waypoints.map((wp, idx) => {
                        const isSelected = selectedWaypoint?.id === wp.id;

                        return (
                            <React.Fragment key={wp.id}>
                                <Pressable
                                    accessibilityLabel={`Waypoint ${idx + 1}: ${wp.label}${wp.hazardNote ? `, Hazard: ${wp.hazardNote}` : ''}`}
                                    accessibilityRole="button"
                                    onPress={() => setSelectedWaypoint(wp)}
                                    style={({ pressed }) => [
                                        styles.waypointRow,
                                        pressed && styles.pressed,
                                    ]}
                                    testID={`${testID}-wp-${wp.id}`}
                                >
                                    <View
                                        style={[
                                            styles.pinDot,
                                            wp.hazardNote
                                                ? styles.pinHazard
                                                : wp.isPassed
                                                  ? styles.pinPassed
                                                  : styles.pinPending,
                                        ]}
                                    >
                                        <Text style={styles.pinIcon}>
                                            {wp.hazardNote ? '⚠️' : '●'}
                                        </Text>
                                    </View>
                                    <View style={styles.waypointCopy}>
                                        <Text style={styles.waypointName}>
                                            {wp.label}
                                        </Text>
                                        {wp.hazardNote ? (
                                            <Text style={styles.hazardWarning}>
                                                {wp.hazardNote}
                                            </Text>
                                        ) : (
                                            <Text style={styles.waypointType}>
                                                {wp.isPassed
                                                    ? 'Passed'
                                                    : 'Upcoming Corridor'}
                                            </Text>
                                        )}
                                    </View>
                                </Pressable>

                                {idx < waypoints.length - 1 ? (
                                    <View
                                        style={[
                                            styles.railSegment,
                                            wp.isPassed && styles.railSegmentActive,
                                        ]}
                                    />
                                ) : null}
                            </React.Fragment>
                        );
                    })}

                    <View style={styles.railSegment} />

                    {/* Destination Pin */}
                    <View style={styles.waypointRow}>
                        <View style={[styles.pinDot, styles.pinDestination]}>
                            <Text style={styles.pinIcon}>🏁</Text>
                        </View>
                        <View style={styles.waypointCopy}>
                            <Text style={styles.waypointName}>
                                {destinationLabel}
                            </Text>
                            <Text style={styles.waypointType}>
                                Designated Work Site
                            </Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* Route Status Strip */}
            <View style={styles.footerStrip}>
                <View style={styles.statusRow}>
                    <View
                        style={[
                            styles.statusIndicator,
                            routeStatus === 'live' && styles.statusLive,
                            routeStatus === 'cached' && styles.statusCached,
                        ]}
                    />
                    <Text style={styles.statusText}>
                        {routeStatus === 'live'
                            ? 'Heavy Transport Corridor Verified (Live GPS Active)'
                            : routeStatus === 'cached'
                              ? 'Offline Route Cache Active'
                              : 'Standard Route Plan'}
                    </Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 14,
        borderWidth: 1,
        overflow: 'hidden',
    },
    metricsBar: {
        backgroundColor: colors.text,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    metricItem: {
        alignItems: 'center',
        flex: 1,
    },
    metricLabel: {
        color: colors.amber,
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    metricValue: {
        color: colors.white,
        fontSize: 18,
        fontWeight: '900',
        marginTop: 2,
    },
    metricUnit: {
        color: colors.secondary,
        fontSize: 11,
        fontWeight: '700',
    },
    metricDivider: {
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        height: '100%',
        width: 1,
    },
    mapCanvas: {
        backgroundColor: '#111827',
        padding: 16,
        position: 'relative',
    },
    compassContainer: {
        alignItems: 'flex-end',
        position: 'absolute',
        right: 14,
        top: 12,
        zIndex: 2,
    },
    compassText: {
        color: colors.amber,
        fontSize: 11,
        fontWeight: '900',
    },
    speedRating: {
        color: '#9ca3af',
        fontSize: 10,
        fontWeight: '700',
        marginTop: 2,
    },
    routeRailContainer: {
        paddingLeft: 4,
    },
    waypointRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 12,
        marginVertical: 4,
    },
    pinDot: {
        alignItems: 'center',
        borderRadius: 10,
        height: 20,
        justifyContent: 'center',
        width: 20,
    },
    pinOrigin: {
        backgroundColor: colors.green,
    },
    pinHazard: {
        backgroundColor: colors.red,
    },
    pinPassed: {
        backgroundColor: colors.blue,
    },
    pinPending: {
        backgroundColor: '#4b5563',
    },
    pinDestination: {
        backgroundColor: colors.amberDark,
    },
    pinIcon: {
        fontSize: 10,
    },
    waypointCopy: {
        flex: 1,
    },
    waypointName: {
        color: colors.white,
        fontSize: 13,
        fontWeight: '800',
    },
    waypointType: {
        color: '#9ca3af',
        fontSize: 11,
        marginTop: 1,
    },
    hazardWarning: {
        color: '#f87171',
        fontSize: 11,
        fontWeight: '700',
        marginTop: 1,
    },
    railSegment: {
        backgroundColor: '#374151',
        height: 16,
        marginLeft: 9,
        width: 2,
    },
    railSegmentActive: {
        backgroundColor: colors.amber,
        height: 16,
        marginLeft: 9,
        width: 2,
    },
    footerStrip: {
        backgroundColor: colors.surfaceMuted,
        borderTopColor: colors.border,
        borderTopWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    statusRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    statusIndicator: {
        borderRadius: 4,
        height: 8,
        width: 8,
    },
    statusLive: {
        backgroundColor: colors.green,
    },
    statusCached: {
        backgroundColor: colors.warning,
    },
    statusText: {
        color: colors.secondary,
        fontSize: 12,
        fontWeight: '700',
    },
    pressed: {
        opacity: 0.7,
    },
});
