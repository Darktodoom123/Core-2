import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/common/Icon';
import type { HosComplianceResult } from '../../hooks/useHosCompliance';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import type { ShiftInfo } from '../../types/index';
import { formatHoursMinutes } from './hos-constants';

export interface HosClocksCardProps {
    breakCountdownHours: number | null;
    cycleHoursElapsed: number | null;
    cycleHoursLimit: number;
    cycleRemainingHours: number | null;
    driveRemainingHours: number | null;
    durationBreakdown: Array<[string, number | null]>;
    hasServerClock: boolean;
    hoursElapsed: HosComplianceResult['hoursElapsed'];
    isDoleCapExceeded: HosComplianceResult['isDoleCapExceeded'];
    isDoleWarning: HosComplianceResult['isDoleWarning'];
    limitCounterHours: HosComplianceResult['limitCounterHours'];
    maxDriveHours: number;
    maxShiftHours: number;
    shiftInfo: ShiftInfo;
    shiftProgressPercent: number | null;
    shiftRemainingHours: number | null;
    userRole: string;
}

/** At or under this many hours left, a clock is shown as a warning. */
const LOW_REMAINING_HOURS = 1;

type ClockTone = 'neutral' | 'warning' | 'hazard';

function getRemainingTone(remainingHours: number | null): ClockTone {
    if (remainingHours === null) {
        return 'neutral';
    }

    if (remainingHours <= 0) {
        return 'hazard';
    }

    return remainingHours <= LOW_REMAINING_HOURS ? 'warning' : 'neutral';
}

interface HosClockDialProps {
    id: 'drive' | 'shift' | 'cycle' | 'break';
    label: string;
    remainingHours: number | null;
    sublabel: string;
}

