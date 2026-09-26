import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { formatAuditTimestamp } from './hos-constants';
import { hosSharedStyles } from './hos-shared-styles';
import type { TimelineDayHistory } from './hos-types';

export interface HosShiftLogProps {
    selectedDay: TimelineDayHistory;
}

export const HosShiftLog: React.FC<HosShiftLogProps> = ({ selectedDay }) => {
    const { isDarkHud } = useTheme();

    return (
        <View
            style={[
                hosSharedStyles.sectionCard,
                isDarkHud && hosSharedStyles.darkSectionCard,
            ]}
            testID="hos-activity-logs"
        >
            <View style={styles.logSectionHeaderRow}>
                <View style={{ flex: 1 }}>
                    <Text
                        accessibilityRole="header"
                        style={[
                            hosSharedStyles.sectionTitle,
                            isDarkHud && hosSharedStyles.darkSectionTitle,
                        ]}
                    >
                        {selectedDay.isToday
                            ? "TODAY'S SHIFT ACTIVITY LOG"
                            : `SHIFT ACTIVITY LOG — ${selectedDay.dayLabel.toUpperCase()}`}
                    </Text>
                    <Text
                        style={[
                            hosSharedStyles.sectionHelper,
                            isDarkHud && hosSharedStyles.darkSectionHelper,
                        ]}
                    >
                        Timestamped change-of-duty event logs with GPS location
                        audits.
                    </Text>
                </View>
                <View
                    style={[
                        styles.logCountBadge,
                        isDarkHud && styles.darkLogCountBadge,
                    ]}
                >
                    <Text
                        style={[
                            styles.logCountBadgeText,
                            isDarkHud && styles.darkLogCountBadgeText,
                        ]}
                    >
                        {selectedDay.events.length} EVENTS
                    </Text>
                </View>
            </View>

            <View style={styles.logEventsList}>
                {selectedDay.events.length === 0 ? (
                    <View
                        style={[
                            styles.emptyLogCard,
                            isDarkHud && styles.darkEmptyLogCard,
                        ]}
                    >
                        <Text
                            style={[
                                styles.emptyLogTitle,
                                isDarkHud && styles.darkEmptyLogTitle,
                            ]}
                        >
                            No server-accepted duty events
                        </Text>
                        <Text
                            style={[
                                styles.emptyLogSub,
                                isDarkHud && styles.darkEmptyLogSub,
                            ]}
                        >
                            Pending or rejected mobile actions stay out of
                            confirmed history until the server accepts them.
                        </Text>
                    </View>
                ) : (
                    selectedDay.events.map((evt) => (
                        <View
                            key={evt.id}
                            style={[
                                styles.logEventCard,
                                isDarkHud && styles.darkLogEventCard,
                            ]}
                        >
                            <View style={styles.logEventHeader}>
                                <View style={styles.logBadgeRow}>
                                    <View
                                        style={[
                                            styles.logStatusBadge,
                                            evt.status === 'operating'
                                                ? isDarkHud
                                                    ? styles.darkLogStatusOperating
                                                    : styles.logStatusOperating
                                                : evt.status === 'driving'
                                                  ? isDarkHud
                                                      ? styles.darkLogStatusDriving
                                                      : styles.logStatusDriving
                                                  : evt.status === 'on_break'
                                                    ? isDarkHud
                                                        ? styles.darkLogStatusBreak
                                                        : styles.logStatusBreak
                                                    : isDarkHud
                                                      ? styles.darkLogStatusOff
                                                      : styles.logStatusOff,
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.logStatusText,
                                                isDarkHud &&
                                                    styles.darkLogStatusText,
                                            ]}
                                        >
                                            {evt.status.toUpperCase()}
                                        </Text>
                                    </View>
                                    <Text
                                        style={[
                                            styles.logTimeRange,
                                            isDarkHud &&
                                                styles.darkLogTimeRange,
                                        ]}
                                    >
                                        {evt.startTime} – {evt.endTime}
                                    </Text>
                                </View>
                                <Text
                                    style={[
                                        styles.logDuration,
                                        isDarkHud && styles.darkLogDuration,
                                    ]}
                                >
                                    {evt.durationFormatted}
                                </Text>
                            </View>

                            <Text
                                style={[
                                    styles.logDetails,
                                    isDarkHud && styles.darkLogDetails,
                                ]}
                            >
                                {evt.details}
                            </Text>
                            {evt.occurrenceTime || evt.acceptedTime ? (
                                <Text
                                    style={[
                                        styles.logLocation,
                                        isDarkHud && styles.darkLogLocation,
                                    ]}
                                >
                                    Occurred:{' '}
                                    {formatAuditTimestamp(evt.occurrenceTime) ??
                                        'Unavailable'}{' '}
                                    · Server accepted:{' '}
                                    {formatAuditTimestamp(evt.acceptedTime) ??
                                        'Recorded'}
                                </Text>
                            ) : null}
                            <Text
                                style={[
                                    styles.logLocation,
                                    isDarkHud && styles.darkLogLocation,
                                ]}
                            >
                                {evt.location}
                            </Text>
                        </View>
                    ))
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    darkEmptyLogCard: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
    },
    darkEmptyLogSub: {
        color: '#94A3B8',
    },
    darkEmptyLogTitle: {
        color: '#34D399',
    },
    darkLogCountBadge: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
    },
    darkLogCountBadgeText: {
        color: '#94A3B8',
    },
    darkLogDetails: {
        color: '#CBD5E1',
    },
    darkLogDuration: {
        color: '#F8FAFC',
    },
    darkLogEventCard: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
    },
    darkLogLocation: {
        color: '#94A3B8',
    },
    darkLogStatusBreak: {
        backgroundColor: '#06281E',
    },
    darkLogStatusDriving: {
        backgroundColor: '#172554',
    },
    darkLogStatusOff: {
        backgroundColor: '#334155',
    },
    darkLogStatusOperating: {
        backgroundColor: '#332800',
    },
    darkLogStatusText: {
        color: '#FFFFFF',
    },
    darkLogTimeRange: {
        color: '#94A3B8',
    },
    emptyLogCard: {
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderColor: '#E2E8F0',
        borderRadius: 10,
        borderWidth: 1,
        padding: 16,
    },
    emptyLogSub: {
        color: '#64748B',
        fontSize: 12,
        textAlign: 'center',
    },
    emptyLogTitle: {
        color: '#059669',
        fontSize: 13,
        fontWeight: '800',
        marginBottom: 4,
    },
    logBadgeRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    logCountBadge: {
        backgroundColor: '#F1F5F9',
        borderColor: '#CBD5E1',
        borderRadius: 9999,
        borderWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    logCountBadgeText: {
        color: '#475569',
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    logDetails: {
        color: '#334155',
        fontSize: 12,
        lineHeight: 16,
        marginTop: 4,
    },
    logDuration: {
        color: '#0F172A',
        fontSize: 12,
        fontWeight: '800',
    },
    logEventCard: {
        backgroundColor: '#F8FAFC',
        borderColor: '#E2E8F0',
        borderRadius: 10,
        borderWidth: 1,
        marginBottom: 8,
        padding: 12,
    },
    logEventHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    logEventsList: {
        gap: 8,
    },
    logLocation: {
        color: '#64748B',
        fontSize: 12,
        marginTop: 4,
    },
    logSectionHeaderRow: {
        alignItems: 'flex-start',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    logStatusBadge: {
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    logStatusBreak: {
        backgroundColor: '#ECFDF5',
    },
    logStatusDriving: {
        backgroundColor: '#EFF6FF',
    },
    logStatusOff: {
        backgroundColor: '#F1F5F9',
    },
    logStatusOperating: {
        backgroundColor: '#FFF3C4',
    },
    logStatusText: {
        color: '#0F172A',
        fontSize: 12,
        fontWeight: '900',
    },
    logTimeRange: {
        color: '#64748B',
        fontSize: 12,
        fontWeight: '700',
    },
});
