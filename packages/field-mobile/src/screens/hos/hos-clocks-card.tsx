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
    const { isDarkHud } = useTheme();

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
                {/* Dial 1: Drive / Operating Remaining */}
                <View
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
                        Drive / Operating
                    </Text>
                    <Text
                        style={[
                            styles.clockCellValueGreen,
                            isDarkHud && styles.darkClockCellValueGreen,
                        ]}
                    >
                        {formatHoursMinutes(driveRemainingHours)}
                    </Text>
                    <Text
                        style={[
                            styles.clockCellSub,
                            isDarkHud && styles.darkClockCellSub,
                        ]}
                    >
                        of {maxDriveHours}h limit
                    </Text>
                </View>

                {/* Dial 2: Shift Window Remaining */}
                <View
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
                        Shift Window
                    </Text>
                    <Text
                        style={[
                            styles.clockCellValueBlue,
                            isDarkHud && styles.darkClockCellValueBlue,
                        ]}
                    >
                        {formatHoursMinutes(shiftRemainingHours)}
                    </Text>
                    <Text
                        style={[
                            styles.clockCellSub,
                            isDarkHud && styles.darkClockCellSub,
                        ]}
                    >
                        of {maxShiftHours}h daily
                    </Text>
                </View>

                {/* Dial 3: 70-Hr Cycle Remaining */}
                <View
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
                        {cycleHoursLimit}-Hr 8-Day Cycle
                    </Text>
                    <Text
                        style={[
                            styles.clockCellValueAmber,
                            isDarkHud && styles.darkClockCellValueAmber,
                        ]}
                    >
                        {formatHoursMinutes(cycleRemainingHours)}
                    </Text>
                    <Text
                        style={[
                            styles.clockCellSub,
                            isDarkHud && styles.darkClockCellSub,
                        ]}
                    >
                        {cycleHoursElapsed === null
                            ? 'Unavailable'
                            : `${cycleHoursElapsed.toFixed(1)}h logged`}
                    </Text>
                </View>

                {/* Dial 4: Mandatory Rest Break Countdown */}
                <View
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
                        Break Countdown
                    </Text>
                    <Text
                        style={[
                            styles.clockCellValuePurple,
                            isDarkHud && styles.darkClockCellValuePurple,
                        ]}
                    >
                        {formatHoursMinutes(breakCountdownHours)}
                    </Text>
                    <Text
                        style={[
                            styles.clockCellSub,
                            isDarkHud && styles.darkClockCellSub,
                        ]}
                    >
                        until 30m rest
                    </Text>
                </View>
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
                        styles.clockCellValueBlue,
                        isDarkHud && styles.darkClockCellValueBlue,
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
                                width: `${shiftProgressPercent ?? 0}%`,
                            },
                            (shiftProgressPercent ?? 0) > 85
                                ? styles.gaugeFillRed
                                : (shiftProgressPercent ?? 0) > 70
                                  ? styles.gaugeFillAmber
                                  : styles.gaugeFillGreen,
                        ]}
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
                                styles.clockCellValueBlue,
                                isDarkHud && styles.darkClockCellValueBlue,
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
    clockCellValueAmber: {
        color: '#FFBF00',
        fontSize: 18,
        fontWeight: '900',
    },
    clockCellValueBlue: {
        color: '#2563EB',
        fontSize: 18,
        fontWeight: '900',
    },
    clockCellValueGreen: {
        color: '#059669',
        fontSize: 18,
        fontWeight: '900',
    },
    clockCellValuePurple: {
        color: '#7C3AED',
        fontSize: 18,
        fontWeight: '900',
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
    darkClockCellValueAmber: {
        color: '#FFBF00',
    },
    darkClockCellValueBlue: {
        color: '#60A5FA',
    },
    darkClockCellValueGreen: {
        color: '#34D399',
    },
    darkClockCellValuePurple: {
        color: '#C084FC',
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
    gaugeFillAmber: {
        backgroundColor: '#FFBF00',
    },
    gaugeFillGreen: {
        backgroundColor: '#10B981',
    },
    gaugeFillRed: {
        backgroundColor: '#EF4444',
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
