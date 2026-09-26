import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import type { TimelineDayHistory } from './hos-types';

export interface HosDaySummaryProps {
    selectedDay: TimelineDayHistory;
}

export const HosDaySummary: React.FC<HosDaySummaryProps> = ({
    selectedDay,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);

    return (
        <View style={styles.historyMetricsGrid}>
            <View style={[styles.historyMetricCell]}>
                <View style={styles.metricCellHeader}>
                    <View
                        style={[
                            styles.metricIndicatorDot,
                            { backgroundColor: theme.dutyDriving },
                        ]}
                    />
                    <Text
                        numberOfLines={1}
                        ellipsizeMode="clip"
                        style={[styles.historyMetricLabel]}
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
            <View style={[styles.historyMetricCell]}>
                <View style={styles.metricCellHeader}>
                    <View
                        style={[
                            styles.metricIndicatorDot,
                            { backgroundColor: theme.dutyOnDuty },
                        ]}
                    />
                    <Text
                        numberOfLines={1}
                        ellipsizeMode="clip"
                        style={[styles.historyMetricLabel]}
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
            <View style={[styles.historyMetricCell]}>
                <View style={styles.metricCellHeader}>
                    <View
                        style={[
                            styles.metricIndicatorDot,
                            { backgroundColor: theme.textSecondary },
                        ]}
                    />
                    <Text
                        numberOfLines={1}
                        ellipsizeMode="clip"
                        style={[styles.historyMetricLabel]}
                    >
                        OFF DUTY
                    </Text>
                </View>
                <Text
                    numberOfLines={1}
                    style={[styles.historyMetricVal, styles.metricValSlate]}
                >
                    {selectedDay.offDutyHoursFormatted}
                </Text>
            </View>
            <View style={[styles.historyMetricCell]}>
                <View style={styles.metricCellHeader}>
                    <View
                        style={[
                            styles.metricIndicatorDot,
                            { backgroundColor: theme.textPrimary },
                        ]}
                    />
                    <Text
                        numberOfLines={1}
                        ellipsizeMode="clip"
                        style={[styles.historyMetricLabel]}
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

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        historyMetricCell: {
            alignItems: 'center',
            backgroundColor: theme.surfaceHighlight,
            borderColor: theme.border,
            borderRadius: 10,
            borderWidth: 1,
            flex: 1,
            justifyContent: 'center',
            paddingHorizontal: 4,
            paddingVertical: 10,
        },
        historyMetricLabel: {
            color: theme.textSecondary,
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 0.2,
            textAlign: 'center',
        },
        historyMetricVal: {
            fontSize: 13.5,
            fontWeight: '700',
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
            color: theme.textPrimary,
        },
        metricValBlue: {
            color: theme.textPrimary,
        },
        metricValEmerald: {
            color: theme.textPrimary,
        },
        metricValSlate: {
            color: theme.textPrimary,
        },
    });
