import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import type { TimelineDayHistory } from './hos-types';

export interface HosDaySummaryProps {
    selectedDay: TimelineDayHistory;
}

export const HosDaySummary: React.FC<HosDaySummaryProps> = ({
    selectedDay,
}) => {
    const { isDarkHud } = useTheme();

    return (
        <View style={styles.historyMetricsGrid}>
            <View
                style={[
                    styles.historyMetricCell,
                    isDarkHud && styles.darkHistoryMetricCell,
                ]}
            >
                <View style={styles.metricCellHeader}>
                    <View
                        style={[
                            styles.metricIndicatorDot,
                            { backgroundColor: '#2563EB' },
                        ]}
                    />
                    <Text
                        numberOfLines={1}
                        ellipsizeMode="clip"
                        style={[
                            styles.historyMetricLabel,
                            isDarkHud && styles.darkHistoryMetricLabel,
                        ]}
                    >
                        DRIVE
                    </Text>
                </View>
                <Text
                    numberOfLines={1}
                    style={[styles.historyMetricVal, styles.metricValBlue]}
                >
                    {selectedDay.driveHoursFormatted}
                </Text>
            </View>
            <View
                style={[
                    styles.historyMetricCell,
                    isDarkHud && styles.darkHistoryMetricCell,
                ]}
            >
                <View style={styles.metricCellHeader}>
                    <View
                        style={[
                            styles.metricIndicatorDot,
                            { backgroundColor: '#FFBF00' },
                        ]}
                    />
                    <Text
                        numberOfLines={1}
                        ellipsizeMode="clip"
                        style={[
                            styles.historyMetricLabel,
                            isDarkHud && styles.darkHistoryMetricLabel,
                        ]}
                    >
                        ON DUTY
                    </Text>
                </View>
                <Text
                    numberOfLines={1}
                    style={[styles.historyMetricVal, styles.metricValAmber]}
                >
                    {selectedDay.onDutyHoursFormatted}
                </Text>
            </View>
            <View
                style={[
                    styles.historyMetricCell,
                    isDarkHud && styles.darkHistoryMetricCell,
                ]}
            >
                <View style={styles.metricCellHeader}>
                    <View
                        style={[
                            styles.metricIndicatorDot,
                            { backgroundColor: '#64748B' },
                        ]}
                    />
                    <Text
                        numberOfLines={1}
                        ellipsizeMode="clip"
                        style={[
                            styles.historyMetricLabel,
                            isDarkHud && styles.darkHistoryMetricLabel,
                        ]}
                    >
                        OFF DUTY
                    </Text>
                </View>
                <Text
                    numberOfLines={1}
                    style={[
                        styles.historyMetricVal,
                        isDarkHud
                            ? styles.darkMetricValSlate
                            : styles.metricValSlate,
                    ]}
                >
                    {selectedDay.offDutyHoursFormatted}
                </Text>
            </View>
            <View
                style={[
                    styles.historyMetricCell,
                    isDarkHud && styles.darkHistoryMetricCell,
                ]}
            >
                <View style={styles.metricCellHeader}>
                    <View
                        style={[
                            styles.metricIndicatorDot,
                            { backgroundColor: '#059669' },
                        ]}
                    />
                    <Text
                        numberOfLines={1}
                        ellipsizeMode="clip"
                        style={[
                            styles.historyMetricLabel,
                            isDarkHud && styles.darkHistoryMetricLabel,
                        ]}
                    >
                        TOTAL
                    </Text>
                </View>
                <Text
                    numberOfLines={1}
                    style={[styles.historyMetricVal, styles.metricValEmerald]}
                >
                    {selectedDay.totalShiftFormatted}
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    darkHistoryMetricCell: {
        backgroundColor: '#0F172A',
        borderColor: '#1E293B',
    },
    darkHistoryMetricLabel: {
        color: '#94A3B8',
    },
    darkMetricValSlate: {
        color: '#94A3B8',
    },
    historyMetricCell: {
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderColor: '#E2E8F0',
        borderRadius: 10,
        borderWidth: 1,
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 4,
        paddingVertical: 10,
    },
    historyMetricLabel: {
        color: '#64748B',
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.2,
        textAlign: 'center',
    },
    historyMetricVal: {
        fontSize: 13.5,
        fontWeight: '900',
        letterSpacing: -0.2,
        textAlign: 'center',
    },
    historyMetricsGrid: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 12,
    },
    metricCellHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 3,
        marginBottom: 3,
    },
    metricIndicatorDot: {
        borderRadius: 2.5,
        height: 5,
        width: 5,
    },
    metricValAmber: {
        color: '#FFBF00',
    },
    metricValBlue: {
        color: '#2563EB',
    },
    metricValEmerald: {
        color: '#059669',
    },
    metricValSlate: {
        color: '#475569',
    },
});
