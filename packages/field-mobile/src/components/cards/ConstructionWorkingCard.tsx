import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../common/Icon';
import { colors, shadows } from '../nativeStyles';

export interface ConstructionWorkingCardProps {
    jobReference: string;
    siteName?: string;
    shiftElapsed?: string;
    windSpeedKmh?: number;
    windSpeedLimitKmh?: number;
    liftsCompleted?: number;
    liftsTotal?: number;
    activeWorkMinutes?: number;
    standbyMinutes?: number;
    weatherHoldMinutes?: number;
    onLogLift?: () => void;
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
    liftsCompleted = 6,
    liftsTotal = 10,
    activeWorkMinutes = 255, // 4h 15m
    standbyMinutes = 87, // 1h 27m
    weatherHoldMinutes = 0,
    onLogLift,
    onLogStandby,
    onRequestFuel,
    onSubmitDailyProgress,
}) => {
    const isWindExceeded = windSpeedKmh >= windSpeedLimitKmh;

    const formatMinutes = (totalMin: number): string => {
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;

        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    const liftProgressPercent =
        liftsTotal > 0
            ? Math.min(100, Math.round((liftsCompleted / liftsTotal) * 100))
            : 0;

    return (
        <View style={styles.container} testID="construction-working-card">
            {/* Header: Shift Timer & Wind Telemetry */}
            <View style={styles.telemetryRow}>
                <View style={styles.timerBadge} testID="live-shift-timer">
                    <View style={styles.pulseDot} />
                    <Text style={styles.timerText}>
                        Shift: {shiftElapsed} Elapsed
                    </Text>
                </View>

                <View
                    style={[
                        styles.windBadge,
                        isWindExceeded ? styles.windExceeded : styles.windSafe,
                    ]}
                    testID="wind-speed-badge"
                >
                    <Icon
                        name="alert"
                        size={14}
                        color={
                            isWindExceeded ? colors.redDark : colors.greenDark
                        }
                    />
                    <Text
                        style={[
                            styles.windText,
                            isWindExceeded
                                ? styles.windTextExceeded
                                : styles.windTextSafe,
                        ]}
                    >
                        Wind: {windSpeedKmh} km/h (Max {windSpeedLimitKmh})
                    </Text>
                </View>
            </View>

            {/* Active Construction Working Card */}
            <View style={styles.card}>
                <View style={styles.phaseHeader}>
                    <View>
                        <Text style={styles.phaseLabel}>ACTIVE PHASE</Text>
                        <Text style={styles.phaseTitle}>WORKING ON SITE</Text>
                    </View>
                    <Text style={styles.jobRef}>{jobReference}</Text>
                </View>

                {siteName ? (
                    <Text style={styles.siteName}>{siteName}</Text>
                ) : null}

                {/* Incremental Lift Counter */}
                <View style={styles.liftSection} testID="lift-counter-section">
                    <View style={styles.liftHeader}>
                        <Text style={styles.liftTitle}>
                            Lifts: {liftsCompleted} / {liftsTotal} (
                            {liftProgressPercent}%)
                        </Text>
                        <Pressable
                            accessibilityLabel="Log Completed Lift"
                            accessibilityRole="button"
                            onPress={onLogLift}
                            style={({ pressed }) => [
                                styles.logLiftBtn,
                                pressed && styles.pressed,
                            ]}
                            testID="log-lift-button"
                        >
                            <Icon
                                name="check-circle"
                                size={14}
                                color="#FFFFFF"
                            />
                            <Text style={styles.logLiftBtnText}>
                                + Log Lift
                            </Text>
                        </Pressable>
                    </View>

                    <View style={styles.progressBarTrack}>
                        <View
                            style={[
                                styles.progressBarFill,
                                { width: `${liftProgressPercent}%` },
                            ]}
                        />
                    </View>
                </View>

                {/* Time Allocation Breakdown */}
                <View style={styles.timeBreakdownSection}>
                    <Text style={styles.timeBreakdownTitle}>
                        TIME ALLOCATION (DEMURRAGE TRACKER)
                    </Text>
                    <View style={styles.timePillsRow}>
                        <View style={[styles.timePill, styles.activeWorkPill]}>
                            <Text style={styles.timePillLabel}>
                                Active Work
                            </Text>
                            <Text style={styles.timePillValue}>
                                {formatMinutes(activeWorkMinutes)}
                            </Text>
                        </View>

                        <View style={[styles.timePill, styles.standbyPill]}>
                            <Text style={styles.timePillLabel}>
                                Standby / Delay
                            </Text>
                            <Text style={styles.timePillValue}>
                                {formatMinutes(standbyMinutes)}
                            </Text>
                        </View>

                        <View style={[styles.timePill, styles.weatherPill]}>
                            <Text style={styles.timePillLabel}>
                                Weather Hold
                            </Text>
                            <Text style={styles.timePillValue}>
                                {formatMinutes(weatherHoldMinutes)}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Field Action Buttons Grid */}
                <View style={styles.actionGrid}>
                    <Pressable
                        accessibilityLabel="Log Standby Delay"
                        accessibilityRole="button"
                        onPress={onLogStandby}
                        style={({ pressed }) => [
                            styles.standbyBtn,
                            pressed && styles.pressed,
                        ]}
                        testID="log-standby-button"
                    >
                        <Icon name="clock" size={16} color={colors.amberDark} />
                        <Text style={styles.standbyBtnText}>
                            Log Standby Delay
                        </Text>
                    </Pressable>

                    <Pressable
                        accessibilityLabel="Request Fuel Bowser"
                        accessibilityRole="button"
                        onPress={onRequestFuel}
                        style={({ pressed }) => [
                            styles.fuelBtn,
                            pressed && styles.pressed,
                        ]}
                        testID="request-fuel-button"
                    >
                        <Icon name="fuel" size={16} color={colors.text} />
                        <Text style={styles.fuelBtnText}>Request Fuel</Text>
                    </Pressable>
                </View>

                {/* Primary Daily Progress Submission */}
                <Pressable
                    accessibilityLabel="Submit Daily Progress / Complete Shift"
                    accessibilityRole="button"
                    onPress={onSubmitDailyProgress}
                    style={({ pressed }) => [
                        styles.submitShiftBtn,
                        pressed && styles.pressed,
                    ]}
                    testID="submit-daily-progress-button"
                >
                    <Icon name="check-circle" size={18} color="#FFFFFF" />
                    <Text style={styles.submitShiftBtnText}>
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
        borderRadius: 12,
        borderWidth: 1,
        flex: 1,
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    pulseDot: {
        backgroundColor: colors.greenDark,
        borderRadius: 4,
        height: 8,
        width: 8,
    },
    timerText: {
        color: colors.greenDark,
        fontSize: 12,
        fontWeight: '700',
    },
    windBadge: {
        alignItems: 'center',
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    windSafe: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
    },
    windExceeded: {
        backgroundColor: colors.redLight,
        borderColor: colors.redBorder,
    },
    windText: {
        fontSize: 12,
        fontWeight: '600',
    },
    windTextSafe: {
        color: colors.text,
    },
    windTextExceeded: {
        color: colors.redDark,
        fontWeight: '700',
    },
    card: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 16,
        borderWidth: 1,
        padding: 16,
        ...shadows.sm,
    },
    phaseHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    phaseLabel: {
        color: colors.muted,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    phaseTitle: {
        color: colors.text,
        fontSize: 18,
        fontWeight: '800',
        marginTop: 2,
    },
    jobRef: {
        color: colors.blueDark,
        fontSize: 13,
        fontWeight: '700',
    },
    siteName: {
        color: colors.muted,
        fontSize: 13,
        marginTop: 4,
    },
    liftSection: {
        backgroundColor: colors.surfaceMuted,
        borderRadius: 12,
        marginTop: 14,
        padding: 12,
    },
    liftHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    liftTitle: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '700',
    },
    logLiftBtn: {
        alignItems: 'center',
        backgroundColor: colors.blueDark,
        borderRadius: 8,
        flexDirection: 'row',
        gap: 4,
        minHeight: 36,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    logLiftBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    progressBarTrack: {
        backgroundColor: colors.border,
        borderRadius: 4,
        height: 8,
        overflow: 'hidden',
        width: '100%',
    },
    progressBarFill: {
        backgroundColor: colors.blueDark,
        borderRadius: 4,
        height: '100%',
    },
    timeBreakdownSection: {
        marginTop: 14,
    },
    timeBreakdownTitle: {
        color: colors.muted,
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.5,
        marginBottom: 6,
    },
    timePillsRow: {
        flexDirection: 'row',
        gap: 6,
    },
    timePill: {
        borderRadius: 8,
        borderWidth: 1,
        flex: 1,
        padding: 8,
    },
    activeWorkPill: {
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
    },
    standbyPill: {
        backgroundColor: colors.amberLight,
        borderColor: colors.amberBorder,
    },
    weatherPill: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
    },
    timePillLabel: {
        color: colors.text,
        fontSize: 10,
        fontWeight: '600',
    },
    timePillValue: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '700',
        marginTop: 2,
    },
    actionGrid: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 14,
    },
    standbyBtn: {
        alignItems: 'center',
        backgroundColor: colors.amberLight,
        borderColor: colors.amberBorder,
        borderRadius: 12,
        borderWidth: 1,
        flex: 1,
        flexDirection: 'row',
        gap: 6,
        justifyContent: 'center',
        minHeight: 48,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    standbyBtnText: {
        color: colors.amberDark,
        fontSize: 13,
        fontWeight: '700',
    },
    fuelBtn: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        flex: 1,
        flexDirection: 'row',
        gap: 6,
        justifyContent: 'center',
        minHeight: 48,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    fuelBtnText: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '700',
    },
    submitShiftBtn: {
        alignItems: 'center',
        backgroundColor: colors.text,
        borderRadius: 12,
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
        marginTop: 12,
        minHeight: 48,
        paddingHorizontal: 16,
        paddingVertical: 12,
        ...shadows.sm,
    },
    submitShiftBtnText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
    pressed: {
        opacity: 0.8,
        transform: [{ scale: 0.985 }],
    },
});
