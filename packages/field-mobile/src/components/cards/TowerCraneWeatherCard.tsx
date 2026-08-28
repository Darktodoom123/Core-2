import React, { useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import type {
    SiteWeatherTelemetry,
    WeatherStandbyPayload,
} from '../../types/index';
import { Icon } from '../common/Icon';
import { colors, shadows } from '../nativeStyles';

export interface TowerCraneWeatherCardProps {
    jobId?: number;
    siteName?: string;
    weather?: SiteWeatherTelemetry | null;
    isLoading?: boolean;
    isStandbyModalVisible?: boolean;
    onRefresh?: () => void;
    onReportStandby?: (
        anemometerWindKmh: number,
        reason: WeatherStandbyPayload['reason'],
        remarks?: string,
    ) => void;
    testID?: string;
}

export const TowerCraneWeatherCard: React.FC<TowerCraneWeatherCardProps> = ({
    jobId,
    siteName,
    weather,
    isLoading = false,
    isStandbyModalVisible,
    onRefresh,
    onReportStandby,
    testID = 'tower-crane-weather-card',
}) => {
    const [isStandbyModalOpen, setIsStandbyModalOpen] = useState(
        isStandbyModalVisible ?? false,
    );
    const [anemometerInput, setAnemometerInput] = useState(
        weather ? String(weather.wind_speed_kmh) : '48.0',
    );
    const [selectedReason, setSelectedReason] =
        useState<WeatherStandbyPayload['reason']>('high_wind');
    const [remarks, setRemarks] = useState('');

    const safetyLevel = weather?.safety_level ?? 'safe_normal';
    const isCritical = safetyLevel === 'critical_stop_work';
    const isWarning = safetyLevel === 'warning_caution';

    const handleConfirmStandby = () => {
        const windVal =
            parseFloat(anemometerInput) || weather?.wind_speed_kmh || 45.0;

        if (onReportStandby) {
            onReportStandby(
                windVal,
                selectedReason,
                remarks.trim() || undefined,
            );
        }

        setIsStandbyModalOpen(false);
    };

    return (
        <View style={styles.card} testID={testID}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerTitleRow}>
                    <Icon name="speed" size={18} color={colors.text} />
                    <View>
                        <Text style={styles.headerTitle}>
                            Tower Masthead Weather
                        </Text>
                        {siteName ? (
                            <Text style={styles.headerSubtitle}>
                                {siteName}
                                {jobId ? ` · Job #${jobId}` : ''}
                            </Text>
                        ) : null}
                    </View>
                </View>
                {onRefresh && (
                    <Pressable
                        onPress={onRefresh}
                        disabled={isLoading}
                        style={styles.refreshButton}
                        accessibilityLabel="Refresh weather"
                        testID="weather-refresh-btn"
                    >
                        {isLoading ? (
                            <ActivityIndicator
                                size="small"
                                color={colors.primary}
                            />
                        ) : (
                            <Icon name="sync" size={16} color={colors.muted} />
                        )}
                    </Pressable>
                )}
            </View>

            {/* Safety Badge */}
            <View
                style={[
                    styles.safetyBanner,
                    isCritical
                        ? styles.bannerCritical
                        : isWarning
                          ? styles.bannerWarning
                          : styles.bannerSafe,
                ]}
                testID="weather-safety-badge"
            >
                <View style={styles.badgeIndicatorRow}>
                    <Text style={styles.badgeIcon}>
                        {isCritical ? '🛑' : isWarning ? '⚠️' : '✅'}
                    </Text>
                    <Text
                        style={[
                            styles.badgeText,
                            isCritical
                                ? styles.textCritical
                                : isWarning
                                  ? styles.textWarning
                                  : styles.textSafe,
                        ]}
                    >
                        {isCritical
                            ? 'MANDATORY STOP WORK (≥ 45 km/h)'
                            : isWarning
                              ? 'HIGH WIND CAUTION (36–44 km/h)'
                              : 'SAFE TO OPERATE (< 36 km/h)'}
                    </Text>
                </View>
                <Text style={styles.safetyMessage}>
                    {weather?.safety_message ??
                        'Wind speed within safe operating limits (< 36 km/h). Standard hoisting permitted.'}
                </Text>
            </View>

            {/* Weather Metrics Grid */}
            <View style={styles.metricsGrid}>
                <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Wind Speed</Text>
                    <Text style={styles.metricValue}>
                        {weather ? `${weather.wind_speed_kmh} km/h` : '--'}
                    </Text>
                    <Text style={styles.metricSub}>
                        {weather
                            ? `${(weather.wind_speed_kmh / 3.6).toFixed(1)} m/s`
                            : '--'}
                    </Text>
                </View>

                <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Peak Gusts</Text>
                    <Text
                        style={[
                            styles.metricValue,
                            isCritical || isWarning
                                ? styles.textCritical
                                : null,
                        ]}
                    >
                        {weather ? `${weather.wind_gusts_kmh} km/h` : '--'}
                    </Text>
                    <Text style={styles.metricSub}>10m mast level</Text>
                </View>

                <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Temp & Rain</Text>
                    <Text style={styles.metricValue}>
                        {weather ? `${weather.temperature_celsius}°C` : '--'}
                    </Text>
                    <Text style={styles.metricSub}>
                        {weather?.rain_intensity_mmh
                            ? `${weather.rain_intensity_mmh} mm/h rain`
                            : (weather?.weather_description ?? 'Clear')}
                    </Text>
                </View>
            </View>

            {/* Source info */}
            <View style={styles.footerRow}>
                <Text style={styles.sourceText}>
                    Source:{' '}
                    {weather?.source === 'tomorrow_io'
                        ? 'Tomorrow.io Radar'
                        : 'Open-Meteo ECMWF'}
                </Text>
                {onReportStandby && (
                    <Pressable
                        style={[
                            styles.standbyButton,
                            isCritical ? styles.standbyButtonCritical : null,
                        ]}
                        onPress={() => setIsStandbyModalOpen(true)}
                        testID="log-weather-standby-btn"
                    >
                        <Text style={styles.standbyButtonText}>
                            {isCritical
                                ? '🛑 Log Wind Hold & Free-Slew'
                                : '⏱️ Log Weather Delay'}
                        </Text>
                    </Pressable>
                )}
            </View>

            {/* Standby Logging Modal */}
            <Modal
                visible={isStandbyModalOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setIsStandbyModalOpen(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>
                            Log Weather Standby Delay
                        </Text>
                        <Text style={styles.modalSubtitle}>
                            Record certified weather downtime for client billing
                            and safety compliance.
                        </Text>

                        <Text style={styles.inputLabel}>
                            Physical Cab Anemometer Reading (km/h)
                        </Text>
                        <TextInput
                            style={styles.input}
                            keyboardType="numeric"
                            value={anemometerInput}
                            onChangeText={setAnemometerInput}
                            placeholder="e.g. 48.5"
                            placeholderTextColor={colors.muted}
                            testID="anemometer-input"
                        />

                        <Text style={styles.inputLabel}>Weather Reason</Text>
                        <View style={styles.reasonRow}>
                            <Pressable
                                testID="reason-high-wind"
                                style={[
                                    styles.reasonOption,
                                    selectedReason === 'high_wind' &&
                                        styles.reasonOptionActive,
                                ]}
                                onPress={() => setSelectedReason('high_wind')}
                            >
                                <Text
                                    style={[
                                        styles.reasonOptionText,
                                        selectedReason === 'high_wind' &&
                                            styles.reasonOptionTextActive,
                                    ]}
                                >
                                    🌬️ High Wind
                                </Text>
                            </Pressable>
                            <Pressable
                                testID="reason-thunderstorm"
                                style={[
                                    styles.reasonOption,
                                    selectedReason === 'thunderstorm' &&
                                        styles.reasonOptionActive,
                                ]}
                                onPress={() =>
                                    setSelectedReason('thunderstorm')
                                }
                            >
                                <Text
                                    style={[
                                        styles.reasonOptionText,
                                        selectedReason === 'thunderstorm' &&
                                            styles.reasonOptionTextActive,
                                    ]}
                                >
                                    ⚡ Lightning
                                </Text>
                            </Pressable>
                            <Pressable
                                testID="reason-heavy-rain"
                                style={[
                                    styles.reasonOption,
                                    selectedReason === 'heavy_rain' &&
                                        styles.reasonOptionActive,
                                ]}
                                onPress={() => setSelectedReason('heavy_rain')}
                            >
                                <Text
                                    style={[
                                        styles.reasonOptionText,
                                        selectedReason === 'heavy_rain' &&
                                            styles.reasonOptionTextActive,
                                    ]}
                                >
                                    🌧️ Heavy Rain
                                </Text>
                            </Pressable>
                        </View>

                        <Text style={styles.inputLabel}>
                            Remarks / Client Notice
                        </Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            multiline
                            numberOfLines={2}
                            value={remarks}
                            onChangeText={setRemarks}
                            placeholder="e.g. Advised Client Engineer Engr. Santos. Jib free-slewing engaged."
                            placeholderTextColor={colors.muted}
                        />

                        <View style={styles.modalActionRow}>
                            <Pressable
                                style={styles.modalCancelBtn}
                                onPress={() => setIsStandbyModalOpen(false)}
                            >
                                <Text style={styles.modalCancelBtnText}>
                                    Cancel
                                </Text>
                            </Pressable>
                            <Pressable
                                style={styles.modalSubmitBtn}
                                onPress={handleConfirmStandby}
                                testID="submit-weather-standby-btn"
                            >
                                <Text style={styles.modalSubmitBtnText}>
                                    Submit Standby Ticket
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 14,
        marginVertical: 8,
        ...shadows.md,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    headerTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.text,
    },
    headerSubtitle: {
        fontSize: 12,
        fontWeight: '500',
        color: colors.muted,
        marginTop: 1,
    },
    refreshButton: {
        padding: 6,
        borderRadius: 6,
    },
    safetyBanner: {
        borderRadius: 8,
        padding: 10,
        marginBottom: 12,
    },
    bannerSafe: {
        backgroundColor: '#ECFDF5',
        borderLeftWidth: 4,
        borderLeftColor: '#10B981',
    },
    bannerWarning: {
        backgroundColor: '#FFFBEB',
        borderLeftWidth: 4,
        borderLeftColor: '#F59E0B',
    },
    bannerCritical: {
        backgroundColor: '#FEF2F2',
        borderLeftWidth: 4,
        borderLeftColor: '#EF4444',
    },
    badgeIndicatorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    badgeIcon: {
        fontSize: 14,
    },
    badgeText: {
        fontSize: 13,
        fontWeight: '700',
    },
    textSafe: {
        color: '#047857',
    },
    textWarning: {
        color: '#B45309',
    },
    textCritical: {
        color: '#B91C1C',
    },
    safetyMessage: {
        fontSize: 12,
        color: colors.text,
        lineHeight: 16,
    },
    metricsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: '#F8FAFC',
        borderRadius: 8,
        padding: 10,
        marginBottom: 10,
    },
    metricItem: {
        flex: 1,
        alignItems: 'center',
    },
    metricLabel: {
        fontSize: 11,
        color: colors.muted,
        fontWeight: '600',
        marginBottom: 2,
    },
    metricValue: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.text,
    },
    metricSub: {
        fontSize: 10,
        color: colors.muted,
        marginTop: 2,
    },
    footerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 4,
    },
    sourceText: {
        fontSize: 11,
        color: colors.muted,
    },
    standbyButton: {
        backgroundColor: colors.surfaceMuted,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 6,
        paddingVertical: 6,
        paddingHorizontal: 10,
    },
    standbyButtonCritical: {
        backgroundColor: '#FEE2E2',
        borderColor: '#FCA5A5',
    },
    standbyButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.text,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalCard: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: colors.surface,
        borderRadius: 14,
        padding: 18,
        ...shadows.md,
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 4,
    },
    modalSubtitle: {
        fontSize: 12,
        color: colors.muted,
        marginBottom: 14,
        lineHeight: 16,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 6,
    },
    input: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        padding: 10,
        fontSize: 14,
        color: colors.text,
        marginBottom: 12,
    },
    textArea: {
        minHeight: 54,
    },
    reasonRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 12,
    },
    reasonOption: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 4,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 6,
        alignItems: 'center',
    },
    reasonOptionActive: {
        backgroundColor: '#EFF6FF',
        borderColor: '#3B82F6',
    },
    reasonOptionText: {
        fontSize: 11,
        fontWeight: '600',
        color: colors.muted,
    },
    reasonOptionTextActive: {
        color: '#1D4ED8',
    },
    modalActionRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
        marginTop: 6,
    },
    modalCancelBtn: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 6,
    },
    modalCancelBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.muted,
    },
    modalSubmitBtn: {
        backgroundColor: colors.primary,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 6,
    },
    modalSubmitBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: colors.white,
    },
});
