import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, sharedStyles } from './nativeStyles';

export type HeavyCraneRouteStatus =
    'available' | 'cached' | 'stale' | 'unavailable';

export interface HeavyCraneRouteCardProps {
    /** A server-provided crane label, for example "CRN-07 · 50-ton mobile crane". */
    assetLabel?: string | null;
    /** Route state from a future route provider. No route data is inferred here. */
    status?: HeavyCraneRouteStatus;
    currentLabel?: string | null;
    destinationLabel?: string | null;
    stagingLabel?: string | null;
    etaLabel?: string | null;
    distanceLabel?: string | null;
    lastSyncedAt?: string | null;
    onOpenRoute?: () => void;
    testID?: string;
}

function cleanValue(value?: string | null): string | null {
    const trimmed = value?.trim();

    return trimmed ? trimmed : null;
}

export const HeavyCraneRouteCard: React.FC<HeavyCraneRouteCardProps> = ({
    assetLabel,
    status = 'unavailable',
    currentLabel,
    destinationLabel,
    stagingLabel,
    etaLabel,
    distanceLabel,
    lastSyncedAt,
    onOpenRoute,
    testID = 'heavy-crane-route-card',
}) => {
    const presentation = statusPresentation[status];
    const safeAssetLabel = cleanValue(assetLabel) ?? 'Heavy-crane asset';
    const safeLastSyncedAt = cleanValue(lastSyncedAt);
    const points = [
        { label: 'Current position', value: cleanValue(currentLabel) },
        { label: 'Destination', value: cleanValue(destinationLabel) },
        { label: 'Staging / site access', value: cleanValue(stagingLabel) },
    ].filter(
        (point): point is { label: string; value: string } =>
            point.value !== null,
    );
    const metrics = [
        { label: 'ETA', value: cleanValue(etaLabel) },
        { label: 'Distance', value: cleanValue(distanceLabel) },
    ].filter(
        (metric): metric is { label: string; value: string } =>
            metric.value !== null,
    );

    return (
        <View style={styles.card} testID={testID}>
            <View style={styles.headingRow}>
                <View style={styles.headingCopy}>
                    {status === 'unavailable' ? (
                        <Text style={styles.plannedBadge}>
                            PLANNED CAPABILITY
                        </Text>
                    ) : null}
                    <Text accessibilityRole="header" style={styles.eyebrow}>
                        DRIVE MODE
                    </Text>
                    <Text style={styles.heading}>Heavy-crane route</Text>
                    <Text selectable style={styles.assetLabel}>
                        {safeAssetLabel}
                    </Text>
                </View>
                <View style={styles.craneMark} accessibilityElementsHidden>
                    <Text style={styles.craneMarkText}>CR</Text>
                </View>
            </View>

            {status === 'unavailable' ? (
                <View
                    accessible
                    accessibilityLabel="Illustrative map placeholder; route data unavailable"
                    style={styles.mapPlaceholder}
                >
                    <Text style={styles.mapPlaceholderMark}>⌖</Text>
                    <Text style={styles.mapPlaceholderText}>
                        Map and route data will appear when the route endpoint
                        is connected.
                    </Text>
                </View>
            ) : null}

            <View
                accessible
                accessibilityLabel={`Route status: ${presentation.label}`}
                accessibilityRole="summary"
                style={[styles.statusPanel, presentation.panelStyle]}
                testID={`${testID}-status`}
            >
                <View style={[styles.statusMark, presentation.markStyle]} />
                <View style={styles.statusCopy}>
                    <Text style={[styles.statusLabel, presentation.labelStyle]}>
                        {presentation.label}
                    </Text>
                    <Text style={styles.statusDescription}>
                        {presentation.description}
                    </Text>
                    {safeLastSyncedAt ? (
                        <Text style={styles.lastSynced}>
                            Last synced: {safeLastSyncedAt}
                        </Text>
                    ) : null}
                </View>
            </View>

            <View
                accessible
                accessibilityLabel="Route details"
                accessibilityRole="list"
                style={styles.routeDetails}
                testID={`${testID}-list`}
            >
                {points.length > 0 ? (
                    points.map((point, index) => (
                        <View
                            accessible
                            accessibilityLabel={`${point.label}: ${point.value}`}
                            key={point.label}
                            style={styles.routePoint}
                        >
                            <View style={styles.routeRail}>
                                <View
                                    style={[
                                        styles.routeDot,
                                        index === 0 && styles.routeDotCurrent,
                                        index === points.length - 1 &&
                                            styles.routeDotDestination,
                                    ]}
                                />
                                {index < points.length - 1 ? (
                                    <View style={styles.routeConnector} />
                                ) : null}
                            </View>
                            <View style={styles.routePointCopy}>
                                <Text style={styles.routePointLabel}>
                                    {point.label}
                                </Text>
                                <Text selectable style={styles.routePointValue}>
                                    {point.value}
                                </Text>
                            </View>
                        </View>
                    ))
                ) : (
                    <Text style={styles.emptyRouteText}>
                        Route details will appear when the server provides a
                        heavy-vehicle route.
                    </Text>
                )}
            </View>

            {metrics.length > 0 ? (
                <View style={styles.metricRow}>
                    {metrics.map((metric) => (
                        <View
                            accessible
                            accessibilityLabel={`${metric.label}: ${metric.value}`}
                            key={metric.label}
                            style={styles.metric}
                        >
                            <Text style={styles.metricLabel}>
                                {metric.label}
                            </Text>
                            <Text selectable style={styles.metricValue}>
                                {metric.value}
                            </Text>
                        </View>
                    ))}
                </View>
            ) : null}

            <View style={styles.divider} />
            <View
                accessible
                accessibilityLabel="Synchronized route list alternative"
                style={styles.listAlternative}
            >
                <View style={styles.listAlternativeMark}>
                    <Text style={styles.listAlternativeMarkText}>≡</Text>
                </View>
                <View style={styles.listAlternativeCopy}>
                    <Text style={styles.listAlternativeHeading}>
                        Synchronized assignment details
                    </Text>
                    <Text style={styles.listAlternativeBody}>
                        Use the assignment details while route data is
                        unavailable. Text route details will appear when the
                        server provides them.
                    </Text>
                </View>
            </View>

            {status === 'unavailable' ? (
                <View
                    accessible
                    accessibilityLabel="Route review planned and unavailable"
                    style={styles.plannedRouteButton}
                >
                    <Text style={styles.plannedRouteButtonText}>
                        Route review (planned)
                    </Text>
                </View>
            ) : onOpenRoute ? (
                <Pressable
                    accessibilityLabel="Open full route review"
                    accessibilityRole="button"
                    onPress={onOpenRoute}
                    style={({ pressed }) => [
                        sharedStyles.button,
                        styles.routeButton,
                        pressed && styles.pressed,
                    ]}
                    testID={`${testID}-open-route`}
                >
                    <Text style={sharedStyles.buttonText}>
                        Open route review
                    </Text>
                </Pressable>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 16,
        padding: 16,
    },
    headingRow: {
        alignItems: 'flex-start',
        flexDirection: 'row',
        gap: 12,
        justifyContent: 'space-between',
    },
    headingCopy: {
        flex: 1,
        gap: 4,
    },
    plannedBadge: {
        alignSelf: 'flex-start',
        backgroundColor: colors.surfaceMuted,
        borderRadius: 6,
        color: colors.secondary,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    eyebrow: {
        color: colors.amberDark,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.8,
    },
    heading: {
        color: colors.text,
        fontSize: 18,
        fontWeight: '800',
    },
    assetLabel: {
        color: colors.secondary,
        fontSize: 14,
        lineHeight: 20,
    },
    craneMark: {
        alignItems: 'center',
        backgroundColor: colors.amberSoft,
        borderColor: colors.amberBorder,
        borderRadius: 10,
        borderWidth: 1,
        height: 44,
        justifyContent: 'center',
        width: 44,
    },
    craneMarkText: {
        color: colors.amberDark,
        fontSize: 12,
        fontWeight: '800',
    },
    mapPlaceholder: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.borderStrong,
        borderRadius: 10,
        borderWidth: 1,
        gap: 6,
        justifyContent: 'center',
        marginTop: 14,
        minHeight: 112,
        padding: 16,
    },
    mapPlaceholderMark: {
        color: colors.secondary,
        fontSize: 34,
        lineHeight: 38,
    },
    mapPlaceholderText: {
        color: colors.secondary,
        fontSize: 12,
        lineHeight: 17,
        textAlign: 'center',
    },
    statusPanel: {
        alignItems: 'flex-start',
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 10,
        marginTop: 16,
        padding: 12,
    },
    statusPanelAvailable: {
        backgroundColor: colors.blueLight,
        borderColor: colors.blueBorder,
    },
    statusPanelCached: {
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
    },
    statusPanelStale: {
        backgroundColor: colors.warningLight,
        borderColor: colors.warningBorder,
    },
    statusPanelUnavailable: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
    },
    statusMark: {
        borderRadius: 6,
        height: 12,
        marginTop: 3,
        width: 12,
    },
    statusMarkAvailable: {
        backgroundColor: colors.blue,
    },
    statusMarkCached: {
        backgroundColor: colors.green,
    },
    statusMarkStale: {
        backgroundColor: colors.warning,
    },
    statusMarkUnavailable: {
        backgroundColor: colors.muted,
    },
    statusCopy: {
        flex: 1,
        gap: 3,
    },
    statusLabel: {
        fontSize: 14,
        fontWeight: '800',
    },
    statusLabelAvailable: {
        color: colors.blueDark,
    },
    statusLabelCached: {
        color: colors.greenDark,
    },
    statusLabelStale: {
        color: colors.warningDark,
    },
    statusLabelUnavailable: {
        color: colors.secondary,
    },
    statusDescription: {
        color: colors.secondary,
        fontSize: 13,
        lineHeight: 19,
    },
    lastSynced: {
        color: colors.muted,
        fontSize: 12,
        lineHeight: 18,
    },
    routeDetails: {
        marginTop: 16,
    },
    routePoint: {
        flexDirection: 'row',
        gap: 12,
        minHeight: 54,
    },
    routeRail: {
        alignItems: 'center',
        width: 16,
    },
    routeDot: {
        backgroundColor: colors.muted,
        borderColor: colors.surface,
        borderRadius: 6,
        borderWidth: 2,
        height: 12,
        width: 12,
        zIndex: 1,
    },
    routeDotCurrent: {
        backgroundColor: colors.blue,
    },
    routeDotDestination: {
        backgroundColor: colors.amber,
    },
    routeConnector: {
        backgroundColor: colors.borderStrong,
        bottom: -4,
        position: 'absolute',
        top: 10,
        width: 2,
    },
    routePointCopy: {
        flex: 1,
        gap: 2,
        paddingBottom: 10,
    },
    routePointLabel: {
        color: colors.muted,
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    routePointValue: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '700',
        lineHeight: 21,
    },
    emptyRouteText: {
        color: colors.muted,
        fontSize: 14,
        lineHeight: 21,
    },
    metricRow: {
        borderTopColor: colors.border,
        borderTopWidth: 1,
        flexDirection: 'row',
        gap: 24,
        marginTop: 4,
        paddingTop: 12,
    },
    metric: {
        flex: 1,
        gap: 2,
    },
    metricLabel: {
        color: colors.muted,
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    metricValue: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '800',
        fontVariant: ['tabular-nums'],
    },
    divider: {
        backgroundColor: colors.border,
        height: 1,
        marginBottom: 12,
        marginTop: 16,
    },
    listAlternative: {
        alignItems: 'flex-start',
        flexDirection: 'row',
        gap: 10,
    },
    listAlternativeMark: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        height: 32,
        justifyContent: 'center',
        width: 32,
    },
    listAlternativeMarkText: {
        color: colors.blueDark,
        fontSize: 19,
        fontWeight: '800',
        lineHeight: 20,
    },
    listAlternativeCopy: {
        flex: 1,
        gap: 2,
    },
    listAlternativeHeading: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '800',
    },
    listAlternativeBody: {
        color: colors.secondary,
        fontSize: 12,
        lineHeight: 18,
    },
    routeButton: {
        marginTop: 14,
        width: '100%',
    },
    plannedRouteButton: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.borderStrong,
        borderRadius: 8,
        borderWidth: 1,
        justifyContent: 'center',
        marginTop: 14,
        minHeight: 48,
        paddingHorizontal: 16,
    },
    plannedRouteButtonText: {
        color: colors.muted,
        fontSize: 15,
        fontWeight: '700',
    },
    pressed: {
        opacity: 0.78,
    },
});

