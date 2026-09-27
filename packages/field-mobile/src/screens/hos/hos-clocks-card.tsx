import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/common/Icon';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import {
    DOLE_CAP_HOURS,
    DOLE_WARNING_HOURS,
    formatHoursMinutes,
} from './hos-constants';

export interface HosClocksCardProps {
    /** The server reports a shift in progress. */
    shiftActive: boolean;
    /** When the shift started, as shown to the operator. */
    startedAt: string | null;
    /** Server total of operating + driving today, in hours. */
    limitCounterHours: number | null;
    isDoleWarning: boolean;
    isDoleCapExceeded: boolean;
    /** Server-accepted time per duty type, in hours. */
    durationBreakdown: Array<[string, number | null]>;
}

type Tone = 'neutral' | 'warning' | 'hazard';

/**
 * The shift's clock against the DOLE-OSHC operating limit (warning at 9h,
 * stop at 10h of operating + driving), and time per duty type. Only server
 * totals are shown; nothing is estimated on the phone.
 */
export const HosClocksCard: React.FC<HosClocksCardProps> = ({
    shiftActive,
    startedAt,
    limitCounterHours,
    isDoleWarning,
    isDoleCapExceeded,
    durationBreakdown,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);

    if (!shiftActive) {
        return (
            <View style={styles.card} testID="hos-clocks-card">
                <Text style={styles.heading}>SHIFT CLOCK</Text>
                <View style={styles.empty} testID="hos-clocks-empty">
                    <Icon color={theme.textSecondary} name="clock" size={22} />
                    <View style={styles.emptyCopy}>
                        <Text style={styles.emptyTitle}>No shift running</Text>
                        <Text style={styles.emptyBody}>
                            Your totals start when you go on duty.
                        </Text>
                    </View>
                </View>
            </View>
        );
    }

    const tone: Tone = isDoleCapExceeded
        ? 'hazard'
        : isDoleWarning
          ? 'warning'
          : 'neutral';
    const toneColor = {
        neutral: theme.textPrimary,
        warning: theme.warningOrangeText,
        hazard: theme.hazardRedText,
    }[tone];
    const fillColor = {
        neutral: theme.successEmerald,
        warning: theme.warningOrange,
        hazard: theme.hazardRed,
    }[tone];
    const percent =
        limitCounterHours === null
            ? 0
            : Math.min(100, (limitCounterHours / DOLE_CAP_HOURS) * 100);

    return (
        <View style={styles.card} testID="hos-clocks-card">
            <View style={styles.headerRow}>
                <Text style={styles.heading}>SHIFT CLOCK</Text>
                {startedAt ? (
                    <Text style={styles.since}>{`Since ${startedAt}`}</Text>
                ) : null}
            </View>

            <View
                accessibilityLabel={
                    limitCounterHours === null
                        ? 'Operating and driving time: waiting for server totals'
                        : `Operating and driving: ${formatHoursMinutes(limitCounterHours)} of ${DOLE_CAP_HOURS} hours`
                }
                style={styles.counter}
                testID="hos-limit-counter"
            >
                <Text style={styles.counterLabel}>Operating + driving</Text>
                {limitCounterHours === null ? (
                    <Text
                        style={styles.waiting}
                        testID="hos-limit-counter-waiting"
                    >
                        Waiting for server totals
                    </Text>
                ) : (
                    <View style={styles.valueRow}>
                        {tone === 'neutral' ? null : (
                            <View testID="hos-limit-counter-alert">
                                <Icon
                                    color={toneColor}
                                    name="alert"
                                    size={18}
                                />
                            </View>
                        )}
                        <Text
                            style={[styles.counterValue, { color: toneColor }]}
                            testID="hos-limit-counter-value"
                        >
                            {formatHoursMinutes(limitCounterHours)}
                        </Text>
                        <Text style={styles.counterOf}>
                            {`of ${DOLE_CAP_HOURS}h`}
                        </Text>
                    </View>
                )}
                <View style={styles.track}>
                    <View
                        style={[
                            styles.fill,
                            {
                                backgroundColor: fillColor,
                                width: `${percent}%`,
                            },
                        ]}
                        testID="hos-limit-gauge-fill"
                    />
                    <View
                        style={[
                            styles.marker,
                            {
                                left: `${(DOLE_WARNING_HOURS / DOLE_CAP_HOURS) * 100}%`,
                            },
                        ]}
                    />
                </View>
                <Text style={styles.rule}>
                    {tone === 'hazard'
                        ? `Limit reached. Stop operating and driving; hand over or end your shift.`
                        : tone === 'warning'
                          ? `Past ${DOLE_WARNING_HOURS}h. Plan your handover before ${DOLE_CAP_HOURS}h.`
                          : `DOLE-OSHC: warning at ${DOLE_WARNING_HOURS}h, stop at ${DOLE_CAP_HOURS}h.`}
                </Text>
            </View>

            <View
                accessibilityLabel="Time per duty type this shift"
                style={styles.grid}
                testID="hos-duration-breakdown"
            >
                {durationBreakdown.map(([label, value]) => (
                    <View key={label} style={styles.cell}>
                        <Text style={styles.cellLabel}>{label}</Text>
                        <Text style={styles.cellValue}>
                            {value === null ? '—' : formatHoursMinutes(value)}
                        </Text>
                    </View>
                ))}
            </View>
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        card: {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: 16,
            borderWidth: 1,
            gap: 12,
            marginBottom: 16,
            padding: 16,
        },
        headerRow: {
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'space-between',
        },
        heading: {
            color: theme.textSecondary,
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 0.6,
        },
        since: {
            color: theme.textSecondary,
            fontSize: 13,
        },
        empty: {
            alignItems: 'center',
            backgroundColor: theme.surfaceHighlight,
            borderRadius: 12,
            flexDirection: 'row',
            gap: 12,
            padding: 14,
        },
        emptyCopy: {
            flex: 1,
            gap: 2,
        },
        emptyTitle: {
            color: theme.textPrimary,
            fontSize: 16,
            fontWeight: '700',
        },
        emptyBody: {
            color: theme.textSecondary,
            fontSize: 14,
        },
        counter: {
            backgroundColor: theme.surfaceHighlight,
            borderColor: theme.border,
            borderRadius: 12,
            borderWidth: 1,
            gap: 8,
            padding: 14,
        },
        counterLabel: {
            color: theme.textSecondary,
            fontSize: 13,
            fontWeight: '700',
        },
        valueRow: {
            alignItems: 'baseline',
            flexDirection: 'row',
            gap: 6,
        },
        counterValue: {
            fontSize: 28,
            fontVariant: ['tabular-nums'],
            fontWeight: '700',
        },
        counterOf: {
            color: theme.textSecondary,
            fontSize: 16,
            fontWeight: '500',
        },
        waiting: {
            color: theme.textSecondary,
            fontSize: 16,
            fontWeight: '500',
        },
        track: {
            backgroundColor: theme.border,
            borderRadius: 6,
            height: 10,
            overflow: 'hidden',
            position: 'relative',
            width: '100%',
        },
        fill: {
            borderRadius: 6,
            height: '100%',
        },
        marker: {
            backgroundColor: theme.warningOrange,
            height: '100%',
            position: 'absolute',
            top: 0,
            width: 2,
        },
        rule: {
            color: theme.textSecondary,
            fontSize: 13,
            lineHeight: 18,
        },
        grid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 10,
        },
        cell: {
            backgroundColor: theme.surfaceHighlight,
            borderColor: theme.border,
            borderRadius: 10,
            borderWidth: 1,
            flex: 1,
            minWidth: '45%',
            padding: 12,
        },
        cellLabel: {
            color: theme.textSecondary,
            fontSize: 12,
            fontWeight: '700',
            marginBottom: 4,
        },
        cellValue: {
            color: theme.textPrimary,
            fontSize: 18,
            fontVariant: ['tabular-nums'],
            fontWeight: '700',
        },
    });
