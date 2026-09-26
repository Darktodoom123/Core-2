import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/common/Icon';
import { useTheme } from '../../theme';
import { HosDayNavigator } from './hos-day-navigator';
import { HosDaySummary } from './hos-day-summary';
import { HosDutyGraph } from './hos-duty-graph';
import { hosSharedStyles } from './hos-shared-styles';
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
    const { isDarkHud } = useTheme();

    return (
        <View
            style={[
                hosSharedStyles.sectionCard,
                isDarkHud && hosSharedStyles.darkSectionCard,
            ]}
            testID="hos-timeline-graph"
        >
            <View style={styles.timelineHeaderRow}>
                <View style={{ flex: 1 }}>
                    <Text
                        accessibilityRole="header"
                        style={[
                            hosSharedStyles.sectionTitle,
                            isDarkHud && hosSharedStyles.darkSectionTitle,
                        ]}
                    >
                        {selectedDay.isToday
                            ? '24-HOUR DUTY TIMELINE (TODAY)'
                            : `24-HOUR DUTY TIMELINE — ${selectedDay.dayLabel.toUpperCase()}`}
                    </Text>
                    <Text
                        style={[
                            hosSharedStyles.sectionHelper,
                            isDarkHud && hosSharedStyles.darkSectionHelper,
                        ]}
                    >
                        Visual ELD graph of 24-hour shift status progression
                        (00:00 to 24:00).
                    </Text>
                </View>
                <View
                    style={[
                        styles.cycleBadge,
                        isDarkHud && styles.darkCycleBadge,
                    ]}
                >
                    <Text
                        style={[
                            styles.cycleBadgeText,
                            isDarkHud && styles.darkCycleBadgeText,
                        ]}
                    >
                        8-DAY CYCLE
                    </Text>
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
                    isDarkHud &&
                        (selectedDay.certificationStatus === 'active'
                            ? styles.darkCertAuditActive
                            : selectedDay.certificationStatus === 'certified'
                              ? styles.darkCertAuditCertified
                              : styles.darkCertAuditRestart),
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
                            isDarkHud &&
                                (selectedDay.certificationStatus === 'active'
                                    ? styles.darkCertAuditIconCircleActive
                                    : selectedDay.certificationStatus ===
                                        'certified'
                                      ? styles.darkCertAuditIconCircleCertified
                                      : styles.darkCertAuditIconCircleRestart),
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
                                    ? isDarkHud
                                        ? '#FFBF00'
                                        : '#806000'
                                    : selectedDay.certificationStatus ===
                                        'certified'
                                      ? isDarkHud
                                          ? '#34D399'
                                          : '#059669'
                                      : isDarkHud
                                        ? '#94A3B8'
                                        : '#64748B'
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
                                    isDarkHud &&
                                        (selectedDay.certificationStatus ===
                                        'active'
                                            ? styles.darkCertAuditActiveTitle
                                            : selectedDay.certificationStatus ===
                                                'certified'
                                              ? styles.darkCertAuditCertifiedTitle
                                              : styles.darkCertAuditRestartTitle),
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
                                    isDarkHud &&
                                        (selectedDay.certificationStatus ===
                                        'active'
                                            ? styles.darkCertStatusPillActive
                                            : selectedDay.certificationStatus ===
                                                'certified'
                                              ? styles.darkCertStatusPillCertified
                                              : styles.darkCertStatusPillRestart),
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
                                        isDarkHud &&
                                            (selectedDay.certificationStatus ===
                                            'active'
                                                ? styles.darkCertStatusPillActiveText
                                                : selectedDay.certificationStatus ===
                                                    'certified'
                                                  ? styles.darkCertStatusPillCertifiedText
                                                  : styles.darkCertStatusPillRestartText),
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
                                isDarkHud &&
                                    (selectedDay.certificationStatus ===
                                    'active'
                                        ? styles.darkCertAuditActiveSub
                                        : selectedDay.certificationStatus ===
                                            'certified'
                                          ? styles.darkCertAuditCertifiedSub
                                          : styles.darkCertAuditRestartSub),
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

const styles = StyleSheet.create({
    certAuditActive: {
        backgroundColor: '#FFF3C4',
        borderColor: '#FFF3C4',
    },
    certAuditActiveSub: {
        color: '#806000',
    },
    certAuditActiveTitle: {
        color: '#806000',
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
        backgroundColor: '#ECFDF5',
        borderColor: '#A7F3D0',
    },
    certAuditCertifiedSub: {
        color: '#047857',
    },
    certAuditCertifiedTitle: {
        color: '#065F46',
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
        backgroundColor: '#FFF3C4',
        borderColor: 'rgba(255, 191, 0, 0.3)',
    },
    certAuditIconCircleCertified: {
        backgroundColor: '#D1FAE5',
        borderColor: 'rgba(16, 185, 129, 0.3)',
    },
    certAuditIconCircleRestart: {
        backgroundColor: '#F1F5F9',
        borderColor: 'rgba(148, 163, 184, 0.3)',
    },
    certAuditRestart: {
        backgroundColor: '#F8FAFC',
        borderColor: '#E2E8F0',
    },
    certAuditRestartSub: {
        color: '#64748B',
    },
    certAuditRestartTitle: {
        color: '#334155',
    },
    certAuditSub: {
        fontSize: 12,
        fontWeight: '600',
        lineHeight: 16,
    },
    certAuditTextContainer: {
        flex: 1,
    },
    certAuditTitle: {
        flex: 1,
        fontSize: 12.5,
        fontWeight: '800',
        marginRight: 8,
    },
    certStatusPill: {
        borderRadius: 9999,
        borderWidth: 1,
        paddingHorizontal: 6,
        paddingVertical: 1.5,
    },
    certStatusPillActive: {
        backgroundColor: '#FFF3C4',
        borderColor: '#FFBF00',
    },
    certStatusPillActiveText: {
        color: '#806000',
    },
    certStatusPillCertified: {
        backgroundColor: '#D1FAE5',
        borderColor: '#10B981',
    },
    certStatusPillCertifiedText: {
        color: '#047857',
    },
    certStatusPillRestart: {
        backgroundColor: '#F1F5F9',
        borderColor: '#94A3B8',
    },
    certStatusPillRestartText: {
        color: '#475569',
    },
    certStatusPillText: {
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    cycleBadge: {
        backgroundColor: '#F1F5F9',
        borderColor: '#CBD5E1',
        borderRadius: 9999,
        borderWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    cycleBadgeText: {
        color: '#475569',
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    darkCertAuditActive: {
        backgroundColor: 'rgba(255, 191, 0, 0.08)',
        borderColor: 'rgba(255, 191, 0, 0.28)',
    },
    darkCertAuditActiveSub: {
        color: '#FFBF00',
    },
    darkCertAuditActiveTitle: {
        color: '#FFBF00',
    },
    darkCertAuditCertified: {
        backgroundColor: 'rgba(16, 185, 129, 0.08)',
        borderColor: 'rgba(16, 185, 129, 0.25)',
    },
    darkCertAuditCertifiedSub: {
        color: '#A7F3D0',
    },
    darkCertAuditCertifiedTitle: {
        color: '#34D399',
    },
    darkCertAuditIconCircleActive: {
        backgroundColor: 'rgba(255, 191, 0, 0.18)',
        borderColor: 'rgba(255, 191, 0, 0.35)',
    },
    darkCertAuditIconCircleCertified: {
        backgroundColor: 'rgba(16, 185, 129, 0.18)',
        borderColor: 'rgba(16, 185, 129, 0.35)',
    },
    darkCertAuditIconCircleRestart: {
        backgroundColor: 'rgba(148, 163, 184, 0.15)',
        borderColor: 'rgba(148, 163, 184, 0.3)',
    },
    darkCertAuditRestart: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
    },
    darkCertAuditRestartSub: {
        color: '#94A3B8',
    },
    darkCertAuditRestartTitle: {
        color: '#CBD5E1',
    },
    darkCertStatusPillActive: {
        backgroundColor: 'rgba(255, 191, 0, 0.2)',
        borderColor: '#FFBF00',
    },
    darkCertStatusPillActiveText: {
        color: '#FFBF00',
    },
    darkCertStatusPillCertified: {
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        borderColor: '#10B981',
    },
    darkCertStatusPillCertifiedText: {
        color: '#34D399',
    },
    darkCertStatusPillRestart: {
        backgroundColor: 'rgba(148, 163, 184, 0.15)',
        borderColor: '#64748B',
    },
    darkCertStatusPillRestartText: {
        color: '#94A3B8',
    },
    darkCycleBadge: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
    },
    darkCycleBadgeText: {
        color: '#94A3B8',
    },
    timelineHeaderRow: {
        alignItems: 'flex-start',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
});