interface StatusPresentation {
    label: string;
    description: string;
    markStyle: object;
    labelStyle: object;
    panelStyle: object;
}

const statusPresentation: Record<HeavyCraneRouteStatus, StatusPresentation> = {
    available: {
        label: 'Route available',
        description: 'Heavy-vehicle route is ready for review.',
        markStyle: styles.statusMarkAvailable,
        labelStyle: styles.statusLabelAvailable,
        panelStyle: styles.statusPanelAvailable,
    },
    cached: {
        label: 'Route cached for offline use',
        description:
            'The route is saved on this device. It may not include recent changes.',
        markStyle: styles.statusMarkCached,
        labelStyle: styles.statusLabelCached,
        panelStyle: styles.statusPanelCached,
    },
    stale: {
        label: 'Route needs refresh',
        description:
            'Review the last synchronized route before moving the crane.',
        markStyle: styles.statusMarkStale,
        labelStyle: styles.statusLabelStale,
        panelStyle: styles.statusPanelStale,
    },
    unavailable: {
        label: 'Route unavailable',
        description:
            'No route data is available for this assignment in the current mobile backend.',
        markStyle: styles.statusMarkUnavailable,
        labelStyle: styles.statusLabelUnavailable,
        panelStyle: styles.statusPanelUnavailable,
    },
};
