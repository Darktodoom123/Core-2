import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import { formatAuditTimestamp } from './hos-constants';
import { createHosSharedStyles } from './hos-shared-styles';
import type { TimelineDayHistory } from './hos-types';

export interface HosShiftLogProps {
    selectedDay: TimelineDayHistory;
}

export const HosShiftLog: React.FC<HosShiftLogProps> = ({ selectedDay }) => {
    const styles = useThemedStyles(createStyles);
    const hosSharedStyles = useThemedStyles(createHosSharedStyles);

    return (
        <View style={[hosSharedStyles.sectionCard]} testID="hos-activity-logs">
            <View style={styles.logSectionHeaderRow}>
                <View style={{ flex: 1 }}>
                    <Text
                        accessibilityRole="header"
                        style={[hosSharedStyles.sectionTitle]}
                    >
                        {selectedDay.isToday
                            ? "TODAY'S SHIFT ACTIVITY LOG"
                            : `SHIFT ACTIVITY LOG — ${selectedDay.dayLabel.toUpperCase()}`}
                    </Text>
                    <Text style={[hosSharedStyles.sectionHelper]}>
                        Timestamped change-of-duty event logs with GPS location
                        audits.
                    </Text>
                </View>
                <View style={[styles.logCountBadge]}>
                    <Text style={[styles.logCountBadgeText]}>
                        {selectedDay.events.length} EVENTS
                    </Text>
                </View>
            </View>

            <View style={styles.logEventsList}>
                {selectedDay.events.length === 0 ? (
                    <View style={[styles.emptyLogCard]}>
                        <Text style={[styles.emptyLogTitle]}>
                            No server-accepted duty events
                        </Text>
                        <Text style={[styles.emptyLogSub]}>
                            Pending or rejected mobile actions stay out of
                            confirmed history until the server accepts them.
                        </Text>
                    </View>
                ) : (
                    selectedDay.events.map((evt) => (
                        <View key={evt.id} style={[styles.logEventCard]}>
                            <View style={styles.logEventHeader}>
                                <View style={styles.logBadgeRow}>
                                    <View
                                        style={[
                                            styles.logStatusBadge,
                                            evt.status === 'operating'
                                                ? styles.logStatusOperating
                                                : evt.status === 'driving'
                                                  ? styles.logStatusDriving
                                                  : evt.status === 'on_break'
                                                    ? styles.logStatusBreak
                                                    : styles.logStatusOff,
                                        ]}
                                    >
                                        <Text style={[styles.logStatusText]}>
                                            {evt.status.toUpperCase()}
                                        </Text>
                                    </View>
                                    <Text style={[styles.logTimeRange]}>
                                        {evt.startTime} – {evt.endTime}
                                    </Text>
                                </View>
                                <Text style={[styles.logDuration]}>
                                    {evt.durationFormatted}
                                </Text>
                            </View>

                            <Text style={[styles.logDetails]}>
                                {evt.details}
                            </Text>
                            {evt.occurrenceTime || evt.acceptedTime ? (
                                <Text style={[styles.logLocation]}>
                                    Occurred:{' '}
                                    {formatAuditTimestamp(evt.occurrenceTime) ??
                                        'Unavailable'}{' '}
                                    · Server accepted:{' '}
                                    {formatAuditTimestamp(evt.acceptedTime) ??
                                        'Recorded'}
                                </Text>
                            ) : null}
                            <Text style={[styles.logLocation]}>
                                {evt.location}
                            </Text>
                        </View>
                    ))
                )}
            </View>
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        emptyLogCard: {
            alignItems: 'center',
            backgroundColor: theme.surfaceHighlight,
            borderColor: theme.border,
            borderRadius: 10,
            borderWidth: 1,
            padding: 16,
        },
        emptyLogSub: {
            color: theme.textSecondary,
            fontSize: 12,
            textAlign: 'center',
        },
        emptyLogTitle: {
            color: theme.textPrimary,
            fontSize: 13,
            fontWeight: '700',
            marginBottom: 4,
        },
        logBadgeRow: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: 8,
        },
        logCountBadge: {
            backgroundColor: theme.surfaceHighlight,
            borderColor: theme.borderStrong,
            borderRadius: 9999,
            borderWidth: 1,
            paddingHorizontal: 8,
            paddingVertical: 3,
        },
        logCountBadgeText: {
            color: theme.textPrimary,
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 0.5,
        },
        logDetails: {
            color: theme.textPrimary,
            fontSize: 12,
            lineHeight: 16,
            marginTop: 4,
        },
        logDuration: {
            color: theme.textPrimary,
            fontSize: 12,
            fontWeight: '700',
        },
        logEventCard: {
            backgroundColor: theme.surface,
            borderColor: theme.border,
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
            color: theme.textSecondary,
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
            backgroundColor: theme.surface,
            borderWidth: 1.5,
        },
        logStatusBreak: {
            borderColor: theme.successEmerald,
        },
        logStatusDriving: {
            borderColor: theme.dutyDriving,
        },
        logStatusOff: {
            borderColor: theme.borderStrong,
        },
        logStatusOperating: {
            borderColor: theme.dutyOnDuty,
        },
        logStatusText: {
            color: theme.textPrimary,
            fontSize: 12,
            fontWeight: '700',
        },
        logTimeRange: {
            color: theme.textSecondary,
            fontSize: 12,
            fontWeight: '700',
        },
    });
