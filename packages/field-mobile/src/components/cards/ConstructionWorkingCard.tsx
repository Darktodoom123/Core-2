import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { formatPHP } from '../../utils/formatters';
import { Icon } from '../common/Icon';
import { colors, shadows } from '../nativeStyles';

export interface ConstructionWorkingCardProps {
    jobReference: string;
    siteName?: string;
    shiftElapsed?: string;
    windSpeedKmh?: number;
    windSpeedLimitKmh?: number;
    activeWorkMinutes?: number;
    standbyMinutes?: number;
    weatherHoldMinutes?: number;
    standbyHourlyRatePHP?: number;
    onLogStandby?: () => void;
    onRequestFuel?: () => void;
    onSubmitDailyProgress?: () => void;
}

export const ConstructionWorkingCard: React.FC<
    ConstructionWorkingCardProps
> = ({
    jobReference,
    siteName = 'Construction Job Site',
    shiftElapsed = '05:42:18',
    windSpeedKmh = 14,
    windSpeedLimitKmh = 38,
    activeWorkMinutes = 255, // 4h 15m
    standbyMinutes = 87, // 1h 27m
    weatherHoldMinutes = 0,
    standbyHourlyRatePHP = 4500,
    onLogStandby,
    onRequestFuel,
    onSubmitDailyProgress,
}) => {
    const { isDarkHud } = useTheme();
    const isWindExceeded = windSpeedKmh >= windSpeedLimitKmh;

    const formatMinutes = (totalMin: number): string => {
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;

        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    const totalMinutes = Math.max(
        1,
        activeWorkMinutes + standbyMinutes + weatherHoldMinutes,
    );
    const activePercent = Math.round((activeWorkMinutes / totalMinutes) * 100);
    const standbyPercent = Math.round((standbyMinutes / totalMinutes) * 100);
    const weatherPercent = Math.max(0, 100 - activePercent - standbyPercent);

    return (
        <View style={styles.container} testID="construction-working-card">
            {/* Top Telemetry Row: Shift Timer & Wind Anemometer */}
            <View style={styles.telemetryRow}>
                <View
                    style={[
                        styles.timerBadge,
                        isDarkHud && styles.darkTimerBadge,
                    ]}
                    testID="live-shift-timer"
                >
                    <View
                        style={[
                            styles.pulseDot,
                            isDarkHud && styles.darkPulseDot,
                        ]}
                    />
                    <Text
                        style={[
                            styles.timerText,
                            isDarkHud && styles.darkTimerText,
                        ]}
                    >
                        Shift: {shiftElapsed} Elapsed
                    </Text>
                </View>

                <View
                    style={[
                        styles.windBadge,
                        isWindExceeded ? styles.windExceeded : styles.windSafe,
                        isDarkHud &&
                            (isWindExceeded
                                ? styles.darkWindExceeded
                                : styles.darkWindSafe),
                    ]}
                    testID="wind-speed-badge"
                >
                    <Icon
                        name="alert"
                        size={14}
                        color={
                            isWindExceeded
                                ? isDarkHud
                                    ? '#EF4444'
                                    : colors.redDark
                                : isDarkHud
                                  ? '#10B981'
                                  : colors.greenDark
                        }
                    />
                    <Text
                        style={[
                            styles.windText,
                            isWindExceeded
                                ? styles.windTextExceeded
                                : styles.windTextSafe,
                            isDarkHud &&
                                (isWindExceeded
                                    ? styles.darkWindTextExceeded
                                    : styles.darkWindTextSafe),
                        ]}
                    >
                        Wind: {windSpeedKmh} km/h (Max {windSpeedLimitKmh})
                    </Text>
                </View>
            </View>

            {/* Machined Operations Card */}
            <View style={[styles.card, isDarkHud && styles.darkCard]}>
                <View style={styles.phaseHeader}>
                    <View>
                        <Text
                            style={[
                                styles.phaseLabel,
                                isDarkHud && styles.darkPhaseLabel,
                            ]}
                        >
                            ACTIVE PHASE • PHILIPPINES
                        </Text>
                        <Text
                            style={[
                                styles.phaseTitle,
                                isDarkHud && styles.darkPhaseTitle,
                            ]}
                        >
                            WORKING ON SITE
                        </Text>
                    </View>
                    <View
                        style={[
                            styles.refBadge,
                            isDarkHud && styles.darkRefBadge,
                        ]}
                    >
                        <Text
                            style={[
                                styles.jobRef,
                                isDarkHud && styles.darkJobRef,
                            ]}
                        >
                            {jobReference}
                        </Text>
                    </View>
                </View>

                {siteName ? (
                    <Text
                        style={[
                            styles.siteName,
                            isDarkHud && styles.darkSiteName,
                        ]}
                    >
                        {siteName}
                    </Text>
                ) : null}

                {/* Continuous Multi-Segment Time & Demurrage Ledger */}
                <View
                    style={[
                        styles.timeBreakdownSection,
                        isDarkHud && styles.darkTimeBreakdownSection,
                    ]}
                >
                    <View style={styles.sectionTitleRow}>
                        <Text
                            style={[
                                styles.timeBreakdownTitle,
                                isDarkHud && styles.darkTimeBreakdownTitle,
                            ]}
                        >
                            TIME ALLOCATION (DEMURRAGE TRACKER)
                        </Text>
                        <Text
                            style={[
                                styles.rateSubtitle,
                                isDarkHud && styles.darkRateSubtitle,
                            ]}
                        >
                            Standby Rate:{' '}
                            {formatPHP(standbyHourlyRatePHP, false)}/hr
                        </Text>
                    </View>

                    {/* Continuous Multi-Segment Timeline Bar */}
                    <View style={styles.multiSegmentBar}>
                        <View
                            style={[
                                styles.segmentActive,
                                { width: `${activePercent}%` },
                            ]}
                        />
                        <View
                            style={[
                                styles.segmentStandby,
                                { width: `${standbyPercent}%` },
                            ]}
                        />
                        {weatherPercent > 0 && (
                            <View
                                style={[
                                    styles.segmentWeather,
                                    { width: `${weatherPercent}%` },
                                ]}
                            />
                        )}
                    </View>

                    <View style={styles.timePillsRow}>
                        <View
                            style={[
                                styles.timePill,
                                styles.activeWorkPill,
                                isDarkHud && styles.darkActiveWorkPill,
                            ]}
                        >
                            <View style={styles.pillIndicatorActive} />
                            <View>
                                <Text
                                    style={[
                                        styles.timePillLabel,
                                        isDarkHud && styles.darkTimePillLabel,
                                    ]}
                                >
                                    Active Work
                                </Text>
                                <Text
                                    style={[
                                        styles.timePillValue,
                                        isDarkHud && styles.darkTimePillValue,
                                    ]}
                                >
                                    {formatMinutes(activeWorkMinutes)}
                                </Text>
                            </View>
                        </View>

                        <View
                            style={[
                                styles.timePill,
                                styles.standbyPill,
                                isDarkHud && styles.darkStandbyPill,
                            ]}
                        >
                            <View style={styles.pillIndicatorStandby} />
                            <View>
                                <Text
                                    style={[
                                        styles.timePillLabel,
                                        isDarkHud && styles.darkTimePillLabel,
                                    ]}
                                >
                                    Standby / Delay
                                </Text>
                                <Text
                                    style={[
                                        styles.timePillValue,
                                        isDarkHud && styles.darkTimePillValue,
                                    ]}
                                >
                                    {formatMinutes(standbyMinutes)}
                                </Text>
                            </View>
                        </View>

                        <View
                            style={[
                                styles.timePill,
                                styles.weatherPill,
                                isDarkHud && styles.darkWeatherPill,
                            ]}
                        >
                            <View style={styles.pillIndicatorWeather} />
                            <View>
                                <Text
                                    style={[
                                        styles.timePillLabel,
                                        isDarkHud && styles.darkTimePillLabel,
                                    ]}
                                >
                                    Weather Hold
                                </Text>
                                <Text
                                    style={[
                                        styles.timePillValue,
                                        isDarkHud && styles.darkTimePillValue,
                                    ]}
                                >
                                    {formatMinutes(weatherHoldMinutes)}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Glove-Friendly Field Action Rockers */}
                <View style={styles.actionGrid}>
                    <Pressable
                        accessibilityLabel="Log Standby Delay"
                        accessibilityRole="button"
                        onPress={onLogStandby}
                        style={({ pressed }) => [
                            styles.standbyBtn,
                            isDarkHud && styles.darkStandbyBtn,
                            pressed && styles.pressed,
                        ]}
                        testID="log-standby-button"
                    >
                        <Icon
                            name="clock"
                            size={16}
                            color={isDarkHud ? '#F59E0B' : colors.amberDark}
                        />
                        <Text
                            style={[
                                styles.standbyBtnText,
                                isDarkHud && styles.darkStandbyBtnText,
                            ]}
                        >
                            + Log Standby Delay
                        </Text>
                    </Pressable>

                    <Pressable
                        accessibilityLabel="Request Fuel Bowser"
                        accessibilityRole="button"
                        onPress={onRequestFuel}
                        style={({ pressed }) => [
                            styles.fuelBtn,
                            isDarkHud && styles.darkFuelBtn,
                            pressed && styles.pressed,
                        ]}
                        testID="request-fuel-button"
                    >
                        <Icon
                            name="fuel"
                            size={16}
                            color={isDarkHud ? '#F8FAFC' : colors.text}
                        />
                        <Text
                            style={[
                                styles.fuelBtnText,
                                isDarkHud && styles.darkFuelBtnText,
                            ]}
                        >
                            Request Fuel
                        </Text>
                    </Pressable>
                </View>

                {/* Primary Daily Progress / Shift Completion 52px Pedal */}
                <Pressable
                    accessibilityLabel="Submit Daily Progress / Complete Shift"
                    accessibilityRole="button"
                    onPress={onSubmitDailyProgress}
                    style={({ pressed }) => [
                        styles.submitShiftBtn,
                        isDarkHud && styles.darkSubmitShiftBtn,
                        pressed && styles.pressed,
                    ]}
                    testID="submit-daily-progress-button"
                >
                    <Icon
                        name="check-circle"
                        size={18}
                        color={isDarkHud ? '#0F172A' : '#FFFFFF'}
                    />
                    <Text
                        style={[
                            styles.submitShiftBtnText,
                            isDarkHud && styles.darkSubmitShiftBtnText,
                        ]}
                    >
                        Submit Daily Progress / Complete Shift
                    </Text>
                </Pressable>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    telemetryRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 10,
    },
    timerBadge: {
        alignItems: 'center',
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
        borderRadius: 10,
        borderWidth: 1,
        flex: 1,
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    darkTimerBadge: {
        backgroundColor: '#064E3B',
        borderColor: '#059669',
    },
    pulseDot: {
        backgroundColor: colors.green,
        borderRadius: 4,
        height: 8,
        width: 8,
    },
    darkPulseDot: {
        backgroundColor: '#34D399',
    },
    timerText: {
        color: colors.greenDark,
        fontSize: 13,
        fontWeight: '700',
    },
    darkTimerText: {
        color: '#ECFDF5',
    },
    windBadge: {
        alignItems: 'center',
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    windSafe: {
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
    },
    darkWindSafe: {
        backgroundColor: '#064E3B',
        borderColor: '#059669',
    },
    windExceeded: {
        backgroundColor: colors.redLight,
        borderColor: colors.redBorder,
    },
    darkWindExceeded: {
        backgroundColor: '#7F1D1D',
        borderColor: '#EF4444',
    },
    windText: {
        fontSize: 13,
        fontWeight: '700',
    },
    windTextSafe: {
        color: colors.greenDark,
    },
    darkWindTextSafe: {
        color: '#34D399',
    },
    windTextExceeded: {
        color: colors.redDark,
    },
    darkWindTextExceeded: {
        color: '#FCA5A5',
    },
    card: {
        backgroundColor: colors.surface,
        borderColor: colors.borderStrong,
        borderRadius: 14,
        borderWidth: 1,
        padding: 16,
        ...shadows.sm,
    },
    darkCard: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
    },
    phaseHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    phaseLabel: {
        color: colors.muted,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    darkPhaseLabel: {
        color: '#94A3B8',
    },
    phaseTitle: {
        color: colors.text,
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: -0.2,
    },
    darkPhaseTitle: {
        color: '#F8FAFC',
    },
    refBadge: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    darkRefBadge: {
        backgroundColor: '#1E293B',
        borderColor: '#475569',
    },
    jobRef: {
        color: colors.primary,
        fontFamily: 'monospace',
        fontSize: 12,
        fontWeight: '700',
    },
    darkJobRef: {
        color: '#38BDF8',
    },
    siteName: {
        color: colors.textSecondary,
        fontSize: 14,
        marginBottom: 12,
    },
    darkSiteName: {
        color: '#CBD5E1',
    },
    timeBreakdownSection: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.borderSubtle,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 14,
        padding: 12,
    },
    darkTimeBreakdownSection: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    sectionTitleRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    timeBreakdownTitle: {
        color: colors.textSecondary,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    darkTimeBreakdownTitle: {
        color: '#CBD5E1',
    },
    rateSubtitle: {
        color: colors.amberDark,
        fontFamily: 'monospace',
        fontSize: 11,
        fontWeight: '700',
    },
    darkRateSubtitle: {
        color: '#FBBF24',
    },
    multiSegmentBar: {
        borderRadius: 4,
        flexDirection: 'row',
        height: 8,
        marginBottom: 10,
        overflow: 'hidden',
    },
    segmentActive: {
        backgroundColor: '#059669',
    },
    segmentStandby: {
        backgroundColor: '#F59E0B',
    },
    segmentWeather: {
        backgroundColor: '#EA580C',
    },
    timePillsRow: {
        flexDirection: 'row',
        gap: 6,
    },
    timePill: {
        alignItems: 'center',
        borderRadius: 8,
        borderWidth: 1,
        flex: 1,
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 8,
        paddingVertical: 6,
    },
    pillIndicatorActive: {
        backgroundColor: '#059669',
        borderRadius: 3,
        height: 6,
        width: 6,
    },
    pillIndicatorStandby: {
        backgroundColor: '#F59E0B',
        borderRadius: 3,
        height: 6,
        width: 6,
    },
    pillIndicatorWeather: {
        backgroundColor: '#EA580C',
        borderRadius: 3,
        height: 6,
        width: 6,
    },
    activeWorkPill: {
        backgroundColor: colors.surface,
        borderColor: colors.greenBorder,
    },
    darkActiveWorkPill: {
        backgroundColor: '#0F172A',
        borderColor: '#059669',
    },
    standbyPill: {
        backgroundColor: colors.surface,
        borderColor: colors.amberBorder,
    },
    darkStandbyPill: {
        backgroundColor: '#0F172A',
        borderColor: '#D97706',
    },
    weatherPill: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
    },
    darkWeatherPill: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
    },
    timePillLabel: {
        color: colors.muted,
        fontSize: 10,
        fontWeight: '600',
    },
    darkTimePillLabel: {
        color: '#94A3B8',
    },
    timePillValue: {
        color: colors.text,
        fontSize: 12,
        fontWeight: '700',
    },
    darkTimePillValue: {
        color: '#F8FAFC',
    },
    actionGrid: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    standbyBtn: {
        alignItems: 'center',
        backgroundColor: colors.amberLight,
        borderColor: colors.amberBorder,
        borderRadius: 10,
        borderWidth: 1,
        flex: 1,
        flexDirection: 'row',
        gap: 6,
        justifyContent: 'center',
        minHeight: 48,
        paddingHorizontal: 12,
    },
    darkStandbyBtn: {
        backgroundColor: '#1E293B',
        borderColor: '#F59E0B',
    },
    standbyBtnText: {
        color: colors.amberDark,
        fontSize: 13,
        fontWeight: '700',
    },
    darkStandbyBtnText: {
        color: '#FBBF24',
    },
    fuelBtn: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.borderStrong,
        borderRadius: 10,
        borderWidth: 1,
        flex: 1,
        flexDirection: 'row',
        gap: 6,
        justifyContent: 'center',
        minHeight: 48,
        paddingHorizontal: 12,
    },
    darkFuelBtn: {
        backgroundColor: '#1E293B',
        borderColor: '#475569',
    },
    fuelBtnText: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '700',
    },
    darkFuelBtnText: {
        color: '#F8FAFC',
    },
    submitShiftBtn: {
        alignItems: 'center',
        backgroundColor: colors.surfaceDark,
        borderRadius: 10,
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
        minHeight: 52,
        paddingHorizontal: 16,
    },
    darkSubmitShiftBtn: {
        backgroundColor: '#10B981',
    },
    submitShiftBtnText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: 0.2,
        textTransform: 'uppercase',
    },
    darkSubmitShiftBtnText: {
        color: '#0F172A',
    },
    pressed: {
        opacity: 0.85,
    },
});