const HosClockDial: React.FC<HosClockDialProps> = ({
    id,
    label,
    remainingHours,
    sublabel,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const tone = getRemainingTone(remainingHours);
    const toneColor = {
        neutral: theme.textPrimary,
        warning: theme.warningOrangeText,
        hazard: theme.hazardRedText,
    }[tone];

    return (
        <View style={[styles.clockCell]}>
            <Text style={[styles.clockCellLabel]}>{label}</Text>
            <View style={styles.clockValueRow}>
                {tone === 'neutral' ? null : (
                    <View testID={`hos-clock-${id}-alert`}>
                        <Icon color={toneColor} name="alert" size={16} />
                    </View>
                )}
                <Text
                    style={[styles.clockCellValue, { color: toneColor }]}
                    testID={`hos-clock-${id}-value`}
                >
                    {formatHoursMinutes(remainingHours)}
                </Text>
            </View>
            <Text style={[styles.clockCellSub]}>{sublabel}</Text>
        </View>
    );
};

export const HosClocksCard: React.FC<HosClocksCardProps> = ({
    breakCountdownHours,
    cycleHoursElapsed,
    cycleHoursLimit,
    cycleRemainingHours,
    driveRemainingHours,
    durationBreakdown,
    hasServerClock,
    hoursElapsed,
    isDoleCapExceeded,
    isDoleWarning,
    limitCounterHours,
    maxDriveHours,
    maxShiftHours,
    shiftInfo,
    shiftProgressPercent,
    shiftRemainingHours,
    userRole,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const shiftProgress = shiftProgressPercent ?? 0;
    // DOLE-OSHC: warn at 9.0h, hard cap at 10.0h (server-backed flags).
    const doleTone: ClockTone = isDoleCapExceeded
        ? 'hazard'
        : isDoleWarning
          ? 'warning'
          : 'neutral';
    const gaugeFillColor = {
        neutral: theme.successEmerald,
        warning: theme.warningOrange,
        hazard: theme.hazardRed,
    }[doleTone];
    const counterColor = {
        neutral: theme.textPrimary,
        warning: theme.warningOrangeText,
        hazard: theme.hazardRedText,
    }[doleTone];

    return (
        <View style={[styles.clocksCard]} testID="hos-eld-clocks-card">
            <View style={styles.cardHeader}>
                <View style={styles.badgeRow}>
                    <Icon color={theme.textSecondary} name="clock" size={18} />
                    <Text style={[styles.clocksCardHeading]}>
                        LIVE ELD DUTY CLOCKS
                    </Text>
                </View>
                <Text style={[styles.cycleText]}>{userRole.toUpperCase()}</Text>
            </View>

            {/* 4-Cell Dials Grid */}
            <View style={styles.clocksGrid}>
                <HosClockDial
                    id="drive"
                    label="Drive / Operating"
                    remainingHours={driveRemainingHours}
                    sublabel={`of ${maxDriveHours}h limit`}
                />
                <HosClockDial
                    id="shift"
                    label="Shift Window"
                    remainingHours={shiftRemainingHours}
                    sublabel={`of ${maxShiftHours}h daily`}
                />
                <HosClockDial
                    id="cycle"
                    label={`${cycleHoursLimit}-Hr 8-Day Cycle`}
                    remainingHours={cycleRemainingHours}
                    sublabel={
                        cycleHoursElapsed === null
                            ? 'Unavailable'
                            : `${cycleHoursElapsed.toFixed(1)}h logged`
                    }
                />
                <HosClockDial
                    id="break"
                    label="Break Countdown"
                    remainingHours={breakCountdownHours}
                    sublabel="until 30m rest"
                />
            </View>

            <View
                accessibilityLabel="DOLE operating limit counter"
                style={[styles.limitCounterRow]}
            >
                <Text style={[styles.clockCellLabel]}>
                    {shiftInfo.limitCounterLabel ?? 'Operating + driving'} limit
                    counter
                </Text>
                <View style={styles.clockValueRow}>
                    {doleTone === 'neutral' ? null : (
                        <View testID="hos-limit-counter-alert">
                            <Icon color={counterColor} name="alert" size={16} />
                        </View>
                    )}
                    <Text
                        style={[styles.clockCellValue, { color: counterColor }]}
                        testID="hos-limit-counter-value"
                    >
                        {formatHoursMinutes(limitCounterHours)}
                    </Text>
                </View>
            </View>

            {/* Shift Progress Gauge Bar */}
            <View style={styles.gaugeContainer}>
                <View style={styles.gaugeMetaRow}>
                    <Text style={[styles.gaugeMetaLabel]}>
                        Daily Shift Elapsed:{' '}
                        {hasServerClock && hoursElapsed !== null
                            ? `${hoursElapsed.toFixed(1)} / ${maxShiftHours}h`
                            : 'Unavailable'}
                    </Text>
                    <Text style={[styles.gaugeMetaPercent]}>
                        {shiftProgressPercent === null
                            ? 'Unavailable'
                            : `${shiftProgressPercent}% Used`}
                    </Text>
                </View>
                <View style={[styles.gaugeTrack]}>
                    <View
                        style={[
                            styles.gaugeFill,
                            {
                                backgroundColor: gaugeFillColor,
                                width: `${shiftProgress}%`,
                            },
                        ]}
                        testID="hos-shift-gauge-fill"
                    />
                </View>
            </View>

            <View
                accessibilityLabel="Accepted shift duration breakdown"
                style={styles.clocksGrid}
                testID="hos-duration-breakdown"
            >
                {durationBreakdown.map(([label, value]) => (
                    <View key={label} style={[styles.clockCell]}>
                        <Text style={[styles.clockCellLabel]}>{label}</Text>
                        <Text
                            style={[
                                styles.clockCellValue,
                                { color: theme.textPrimary },
                            ]}
                        >
                            {formatHoursMinutes(value)}
                        </Text>
                        <Text style={[styles.clockCellSub]}>
                            {value === null
                                ? 'not synced yet'
                                : 'server accepted'}
                        </Text>
                    </View>
                ))}
            </View>
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        badgeRow: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: 6,
        },
        cardHeader: {
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 12,
        },
        clockCell: {
            backgroundColor: theme.surfaceHighlight,
            borderColor: theme.border,
            borderRadius: 10,
            borderWidth: 1,
            flex: 1,
            minWidth: '45%',
            padding: 12,
        },
        clockCellLabel: {
            color: theme.textSecondary,
            fontSize: 12,
            fontWeight: '700',
            marginBottom: 4,
        },
        clockCellSub: {
            color: theme.textSecondary,
            fontSize: 12,
            fontWeight: '500',
            marginTop: 2,
        },
        clockCellValue: {
            fontSize: 18,
            fontWeight: '700',
        },
        clockValueRow: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: 4,
        },
        clocksCard: {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: 16,
            borderWidth: 1,
            marginBottom: 16,
            padding: 16,
        },
        clocksCardHeading: {
            color: theme.textPrimary,
            fontSize: 13,
            fontWeight: '700',
            letterSpacing: 0.5,
        },
        clocksGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 10,
            marginBottom: 14,
        },
        cycleText: {
            color: theme.textSecondary,
            fontSize: 12,
            fontWeight: '700',
        },
        gaugeContainer: {
            marginTop: 2,
        },
        gaugeFill: {
            borderRadius: 6,
            height: '100%',
        },
        gaugeMetaLabel: {
            color: theme.textSecondary,
            fontSize: 12,
            fontWeight: '500',
        },
        gaugeMetaPercent: {
            color: theme.textPrimary,
            fontSize: 12,
            fontWeight: '700',
        },
        gaugeMetaRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 6,
        },
        gaugeTrack: {
            backgroundColor: theme.border,
            borderRadius: 6,
            height: 8,
            overflow: 'hidden',
            width: '100%',
        },
        limitCounterRow: {
            alignItems: 'center',
            backgroundColor: theme.surfaceHighlight,
            borderColor: theme.border,
            borderRadius: 10,
            borderWidth: 1,
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 14,
            paddingHorizontal: 12,
            paddingVertical: 10,
        },
    });
