import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/common/Icon';
import type { HosComplianceResult } from '../../hooks/useHosCompliance';
import { useTheme } from '../../theme';
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
    const { isDarkHud, theme } = useTheme();
    const tone = getRemainingTone(remainingHours);
    const toneColor = {
        neutral: theme.textPrimary,
        warning: theme.warningOrangeText,
        hazard: theme.hazardRedText,
    }[tone];

    return (
        <View style={[styles.clockCell, isDarkHud && styles.darkClockCell]}>
            <Text
                style={[
                    styles.clockCellLabel,
                    isDarkHud && styles.darkClockCellLabel,
                ]}
            >
                {label}
            </Text>
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
            <Text
                style={[
                    styles.clockCellSub,
                    isDarkHud && styles.darkClockCellSub,
                ]}
            >
                {sublabel}
            </Text>
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
    limitCounterHours,
    maxDriveHours,
    maxShiftHours,
    shiftInfo,
    shiftProgressPercent,
    shiftRemainingHours,
    userRole,
}) => {
    const { isDarkHud, theme } = useTheme();
    const shiftProgress = shiftProgressPercent ?? 0;
    const gaugeFillColor =
        shiftProgress > 85
            ? theme.hazardRed
            : shiftProgress > 70
              ? theme.warningOrange
              : theme.successEmerald;

    return (
        <View
            style={[styles.clocksCard, isDarkHud && styles.darkClocksCard]}
            testID="hos-eld-clocks-card"
        >
            <View style={styles.cardHeader}>
                <View style={styles.badgeRow}>
                    <Icon
                        color={isDarkHud ? '#34D399' : '#059669'}
                        name="clock"
                        size={18}
                    />
                    <Text
                        style={[
                            styles.clocksCardHeading,
                            isDarkHud && styles.darkClocksCardHeading,
                        ]}
                    >
                        LIVE ELD DUTY CLOCKS
                    </Text>
                </View>
                <Text
                    style={[
                        styles.cycleText,
                        isDarkHud && styles.darkCycleText,
                    ]}
                >
                    {userRole.toUpperCase()}
                </Text>
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
                style={[
                    styles.limitCounterRow,
                    isDarkHud && styles.darkLimitCounterRow,
                ]}
            >
                <Text
                    style={[
                        styles.clockCellLabel,
                        isDarkHud && styles.darkClockCellLabel,
                    ]}
                >
                    {shiftInfo.limitCounterLabel ?? 'Operating + driving'} limit
                    counter
                </Text>
                <Text
                    style={[
                        styles.clockCellValue,
                        { color: theme.textPrimary },
                    ]}
                >
                    {formatHoursMinutes(limitCounterHours)}
                </Text>
            </View>

            {/* Shift Progress Gauge Bar */}
            <View style={styles.gaugeContainer}>
                <View style={styles.gaugeMetaRow}>
                    <Text
                        style={[
                            styles.gaugeMetaLabel,
                            isDarkHud && styles.darkGaugeMetaLabel,
                        ]}
                    >
                        Daily Shift Elapsed:{' '}
                        {hasServerClock && hoursElapsed !== null
                            ? `${hoursElapsed.toFixed(1)} / ${maxShiftHours}h`
                            : 'Unavailable'}
                    </Text>
                    <Text
                        style={[
                            styles.gaugeMetaPercent,
                            isDarkHud && styles.darkGaugeMetaPercent,
                        ]}
                    >
                        {shiftProgressPercent === null
                            ? 'Unavailable'
                            : `${shiftProgressPercent}% Used`}
                    </Text>
                </View>
                <View
                    style={[
                        styles.gaugeTrack,
                        isDarkHud && styles.darkGaugeTrack,
                    ]}
                >
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
                    <View
                        key={label}
                        style={[
                            styles.clockCell,
                            isDarkHud && styles.darkClockCell,
                        ]}
                    >
                        <Text
                            style={[
                                styles.clockCellLabel,
                                isDarkHud && styles.darkClockCellLabel,
                            ]}
                        >
                            {label}
                        </Text>
                        <Text
                            style={[
                                styles.clockCellValue,
                                { color: theme.textPrimary },
                            ]}
                        >
                            {formatHoursMinutes(value)}
                        </Text>
                        <Text
                            style={[
                                styles.clockCellSub,
                                isDarkHud && styles.darkClockCellSub,
                            ]}
                        >
                            server accepted
                        </Text>
                    </View>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
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
        backgroundColor: '#F8FAFC',
        borderColor: '#E2E8F0',
        borderRadius: 10,
        borderWidth: 1,
        flex: 1,
        minWidth: '45%',
        padding: 12,
    },
    clockCellLabel: {
        color: '#64748B',
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 4,
    },
    clockCellSub: {
        color: '#94A3B8',
        fontSize: 12,
        fontWeight: '600',
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
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E8F0',
        borderRadius: 14,
        borderWidth: 1,
        elevation: 2,
        marginBottom: 16,
        padding: 16,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
    },
    clocksCardHeading: {
        color: '#059669',
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    clocksGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 14,
    },
    cycleText: {
        color: '#64748B',
        fontSize: 12,
        fontWeight: '700',
    },
    darkClockCell: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
    },
    darkClockCellLabel: {
        color: '#94A3B8',
    },
    darkClockCellSub: {
        color: '#64748B',
    },
    darkClocksCard: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
        shadowColor: '#000000',
        shadowOpacity: 0.25,
        shadowRadius: 6,
    },
    darkClocksCardHeading: {
        color: '#34D399',
    },
    darkCycleText: {
        color: '#94A3B8',
    },
    darkGaugeMetaLabel: {
        color: '#94A3B8',
    },
    darkGaugeMetaPercent: {
        color: '#F8FAFC',
    },
    darkGaugeTrack: {
        backgroundColor: '#0F172A',
    },
    darkLimitCounterRow: {
        backgroundColor: '#172554',
        borderColor: '#1D4ED8',
    },
    gaugeContainer: {
        marginTop: 2,
    },
    gaugeFill: {
        borderRadius: 6,
        height: '100%',
    },
    gaugeMetaLabel: {
        color: '#64748B',
        fontSize: 12,
        fontWeight: '600',
    },
    gaugeMetaPercent: {
        color: '#0F172A',
        fontSize: 12,
        fontWeight: '800',
    },
    gaugeMetaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    gaugeTrack: {
        backgroundColor: '#E2E8F0',
        borderRadius: 6,
        height: 8,
        overflow: 'hidden',
        width: '100%',
    },
    limitCounterRow: {
        alignItems: 'center',
        backgroundColor: '#EFF6FF',
        borderColor: '#BFDBFE',
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 14,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
});
