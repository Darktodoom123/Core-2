import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import type { TimelineDayHistory } from './hos-types';

export interface HosDutyGraphProps {
    selectedDay: TimelineDayHistory;
}

export const HosDutyGraph: React.FC<HosDutyGraphProps> = ({ selectedDay }) => {
    const { isDarkHud } = useTheme();

    return (
        <View
            style={[
                styles.graphContainer,
                isDarkHud && styles.darkGraphContainer,
            ]}
        >
            {/* Visual Graph Legend */}
            <View style={styles.graphLegendRow}>
                <View style={styles.legendItem}>
                    <View
                        style={[
                            styles.legendDot,
                            {
                                backgroundColor: isDarkHud
                                    ? '#64748B'
                                    : '#64748B',
                            },
                        ]}
                    />
                    <Text
                        style={[
                            styles.legendText,
                            isDarkHud && styles.darkLegendText,
                        ]}
                    >
                        Off Duty
                    </Text>
                </View>
                <View style={styles.legendItem}>
                    <View
                        style={[
                            styles.legendDot,
                            {
                                backgroundColor: isDarkHud
                                    ? '#10B981'
                                    : '#059669',
                            },
                        ]}
                    />
                    <Text
                        style={[
                            styles.legendText,
                            isDarkHud && styles.darkLegendText,
                        ]}
                    >
                        Break
                    </Text>
                </View>
                <View style={styles.legendItem}>
                    <View
                        style={[
                            styles.legendDot,
                            {
                                backgroundColor: isDarkHud
                                    ? '#3B82F6'
                                    : '#2563EB',
                            },
                        ]}
                    />
                    <Text
                        style={[
                            styles.legendText,
                            isDarkHud && styles.darkLegendText,
                        ]}
                    >
                        Driving
                    </Text>
                </View>
                <View style={styles.legendItem}>
                    <View
                        style={[
                            styles.legendDot,
                            {
                                backgroundColor: isDarkHud
                                    ? '#FFBF00'
                                    : '#FFBF00',
                            },
                        ]}
                    />
                    <Text
                        style={[
                            styles.legendText,
                            isDarkHud && styles.darkLegendText,
                        ]}
                    >
                        On Duty
                    </Text>
                </View>
            </View>

            {/* Row: OFF Duty */}
            <View style={styles.graphRow}>
                <View style={styles.graphRowLabelGroup}>
                    <View
                        style={[
                            styles.graphRowDot,
                            {
                                backgroundColor: isDarkHud
                                    ? '#64748B'
                                    : '#64748B',
                            },
                        ]}
                    />
                    <Text
                        style={[
                            styles.graphRowHeader,
                            isDarkHud && styles.darkGraphRowHeader,
                        ]}
                    >
                        OFF
                    </Text>
                </View>
                <View
                    style={[
                        styles.graphRowTrack,
                        isDarkHud && styles.darkGraphRowTrack,
                    ]}
                >
                    {selectedDay.segments.off.map((seg, sIdx) => (
                        <View
                            key={`off-${sIdx}`}
                            style={[
                                styles.graphSegment,
                                {
                                    left: seg.left,
                                    width: seg.width,
                                    backgroundColor: isDarkHud
                                        ? '#475569'
                                        : '#64748B',
                                },
                            ]}
                        />
                    ))}
                </View>
            </View>

            {/* Row: On Break */}
            <View style={styles.graphRow}>
                <View style={styles.graphRowLabelGroup}>
                    <View
                        style={[
                            styles.graphRowDot,
                            {
                                backgroundColor: isDarkHud
                                    ? '#10B981'
                                    : '#059669',
                            },
                        ]}
                    />
                    <Text
                        style={[
                            styles.graphRowHeader,
                            isDarkHud && styles.darkGraphRowHeader,
                        ]}
                    >
                        BRK
                    </Text>
                </View>
                <View
                    style={[
                        styles.graphRowTrack,
                        isDarkHud && styles.darkGraphRowTrack,
                    ]}
                >
                    {selectedDay.segments.brk.map((seg, sIdx) => (
                        <View
                            key={`brk-${sIdx}`}
                            style={[
                                styles.graphSegment,
                                {
                                    left: seg.left,
                                    width: seg.width,
                                    backgroundColor: isDarkHud
                                        ? '#10B981'
                                        : '#059669',
                                },
                            ]}
                        />
                    ))}
                </View>
            </View>

            {/* Row: Driving */}
            <View style={styles.graphRow}>
                <View style={styles.graphRowLabelGroup}>
                    <View
                        style={[
                            styles.graphRowDot,
                            {
                                backgroundColor: isDarkHud
                                    ? '#3B82F6'
                                    : '#2563EB',
                            },
                        ]}
                    />
                    <Text
                        style={[
                            styles.graphRowHeader,
                            isDarkHud && styles.darkGraphRowHeader,
                        ]}
                    >
                        DRV
                    </Text>
                </View>
                <View
                    style={[
                        styles.graphRowTrack,
                        isDarkHud && styles.darkGraphRowTrack,
                    ]}
                >
                    {selectedDay.segments.drv.map((seg, sIdx) => (
                        <View
                            key={`drv-${sIdx}`}
                            style={[
                                styles.graphSegment,
                                {
                                    left: seg.left,
                                    width: seg.width,
                                    backgroundColor: isDarkHud
                                        ? '#3B82F6'
                                        : '#2563EB',
                                },
                            ]}
                        />
                    ))}
                </View>
            </View>

            {/* Row: Operating / On Duty */}
            <View style={styles.graphRow}>
                <View style={styles.graphRowLabelGroup}>
                    <View
                        style={[
                            styles.graphRowDot,
                            {
                                backgroundColor: isDarkHud
                                    ? '#FFBF00'
                                    : '#FFBF00',
                            },
                        ]}
                    />
                    <Text
                        style={[
                            styles.graphRowHeader,
                            isDarkHud && styles.darkGraphRowHeader,
                        ]}
                    >
                        ON
                    </Text>
                </View>
                <View
                    style={[
                        styles.graphRowTrack,
                        isDarkHud && styles.darkGraphRowTrack,
                    ]}
                >
                    {selectedDay.segments.on.map((seg, sIdx) => (
                        <View
                            key={`on-${sIdx}`}
                            style={[
                                styles.graphSegment,
                                {
                                    left: seg.left,
                                    width: seg.width,
                                    backgroundColor: isDarkHud
                                        ? '#FFBF00'
                                        : '#FFBF00',
                                },
                            ]}
                        />
                    ))}
                </View>
            </View>

            {/* Timeline Hour Scale */}
            <View
                style={[
                    styles.graphTimeScale,
                    isDarkHud && styles.darkGraphTimeScale,
                ]}
            >
                <Text
                    style={[styles.timeMark, isDarkHud && styles.darkTimeMark]}
                >
                    00:00
                </Text>
                <Text
                    style={[styles.timeMark, isDarkHud && styles.darkTimeMark]}
                >
                    06:00
                </Text>
                <Text
                    style={[styles.timeMark, isDarkHud && styles.darkTimeMark]}
                >
                    12:00
                </Text>
                <Text
                    style={[styles.timeMark, isDarkHud && styles.darkTimeMark]}
                >
                    18:00
                </Text>
                <Text
                    style={[styles.timeMark, isDarkHud && styles.darkTimeMark]}
                >
                    24:00
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    darkGraphContainer: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
    },
    darkGraphRowHeader: {
        color: '#94A3B8',
    },
    darkGraphRowTrack: {
        backgroundColor: '#1E293B',
    },
    darkGraphTimeScale: {
        borderTopColor: '#334155',
    },
    darkLegendText: {
        color: '#94A3B8',
    },
    darkTimeMark: {
        color: '#64748B',
    },
    graphContainer: {
        backgroundColor: '#F8FAFC',
        borderColor: '#E2E8F0',
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
        borderRadius: 2.5,
        height: 5,
        width: 5,
    },
    graphRowHeader: {
        color: '#475569',
        fontSize: 12,
        fontWeight: '900',
    },
    graphRowLabelGroup: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 4,
        width: 38,
    },
    graphRowTrack: {
        backgroundColor: '#E2E8F0',
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
        borderTopColor: '#E2E8F0',
        borderTopWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
        paddingLeft: 46,
        paddingTop: 4,
    },
    legendDot: {
        borderRadius: 3,
        height: 6,
        width: 6,
    },
    legendItem: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 4,
    },
    legendText: {
        color: '#64748B',
        fontSize: 12,
        fontWeight: '700',
    },
    timeMark: {
        color: '#64748B',
        fontSize: 12,
        fontWeight: '700',
    },
});
