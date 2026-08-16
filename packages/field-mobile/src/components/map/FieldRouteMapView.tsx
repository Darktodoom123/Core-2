import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../common/Icon';
import { colors, shadows } from '../nativeStyles';
import { MapLibreWebContainer } from './MapLibreWebContainer';

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
    originCoords?: [number, number];
    destinationLabel?: string;
    destinationCoords?: [number, number];
    waypoints?: RouteWaypoint[];
    routeStatus?: 'live' | 'cached' | 'planned' | 'unavailable';
    etaMinutes?: number;
    distanceKm?: number;
    clearanceHeightMetres?: number;
    maxAxleWeightTons?: number;
    initialMode?: 'map' | 'corridor';
    testID?: string;
}

export const FieldRouteMapView: React.FC<FieldRouteMapViewProps> = ({
    originLabel = 'Yard / Base',
    originCoords = [120.9842, 14.5995],
    destinationLabel = 'Project Site',
    destinationCoords = [121.002, 14.612],
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
    initialMode = 'corridor',
    testID = 'field-route-map-view',
}) => {
    const [selectedWaypoint, setSelectedWaypoint] =
        useState<RouteWaypoint | null>(null);
    const [viewMode, setViewMode] = useState<'map' | 'corridor'>(initialMode);

    return (
        <View
            accessibilityRole="summary"
            style={styles.container}
            testID={testID}
        >
            {/* Top Telemetry & Clearance HUD */}
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

            {/* Segmented Mode Switcher */}
            <View accessibilityRole="tablist" style={styles.modeSwitcherRow}>
                <Pressable
                    accessibilityLabel="Switch to MapLibre Map View"
                    accessibilityRole="tab"
                    accessibilityState={{ selected: viewMode === 'map' }}
                    onPress={() => setViewMode('map')}
                    style={[
                        styles.modeButton,
                        viewMode === 'map' && styles.modeButtonActive,
                    ]}
                    testID={`${testID}-tab-map`}
                >
                    <View style={styles.modeButtonContent}>
                        <Icon
                            color={
                                viewMode === 'map'
                                    ? colors.white
                                    : colors.mutedOnDark
                            }
                            name="map"
                            size={16}
                        />
                        <Text
                            style={[
                                styles.modeButtonText,
                                viewMode === 'map' &&
                                    styles.modeButtonTextActive,
                            ]}
                        >
                            MapLibre Map
                        </Text>
                    </View>
                </Pressable>

                <Pressable
                    accessibilityLabel="Switch to Corridor Step View"
                    accessibilityRole="tab"
                    accessibilityState={{ selected: viewMode === 'corridor' }}
                    onPress={() => setViewMode('corridor')}
                    style={[
                        styles.modeButton,
                        viewMode === 'corridor' && styles.modeButtonActive,
                    ]}
                    testID={`${testID}-tab-corridor`}
                >
                    <View style={styles.modeButtonContent}>
                        <Icon
                            color={
                                viewMode === 'corridor'
                                    ? colors.white
                                    : colors.mutedOnDark
                            }
                            name="list"
                            size={16}
                        />
                        <Text
                            style={[
                                styles.modeButtonText,
                                viewMode === 'corridor' &&
                                    styles.modeButtonTextActive,
                            ]}
                        >
                            Corridor Steps
                        </Text>
                    </View>
                </Pressable>
            </View>

            {/* MapLibre Live Vector Map Container */}
            {viewMode === 'map' ? (
                <View style={styles.mapLibreContainer}>
                    <MapLibreWebContainer
                        destinationCoords={destinationCoords}
                        destinationLabel={destinationLabel}
                        originCoords={originCoords}
                        originLabel={originLabel}
                        styleVariant="dark"
                        waypoints={waypoints}
                    />
                </View>
            ) : null}

            {/* Visual Vector Route Corridor Diagram */}
            <View style={styles.mapCanvas} testID={`${testID}-canvas`}>
                {/* Background Compass & Axle Load Pill */}
                <View style={styles.compassContainer}>
                    <View style={styles.compassBadge}>
                        <Icon color={colors.amber} name="compass" size={13} />
                        <Text style={styles.compassText}>N</Text>
                    </View>
                    <View style={styles.axleBadge}>
                        <Text style={styles.speedRating}>
                            Max {maxAxleWeightTons}T Axle
                        </Text>
                    </View>
                </View>

                {/* Waypoint Corridor Rail */}
                <View style={styles.routeRailContainer}>
                    {/* Origin Pin */}
                    <View style={styles.waypointRow}>
                        <View style={[styles.pinDot, styles.pinOrigin]}>
                            <Icon color={colors.white} name="pin" size={12} />
                        </View>
                        <View style={styles.waypointCopy}>
                            <Text style={styles.waypointName}>
                                {originLabel}
                            </Text>
                            <Text style={styles.waypointType}>
                                Departure Base
                            </Text>
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
                                    onPress={() =>
                                        setSelectedWaypoint(
                                            isSelected ? null : wp,
                                        )
                                    }
                                    style={({ pressed }) => [
                                        styles.waypointRow,
                                        isSelected &&
                                            styles.waypointRowSelected,
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
                                        {wp.hazardNote ? (
                                            <Icon
                                                color={colors.white}
                                                name="alert"
                                                size={12}
                                            />
                                        ) : wp.isPassed ? (
                                            <Icon
                                                color={colors.white}
                                                name="check"
                                                size={12}
                                            />
                                        ) : (
                                            <View
                                                style={styles.pinPendingInner}
                                            />
                                        )}
                                    </View>
                                    <View style={styles.waypointCopy}>
                                        <View style={styles.waypointHeaderRow}>
                                            <Text style={styles.waypointName}>
                                                {wp.label}
                                            </Text>
                                            {wp.isPassed ? (
                                                <View style={styles.passedPill}>
                                                    <Text
                                                        style={
                                                            styles.passedPillText
                                                        }
                                                    >
                                                        PASSED
                                                    </Text>
                                                </View>
                                            ) : null}
                                        </View>
                                        {wp.hazardNote ? (
                                            <View style={styles.hazardCallout}>
                                                <Icon
                                                    color="#f87171"
                                                    name="alert"
                                                    size={13}
                                                />
                                                <Text
                                                    style={styles.hazardWarning}
                                                >
                                                    {wp.hazardNote}
                                                </Text>
                                            </View>
                                        ) : (
                                            <Text style={styles.waypointType}>
                                                {wp.isPassed
                                                    ? 'Checkpoint completed'
                                                    : 'Upcoming corridor waypoint'}
                                            </Text>
                                        )}
                                    </View>
                                </Pressable>

                                {idx < waypoints.length - 1 ? (
                                    <View
                                        style={[
                                            styles.railSegment,
                                            wp.isPassed &&
                                                styles.railSegmentActive,
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
                            <Icon color={colors.text} name="flag" size={12} />
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

            {/* Route Status Footer Strip */}
            <View style={styles.footerStrip}>
                <View style={styles.statusRow}>
                    <View
                        style={[
                            styles.statusIndicator,
                            routeStatus === 'live' && styles.statusLive,
                            routeStatus === 'cached' && styles.statusCached,
                            routeStatus === 'unavailable' &&
                                styles.statusUnavailable,
                        ]}
                    />
                    <Text style={styles.statusText}>
                        {routeStatus === 'live'
                            ? 'Heavy Transport Corridor Verified (Live GPS Active)'
                            : routeStatus === 'cached'
                              ? 'Offline Route Cache Active'
                              : routeStatus === 'unavailable'
                                ? 'Route Data Unavailable'
                                : 'Standard Route Plan'}
                    </Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.hudBackground,
        borderColor: colors.hudBorder,
        borderRadius: 16,
        borderWidth: 1,
        overflow: 'hidden',
        ...shadows.md,
    },
    metricsBar: {
        backgroundColor: colors.hudSurface,
        borderBottomColor: colors.hudBorderSubtle,
        borderBottomWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    metricItem: {
        alignItems: 'center',
        flex: 1,
    },
    metricLabel: {
        color: colors.hudTextDim,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.8,
    },
    metricValue: {
        color: colors.hudText,
        fontSize: 19,
        fontWeight: '900',
        letterSpacing: -0.4,
        marginTop: 3,
    },
    metricUnit: {
        color: colors.hudAccent,
        fontSize: 12,
        fontWeight: '700',
    },
    metricDivider: {
        backgroundColor: colors.hudBorderSubtle,
        height: '100%',
        width: 1,
    },
    modeSwitcherRow: {
        flexDirection: 'row',
        backgroundColor: colors.hudSurfaceElevated,
        padding: 6,
        gap: 6,
        borderBottomColor: colors.hudBorderSubtle,
        borderBottomWidth: 1,
    },
    modeButton: {
        flex: 1,
        minHeight: 44,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
    },
    modeButtonActive: {
        backgroundColor: colors.primary,
        ...shadows.sm,
    },
    modeButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    modeButtonText: {
        color: colors.mutedOnDark,
        fontSize: 13,
        fontWeight: '700',
    },
    modeButtonTextActive: {
        color: colors.white,
        fontWeight: '800',
    },
    mapLibreContainer: {
        width: '100%',
        height: 270,
        backgroundColor: colors.hudBackground,
    },
    mapCanvas: {
        backgroundColor: colors.hudBackground,
        padding: 16,
        position: 'relative',
    },
    compassContainer: {
        alignItems: 'flex-end',
        position: 'absolute',
        right: 14,
        top: 14,
        zIndex: 2,
        gap: 4,
    },
    compassBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.hudSurfaceElevated,
        borderColor: colors.hudBorder,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 7,
        paddingVertical: 3,
        gap: 4,
    },
    compassText: {
        color: colors.hudAmber,
        fontSize: 11,
        fontWeight: '900',
    },
    axleBadge: {
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    speedRating: {
        color: colors.hudTextDim,
        fontSize: 10,
        fontWeight: '700',
    },
    routeRailContainer: {
        paddingLeft: 4,
        paddingRight: 48,
    },
    waypointRow: {
        alignItems: 'flex-start',
        flexDirection: 'row',
        gap: 12,
        marginVertical: 4,
        paddingVertical: 6,
        paddingHorizontal: 8,
        borderRadius: 10,
    },
    waypointRowSelected: {
        backgroundColor: colors.hudSurfaceElevated,
        borderColor: colors.hudAccent,
        borderWidth: 1,
    },
    pinDot: {
        alignItems: 'center',
        borderRadius: 12,
        height: 24,
        justifyContent: 'center',
        width: 24,
        marginTop: 1,
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
        backgroundColor: '#334155',
        borderColor: '#475569',
        borderWidth: 1,
    },
    pinPendingInner: {
        backgroundColor: '#94a3b8',
        borderRadius: 3,
        height: 6,
        width: 6,
    },
    pinDestination: {
        backgroundColor: colors.amber,
    },
    waypointCopy: {
        flex: 1,
        gap: 2,
    },
    waypointHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    waypointName: {
        color: colors.hudText,
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: -0.2,
    },
    passedPill: {
        backgroundColor: 'rgba(37, 99, 235, 0.2)',
        borderRadius: 4,
        paddingHorizontal: 5,
        paddingVertical: 1,
    },
    passedPillText: {
        color: colors.hudAccent,
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    waypointType: {
        color: colors.hudTextDim,
        fontSize: 12,
        fontWeight: '500',
    },
    hazardCallout: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(239, 68, 68, 0.12)',
        borderColor: 'rgba(239, 68, 68, 0.3)',
        borderRadius: 6,
        borderWidth: 1,
        gap: 6,
        marginTop: 4,
        paddingHorizontal: 8,
        paddingVertical: 5,
    },
    hazardWarning: {
        color: '#fca5a5',
        fontSize: 11,
        fontWeight: '700',
        flex: 1,
        lineHeight: 15,
    },
    railSegment: {
        backgroundColor: '#334155',
        height: 18,
        marginLeft: 19,
        width: 2,
    },
    railSegmentActive: {
        backgroundColor: colors.hudAccent,
        height: 18,
        marginLeft: 19,
        width: 2,
    },
    footerStrip: {
        backgroundColor: colors.hudSurface,
        borderTopColor: colors.hudBorderSubtle,
        borderTopWidth: 1,
        paddingHorizontal: 16,
        paddingVertical: 10,
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
        backgroundColor: colors.amber,
    },
    statusUnavailable: {
        backgroundColor: colors.muted,
    },
    statusText: {
        color: colors.hudTextDim,
        fontSize: 12,
        fontWeight: '700',
    },
    pressed: {
        opacity: 0.8,
    },
});
