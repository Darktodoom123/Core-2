import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/common/Icon';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import { HosDayNavigator } from './hos-day-navigator';
import { HosDaySummary } from './hos-day-summary';
import { HosDutyGraph } from './hos-duty-graph';
import { createHosSharedStyles } from './hos-shared-styles';
import type { TimelineDayHistory } from './hos-types';

export interface HosTimelineCardProps {
    historyDays: TimelineDayHistory[];
    selectedDay: TimelineDayHistory;
    selectedDayIndex: number;
    setSelectedDayIndex: React.Dispatch<React.SetStateAction<number>>;
    handlePrevDay: () => void;
    handleNextDay: () => void;
}

export const HosTimelineCard: React.FC<HosTimelineCardProps> = ({
    historyDays,
    selectedDay,
    selectedDayIndex,
    setSelectedDayIndex,
    handlePrevDay,
    handleNextDay,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const hosSharedStyles = useThemedStyles(createHosSharedStyles);

    return (
        <View style={[hosSharedStyles.sectionCard]} testID="hos-timeline-graph">
            <View style={styles.timelineHeaderRow}>
                <View style={{ flex: 1 }}>
                    <Text
                        accessibilityRole="header"
                        style={[hosSharedStyles.sectionTitle]}
                    >
                        {selectedDay.isToday
                            ? '24-HOUR DUTY TIMELINE (TODAY)'
                            : `24-HOUR DUTY TIMELINE — ${selectedDay.dayLabel.toUpperCase()}`}
                    </Text>
                    <Text style={[hosSharedStyles.sectionHelper]}>
                        Visual ELD graph of 24-hour shift status progression
                        (00:00 to 24:00).
                    </Text>
                </View>
                <View style={[styles.cycleBadge]}>
                    <Text style={[styles.cycleBadgeText]}>8-DAY CYCLE</Text>
                </View>
            </View>

            {/* Unified 8-Day Cycle Date Navigator */}
            <HosDayNavigator
                historyDays={historyDays}
                selectedDay={selectedDay}
                selectedDayIndex={selectedDayIndex}
                setSelectedDayIndex={setSelectedDayIndex}
                handlePrevDay={handlePrevDay}
                handleNextDay={handleNextDay}
            />
            {/* 24-Hour Duty Graph */}
            <HosDutyGraph selectedDay={selectedDay} />
            {/* Daily Shift Summary Recap Row */}
            <HosDaySummary selectedDay={selectedDay} />
            {/* Certification & Compliance Audit Stamp */}
            <View
                style={[
                    styles.certAuditBadge,
                    selectedDay.certificationStatus === 'active'
                        ? styles.certAuditActive
                        : selectedDay.certificationStatus === 'certified'
                          ? styles.certAuditCertified
                          : styles.certAuditRestart,
                ]}
            >
                <View style={styles.certAuditCardInner}>
                    <View
                        style={[
                            styles.certAuditIconCircle,
                            selectedDay.certificationStatus === 'active'
                                ? styles.certAuditIconCircleActive
                                : selectedDay.certificationStatus ===
                                    'certified'
                                  ? styles.certAuditIconCircleCertified
                                  : styles.certAuditIconCircleRestart,
                        ]}
                    >
                        <Icon
                            name={
                                selectedDay.certificationStatus === 'active'
                                    ? 'clock'
                                    : selectedDay.certificationStatus ===
                                        'certified'
                                      ? 'check-circle'
                                      : 'shield-check'
                            }
                            size={16}
                            color={
                                selectedDay.certificationStatus === 'active'
                                    ? theme.actionCobalt
                                    : selectedDay.certificationStatus ===
                                        'certified'
                                      ? theme.successEmerald
                                      : theme.textSecondary
                            }
                        />
                    </View>

                    <View style={styles.certAuditTextContainer}>
                        <View style={styles.certAuditHeaderRow}>
                            <Text
                                numberOfLines={1}
                                style={[
                                    styles.certAuditTitle,
                                    selectedDay.certificationStatus === 'active'
                                        ? styles.certAuditActiveTitle
                                        : selectedDay.certificationStatus ===
                                            'certified'
                                          ? styles.certAuditCertifiedTitle
                                          : styles.certAuditRestartTitle,
                                ]}
                            >
                                {selectedDay.certificationStatus === 'active'
                                    ? 'Active Shift in Progress'
                                    : selectedDay.certificationStatus ===
                                        'certified'
                                      ? 'Shift Certified'
                                      : '34-Hour HoS Restart'}
                            </Text>
                            <View
                                style={[
                                    styles.certStatusPill,
                                    selectedDay.certificationStatus === 'active'
                                        ? styles.certStatusPillActive
                                        : selectedDay.certificationStatus ===
                                            'certified'
                                          ? styles.certStatusPillCertified
                                          : styles.certStatusPillRestart,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.certStatusPillText,
                                        selectedDay.certificationStatus ===
                                        'active'
                                            ? styles.certStatusPillActiveText
                                            : selectedDay.certificationStatus ===
                                                'certified'
                                              ? styles.certStatusPillCertifiedText
                                              : styles.certStatusPillRestartText,
                                    ]}
                                >
                                    {selectedDay.certificationStatus ===
                                    'active'
                                        ? 'LIVE'
                                        : selectedDay.certificationStatus ===
                                            'certified'
                                          ? 'LOCKED'
                                          : 'REST'}
                                </Text>
                            </View>
                        </View>

                        <Text
                            numberOfLines={1}
                            ellipsizeMode="tail"
                            style={[
                                styles.certAuditSub,
                                selectedDay.certificationStatus === 'active'
                                    ? styles.certAuditActiveSub
                                    : selectedDay.certificationStatus ===
                                        'certified'
                                      ? styles.certAuditCertifiedSub
                                      : styles.certAuditRestartSub,
                            ]}
                        >
                            {selectedDay.certifiedByText}
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        certAuditActive: {
            backgroundColor: theme.actionCobaltLight,
            borderColor: theme.actionCobalt,
        },
        certAuditActiveSub: {
            color: theme.textPrimary,
        },
        certAuditActiveTitle: {
            color: theme.textPrimary,
        },
        certAuditBadge: {
            borderRadius: 12,
            borderWidth: 1,
            marginTop: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
        },
        certAuditCardInner: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: 10,
        },
        certAuditCertified: {
            backgroundColor: theme.successEmeraldLight,
            borderColor: theme.successEmerald,
        },
        certAuditCertifiedSub: {
            color: theme.textPrimary,
        },
        certAuditCertifiedTitle: {
            color: theme.successEmeraldText,
        },
        certAuditHeaderRow: {
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 2,
        },
        certAuditIconCircle: {
            alignItems: 'center',
            borderRadius: 16,
            borderWidth: 1,
            height: 32,
            justifyContent: 'center',
            width: 32,
        },
        certAuditIconCircleActive: {
            backgroundColor: theme.surface,
            borderColor: theme.actionCobalt,
        },
        certAuditIconCircleCertified: {
            backgroundColor: theme.surface,
            borderColor: theme.successEmerald,
        },
        certAuditIconCircleRestart: {
            backgroundColor: theme.surface,
            borderColor: theme.borderStrong,
        },
        certAuditRestart: {
            backgroundColor: theme.surfaceHighlight,
            borderColor: theme.borderStrong,
        },
        certAuditRestartSub: {
            color: theme.textPrimary,
        },
        certAuditRestartTitle: {
            color: theme.textPrimary,
        },
        certAuditSub: {
            fontSize: 12,
            fontWeight: '500',
            lineHeight: 16,
        },
        certAuditTextContainer: {
            flex: 1,
        },
        certAuditTitle: {
            flex: 1,
            fontSize: 12.5,
            fontWeight: '700',
            marginRight: 8,
        },
        certStatusPill: {
            borderRadius: 9999,
            borderWidth: 1,
            paddingHorizontal: 6,
            paddingVertical: 1.5,
        },
        certStatusPillActive: {
            backgroundColor: theme.surface,
            borderColor: theme.actionCobalt,
        },
        certStatusPillActiveText: {
            color: theme.textPrimary,
        },
        certStatusPillCertified: {
            backgroundColor: theme.surface,
            borderColor: theme.successEmerald,
        },
        certStatusPillCertifiedText: {
            color: theme.successEmeraldText,
        },
        certStatusPillRestart: {
            backgroundColor: theme.surface,
            borderColor: theme.borderStrong,
        },
        certStatusPillRestartText: {
            color: theme.textPrimary,
        },
        certStatusPillText: {
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 0.5,
        },
        cycleBadge: {
            backgroundColor: theme.surfaceHighlight,
            borderColor: theme.borderStrong,
            borderRadius: 9999,
            borderWidth: 1,
            paddingHorizontal: 8,
            paddingVertical: 3,
        },
        cycleBadgeText: {
            color: theme.textPrimary,
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 0.5,
        },
        timelineHeaderRow: {
            alignItems: 'flex-start',
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 8,
        },
    });
