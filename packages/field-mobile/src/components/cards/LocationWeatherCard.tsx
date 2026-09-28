import React from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useTheme } from '../../theme';
import type { WeatherTelemetry } from '../../types/index';
import { Icon } from '../common/Icon';
import type { IconName } from '../common/Icon';
import { colors, shadows } from '../nativeStyles';

export interface LocationWeatherCardProps {
    weather?: WeatherTelemetry | null;
    isLoading?: boolean;
    error?: string | null;
    canUseCurrentLocation?: boolean;
    onRefresh?: () => void;
}

interface FriendlyErrorInfo {
    title: string;
    message: string;
    icon: IconName;
}

function resolveFriendlyError(
    error: string | null | undefined,
    canUseCurrentLocation: boolean,
): FriendlyErrorInfo {
    if (!canUseCurrentLocation) {
        return {
            title: 'Site Weather Locked',
            message:
                'Link your assigned unit on site to check local wind and lifting conditions.',
            icon: 'location',
        };
    }

    if (!error) {
        return {
            title: 'Weather Unavailable',
            message:
                'Use your current location to check live wind and site conditions.',
            icon: 'alert',
        };
    }

    const lower = error.toLowerCase();

    if (
        lower.includes('permission') ||
        lower.includes('denied') ||
        lower.includes('allow') ||
        lower.includes('settings')
    ) {
        return {
            title: 'Location Access Needed',
            message:
                'Allow location in your phone settings to see site wind and safety.',
            icon: 'location',
        };
    }

    if (
        lower.includes('gps') ||
        lower.includes('signal') ||
        lower.includes('coordinates') ||
        lower.includes('location') ||
        lower.includes('searching')
    ) {
        return {
            title: 'Looking for GPS',
            message: 'Turn on GPS or step into an open area, then tap retry.',
            icon: 'location',
        };
    }

    if (
        lower.includes('connect') ||
        lower.includes('network') ||
        lower.includes('offline') ||
        lower.includes('internet') ||
        lower.includes('server') ||
        lower.includes('service')
    ) {
        return {
            title: 'Connection Needed',
            message: 'Check your Wi-Fi or cellular data, then tap retry.',
            icon: 'alert',
        };
    }

    return {
        title: 'Weather Unavailable',
        message: error.length > 70 ? `${error.slice(0, 67)}...` : error,
        icon: 'alert',
    };
}

