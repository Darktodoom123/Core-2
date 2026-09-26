import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import type { TimelineDayHistory } from './hos-types';

export interface HosDutyGraphProps {
    selectedDay: TimelineDayHistory;
}

type SegmentKey = keyof TimelineDayHistory['segments'];

interface GraphRow {
    key: SegmentKey;
    legendId: string;
    legend: string;
    label: string;
    color: keyof ThemeColors;
}

// ELD graph rows, top to bottom. Colors are the duty category tokens
// (see "Duty status colors" in Docs/design/mobile.md).
const ROWS: GraphRow[] = [
    {
        key: 'off',
        legendId: 'off',
        legend: 'Off Duty',
        label: 'OFF',
        color: 'textSecondary',
    },
    {
        key: 'brk',
        legendId: 'break',
        legend: 'Break',
        label: 'BRK',
        color: 'successEmerald',
    },
    {
        key: 'drv',
        legendId: 'driving',
        legend: 'Driving',
        label: 'DRV',
        color: 'dutyDriving',
    },
    {
        key: 'on',
        legendId: 'on',
        legend: 'On Duty',
        label: 'ON',
        color: 'dutyOnDuty',
    },
];

const HOUR_MARKS = ['00:00', '06:00', '12:00', '18:00', '24:00'];

export const HosDutyGraph: React.FC<HosDutyGraphProps> = ({ selectedDay }) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);

    return (
        <View style={styles.graphContainer}>
            <View style={styles.graphLegendRow}>
                {ROWS.map((row) => (
                    <View key={row.key} style={styles.legendItem}>
                        <View
                            style={[
                                styles.legendDot,
                                { backgroundColor: theme[row.color] },
                            ]}
                            testID={`hos-graph-legend-${row.legendId}`}
                        />
                        <Text style={styles.legendText}>{row.legend}</Text>
                    </View>
                ))}
            </View>

            {ROWS.map((row) => (
                <View key={row.key} style={styles.graphRow}>
                    <View style={styles.graphRowLabelGroup}>
                        <View
                            style={[
                                styles.graphRowDot,
                                { backgroundColor: theme[row.color] },
                            ]}
                        />
                        <Text style={styles.graphRowHeader}>{row.label}</Text>
                    </View>
                    <View style={styles.graphRowTrack}>
                        {selectedDay.segments[row.key].map((seg, sIdx) => (
                            <View
                                key={`${row.key}-${sIdx}`}
                                style={[
                                    styles.graphSegment,
                                    {
                                        backgroundColor: theme[row.color],
                                        left: seg.left,
                                        width: seg.width,
                                    },
                                ]}
                            />
                        ))}
                    </View>
                </View>
            ))}

            <View style={styles.graphTimeScale}>
                {HOUR_MARKS.map((mark) => (
                    <Text key={mark} style={styles.timeMark}>
                        {mark}
                    </Text>
                ))}
            </View>
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        graphContainer: {
            backgroundColor: theme.surfaceHighlight,
            borderColor: theme.border,
            borderRadius: 12,
            borderWidth: 1,
            padding: 12,
        },
        graphLegendRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 12,
            justifyContent: 'center',
            marginBottom: 10,
        },
        graphRow: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: 8,
            marginVertical: 4,
        },
        graphRowDot: {
            borderRadius: 3,
            height: 6,
            width: 6,
        },
        graphRowHeader: {
            color: theme.textPrimary,
            fontSize: 12,
            fontWeight: '700',
        },
        graphRowLabelGroup: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: 4,
            width: 38,
        },
        graphRowTrack: {
            backgroundColor: theme.border,
            borderRadius: 6,
            flex: 1,
            height: 16,
            overflow: 'hidden',
            position: 'relative',
        },
        graphSegment: {
            borderRadius: 4,
            height: '100%',
            position: 'absolute',
        },
        graphTimeScale: {
            borderTopColor: theme.border,
            borderTopWidth: 1,
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: 8,
            paddingLeft: 46,
            paddingTop: 4,
        },
        legendDot: {
            borderRadius: 4,
            height: 8,
            width: 8,
        },
        legendItem: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: 4,
        },
        legendText: {
            color: theme.textSecondary,
            fontSize: 12,
            fontWeight: '700',
        },
        timeMark: {
            color: theme.textSecondary,
            fontSize: 12,
            fontWeight: '700',
        },
    });