export const LocationWeatherCard: React.FC<LocationWeatherCardProps> = ({
    weather,
    isLoading = false,
    error,
    canUseCurrentLocation = false,
    onRefresh,
}) => {
    const { isDarkHud, theme } = useTheme();

    // 1. Loading State (when no weather yet, but currently fetching)
    if (isLoading && !weather) {
        return (
            <View
                accessibilityLabel="Finding your location and live weather..."
                style={[styles.cardRoot, isDarkHud && styles.darkCardRoot]}
                testID="location-weather-card"
            >
                <View style={styles.headerRow}>
                    <View style={styles.locationGroup}>
                        <Icon
                            color={isDarkHud ? '#38BDF8' : '#0284C7'}
                            name="location"
                            size={13}
                        />
                        <Text
                            numberOfLines={1}
                            style={[
                                styles.locationText,
                                isDarkHud && styles.darkLocationText,
                            ]}
                        >
                            Finding Your Location...
                        </Text>
                    </View>
                    <ActivityIndicator
                        color={isDarkHud ? '#38BDF8' : '#0284C7'}
                        size="small"
                        testID="weather-loading-indicator"
                    />
                </View>

                <View
                    style={[
                        styles.metricsStrip,
                        isDarkHud && styles.darkMetricsStrip,
                    ]}
                >
                    <Text
                        numberOfLines={1}
                        style={[
                            styles.metricMuted,
                            isDarkHud && styles.darkMetricMuted,
                        ]}
                    >
                        Checking live wind speed and lifting safety...
                    </Text>
                </View>
            </View>
        );
    }

    // 2. Error / Unavailable State (no valid live weather telemetry)
    if (!weather || error) {
        const friendly = resolveFriendlyError(error, canUseCurrentLocation);

        return (
            <View
                accessibilityLabel={`${friendly.title}: ${friendly.message}`}
                style={[
                    styles.cardRoot,
                    {
                        backgroundColor: theme.surface,
                        borderColor: theme.border,
                    },
                ]}
                testID="location-weather-card"
            >
                <View style={styles.headerRow}>
                    <View style={styles.locationGroup}>
                        <Icon
                            color={theme.textSecondary}
                            name={friendly.icon}
                            size={13}
                        />
                        <Text
                            numberOfLines={1}
                            style={[
                                styles.errorTitle,
                                { color: theme.textPrimary },
                            ]}
                        >
                            {friendly.title}
                        </Text>
                    </View>

                    {onRefresh && canUseCurrentLocation ? (
                        <Pressable
                            accessibilityLabel="Use current location to check weather"
                            accessibilityRole="button"
                            disabled={isLoading}
                            hitSlop={8}
                            onPress={onRefresh}
                            style={({ pressed }) => [
                                styles.retryButton,
                                { backgroundColor: theme.brandAmberLight },
                                pressed && styles.btnPressed,
                            ]}
                            testID="weather-refresh-btn"
                        >
                            {isLoading ? (
                                <ActivityIndicator
                                    color={theme.brandAmberText}
                                    size="small"
                                    testID="weather-refresh-spinner"
                                />
                            ) : (
                                <View style={styles.retryInner}>
                                    <Icon
                                        color={theme.brandAmberText}
                                        name="route"
                                        size={11}
                                    />
                                    <Text
                                        style={[
                                            styles.retryText,
                                            { color: theme.brandAmberText },
                                        ]}
                                    >
                                        Retry
                                    </Text>
                                </View>
                            )}
                        </Pressable>
                    ) : null}
                </View>

                <View
                    style={[
                        styles.metricsStrip,
                        isDarkHud && styles.darkMetricsStrip,
                    ]}
                >
                    <Text
                        numberOfLines={1}
                        style={[
                            styles.errorMessageText,
                            { color: theme.textSecondary },
                        ]}
                    >
                        {friendly.message}
                    </Text>
                </View>
            </View>
        );
    }

    // 3. Valid Live Weather Telemetry State
    const data: WeatherTelemetry = weather;
    const safetyLevel = data.safety_level ?? 'safe_normal';

    const getSafetyTheme = (level: WeatherTelemetry['safety_level']) => {
        switch (level) {
            case 'critical_stop_work':
                return {
                    pillBg: isDarkHud ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2',
                    pillText: isDarkHud ? '#FCA5A5' : '#B91C1C',
                    dotColor: '#EF4444',
                    label: 'STOP WORK (≥ 45 KM/H)',
                };
            case 'warning_caution':
                return {
                    pillBg: theme.warningOrangeLight,
                    pillText: theme.warningOrangeText,
                    dotColor: theme.warningOrange,
                    label: 'CAUTION (36-44 KM/H)',
                };
            case 'safe_normal':
            default:
                return {
                    pillBg: isDarkHud ? 'rgba(16, 185, 129, 0.2)' : '#D1FAE5',
                    pillText: isDarkHud ? '#6EE7B7' : '#047857',
                    dotColor: '#10B981',
                    label: 'SAFE LIFT (< 36 KM/H)',
                };
        }
    };

    const safetyTheme = getSafetyTheme(safetyLevel);

    const getWeatherIcon = (desc: string = ''): IconName => {
        const lower = (desc || '').toLowerCase();

        if (lower.includes('thunder') || lower.includes('lightning')) {
            return 'alert';
        }

        if (lower.includes('rain') || lower.includes('drizzle')) {
            return 'pin';
        }

        if (lower.includes('cloud') || lower.includes('overcast')) {
            return 'document';
        }

        return 'check-circle';
    };

    return (
        <View
            accessibilityLabel={`Location weather: ${data.location_name ?? 'Address unavailable'}, Wind ${Math.round(data.wind_speed_kmh)} km/h, Gusts ${Math.round(data.wind_gusts_kmh)} km/h, ${Math.round(data.temperature_celsius)}°C, ${safetyTheme.label}`}
            style={[styles.cardRoot, isDarkHud && styles.darkCardRoot]}
            testID="location-weather-card"
        >
            {/* Row 1: Location City Name + Safety Status Pill + Refresh Trigger */}
            <View style={styles.headerRow}>
                <View style={styles.locationGroup}>
                    <Icon
                        color={isDarkHud ? '#38BDF8' : '#0284C7'}
                        name="location"
                        size={13}
                    />
                    <Text
                        numberOfLines={1}
                        style={[
                            styles.locationText,
                            isDarkHud && styles.darkLocationText,
                        ]}
                    >
                        {data.location_name ?? 'Address unavailable'}
                    </Text>
                </View>

                <View style={styles.headerRightGroup}>
                    <View
                        style={[
                            styles.safetyPill,
                            { backgroundColor: safetyTheme.pillBg },
                        ]}
                        testID="weather-safety-pill"
                    >
                        <View
                            style={[
                                styles.safetyDot,
                                { backgroundColor: safetyTheme.dotColor },
                            ]}
                        />
                        <Text
                            style={[
                                styles.safetyPillText,
                                { color: safetyTheme.pillText },
                            ]}
                        >
                            {safetyTheme.label}
                        </Text>
                    </View>

                    {onRefresh && canUseCurrentLocation ? (
                        <Pressable
                            accessibilityLabel="Refresh current location weather telemetry"
                            accessibilityRole="button"
                            disabled={isLoading}
                            hitSlop={8}
                            onPress={onRefresh}
                            style={({ pressed }) => [
                                styles.refreshButton,
                                isDarkHud && styles.darkRefreshButton,
                                pressed && styles.btnPressed,
                            ]}
                            testID="weather-refresh-btn"
                        >
                            {isLoading ? (
                                <ActivityIndicator
                                    color={isDarkHud ? '#38BDF8' : '#0284C7'}
                                    size="small"
                                    testID="weather-refresh-spinner"
                                />
                            ) : (
                                <Icon
                                    color={isDarkHud ? '#94A3B8' : '#64748B'}
                                    name="route"
                                    size={12}
                                />
                            )}
                        </Pressable>
                    ) : null}
                </View>
            </View>

            {/* Row 2: Minimalist Inline Telemetry (Wind / Anemometer & Temperature / Sky) */}
            <View
                style={[
                    styles.metricsStrip,
                    isDarkHud && styles.darkMetricsStrip,
                ]}
            >
                {/* Wind / Anemometer */}
                <View style={styles.metricItem}>
                    <Icon color={theme.textSecondary} name="speed" size={13} />
                    <Text
                        style={[
                            styles.metricBold,
                            isDarkHud && styles.darkMetricBold,
                        ]}
                    >
                        {Math.round(data.wind_speed_kmh)} km/h
                    </Text>
                    <Text
                        style={[
                            styles.metricMuted,
                            isDarkHud && styles.darkMetricMuted,
                        ]}
                    >
                        · Gusts {Math.round(data.wind_gusts_kmh)} km/h
                    </Text>
                </View>

                {/* Ambient Temperature & Sky Condition */}
                <View style={styles.metricItem}>
                    <Icon
                        color={isDarkHud ? '#38BDF8' : '#0284C7'}
                        name={getWeatherIcon(data.weather_description)}
                        size={13}
                    />
                    <Text
                        style={[
                            styles.metricBold,
                            isDarkHud && styles.darkMetricBold,
                        ]}
                    >
                        {Math.round(data.temperature_celsius)}°C
                    </Text>
                    <Text
                        numberOfLines={1}
                        style={[
                            styles.metricMuted,
                            styles.conditionText,
                            isDarkHud && styles.darkMetricMuted,
                        ]}
                    >
                        · {data.weather_description}
                    </Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    cardRoot: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 10,
        borderWidth: 1,
        marginBottom: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        ...shadows.sm,
    },
    darkCardRoot: {
        backgroundColor: '#131D31',
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    errorTitle: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.1,
    },
    errorMessageText: {
        fontSize: 12,
        fontWeight: '500',
    },
    retryButton: {
        alignItems: 'center',
        borderRadius: 8,
        justifyContent: 'center',
        minHeight: 32,
        paddingHorizontal: 12,
    },
    retryInner: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 4,
    },
    retryText: {
        fontSize: 12,
        fontWeight: '700',
    },
    headerRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    locationGroup: {
        alignItems: 'center',
        flex: 1,
        flexDirection: 'row',
        gap: 6,
        marginRight: 8,
    },
    locationText: {
        color: colors.text,
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    darkLocationText: {
        color: '#F8FAFC',
    },
    headerRightGroup: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6,
    },
    safetyPill: {
        alignItems: 'center',
        borderRadius: 5,
        flexDirection: 'row',
        gap: 4,
        paddingHorizontal: 7,
        paddingVertical: 2.5,
    },
    safetyDot: {
        borderRadius: 2.5,
        height: 5,
        width: 5,
    },
    safetyPillText: {
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    refreshButton: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderRadius: 12,
        height: 24,
        justifyContent: 'center',
        width: 24,
    },
    darkRefreshButton: {
        backgroundColor: '#1E293B',
    },
    btnPressed: {
        opacity: 0.7,
    },
    metricsStrip: {
        alignItems: 'center',
        borderTopColor: colors.borderSubtle,
        borderTopWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingTop: 6,
    },
    darkMetricsStrip: {
        borderTopColor: 'rgba(255, 255, 255, 0.06)',
    },
    metricItem: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 4,
    },
    metricBold: {
        color: colors.text,
        fontSize: 12,
        fontWeight: '800',
    },
    darkMetricBold: {
        color: '#F1F5F9',
    },
    metricMuted: {
        color: colors.muted,
        fontSize: 12,
        fontWeight: '500',
    },
    darkMetricMuted: {
        color: '#94A3B8',
    },
    conditionText: {
        maxWidth: 110,
    },
});
