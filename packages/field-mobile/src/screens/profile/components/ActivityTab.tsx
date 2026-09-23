import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Icon } from '../../../components/common/Icon';
import type { IconName } from '../../../components/common/Icon';
import type { FieldApiClient } from '../../../services/apiClient';
import { useTheme } from '../../../theme';
import type {
    ActiveSessionItem,
    SecurityActivityItem,
    SecurityActivityResponse,
} from '../../../types/account';

const getSessionIcon = (platform?: string, deviceType?: string): IconName => {
    const p = (platform || '').toLowerCase();
    const d = (deviceType || '').toLowerCase();

    if (d === 'tablet') {
        return 'tablet';
    }

    if (
        d === 'desktop' ||
        p.includes('windows') ||
        p.includes('mac') ||
        p.includes('linux')
    ) {
        return 'laptop';
    }

    if (p.includes('android')) {
        return 'logo-android';
    }

    if (
        p.includes('ios') ||
        p.includes('apple') ||
        p.includes('iphone') ||
        p.includes('ipad')
    ) {
        return 'logo-apple';
    }

    return 'laptop';
};

export interface ActivityTabProps {
    sessions: ActiveSessionItem[];
    recentActivity: SecurityActivityResponse;
    apiClient: FieldApiClient;
    onRevokeOthersClick: () => void;
    onSessionsUpdated: () => void;
}

export const ActivityTab: React.FC<ActivityTabProps> = ({
    sessions,
    recentActivity,
    apiClient,
    onRevokeOthersClick,
    onSessionsUpdated,
}) => {
    const { isDarkHud } = useTheme();
    const [revokingSessionId, setRevokingSessionId] = useState<string | null>(
        null,
    );
    const [prevRecentActivity, setPrevRecentActivity] =
        useState(recentActivity);
    const [activityList, setActivityList] = useState<SecurityActivityItem[]>(
        recentActivity.data || [],
    );
    const [currentPage, setCurrentPage] = useState(
        recentActivity.current_page || 1,
    );
    const [lastPage, setLastPage] = useState(recentActivity.last_page || 1);
    const [isLoadingMoreActivity, setIsLoadingMoreActivity] = useState(false);
    const [feedback, setFeedback] = useState<string | null>(null);

    if (recentActivity !== prevRecentActivity) {
        setPrevRecentActivity(recentActivity);
        setActivityList(recentActivity.data || []);
        setCurrentPage(recentActivity.current_page || 1);
        setLastPage(recentActivity.last_page || 1);
    }

    const executeRevokeSingleSession = async (sessionId: string) => {
        setRevokingSessionId(sessionId);
        setFeedback(null);

        try {
            await apiClient.revokeSession(sessionId);
            setFeedback('Session revoked successfully.');
            setTimeout(() => setFeedback(null), 3000);
            onSessionsUpdated();
        } catch (err: any) {
            setFeedback(err.message || 'Failed to revoke session.');
        } finally {
            setRevokingSessionId(null);
        }
    };

    const handleRevokeSingleSession = (
        sessionId: string,
        sessionLabel?: string,
    ) => {
        Alert.alert(
            'Sign Out Session',
            `Are you sure you want to sign out ${sessionLabel || 'this session'}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: () => void executeRevokeSingleSession(sessionId),
                },
            ],
        );
    };

    const handleLoadMoreActivity = async () => {
        if (currentPage >= lastPage || isLoadingMoreActivity) {
            return;
        }

        setIsLoadingMoreActivity(true);

        try {
            const nextPage = currentPage + 1;
            const res = await apiClient.getAccountActivity({ page: nextPage });
            const items = Array.isArray(res) ? res : res?.data || [];
            setActivityList((prev) => [...prev, ...items]);

            if (!Array.isArray(res) && res?.current_page !== undefined) {
                setCurrentPage(res.current_page);
                setLastPage(res.last_page || lastPage);
            } else {
                setCurrentPage(nextPage);
            }
        } catch (err: any) {
            setFeedback(err.message || 'Failed to load more activity.');
        } finally {
            setIsLoadingMoreActivity(false);
        }
    };

    const currentSession = sessions.find((s) => s.is_current) || sessions[0];
    const otherSessions = currentSession
        ? sessions.filter((s) => s.id !== currentSession.id)
        : [];

    return (
        <View style={styles.container} testID="activity-tab">
            {feedback ? (
                <View
                    style={[
                        styles.feedbackBanner,
                        feedback.includes('successfully')
                            ? styles.feedbackSuccess
                            : styles.feedbackError,
                    ]}
                >
                    <Text
                        style={[
                            styles.feedbackText,
                            feedback.includes('successfully')
                                ? styles.feedbackSuccessText
                                : styles.feedbackErrorText,
                        ]}
                    >
                        {feedback}
                    </Text>
                </View>
            ) : null}

            {/* Active Sessions Card */}
            <View style={[styles.card, isDarkHud && styles.darkCard]}>
                <View style={styles.sessionsHeaderRow}>
                    <View>
                        <Text
                            style={[
                                styles.cardTitle,
                                isDarkHud && styles.darkCardTitle,
                            ]}
                        >
                            Active Sessions ({sessions.length})
                        </Text>
                        <Text
                            style={[
                                styles.cardSubtitle,
                                isDarkHud && styles.darkCardSubtitle,
                            ]}
                        >
                            Devices currently authenticated to your account
                        </Text>
                    </View>

                    {otherSessions.length > 0 ? (
                        <Pressable
                            accessibilityLabel="Revoke other sessions"
                            accessibilityRole="button"
                            onPress={onRevokeOthersClick}
                            style={({ pressed }) => [
                                styles.revokeOthersBtn,
                                pressed && styles.pressed,
                            ]}
                            testID="btn-revoke-others"
                        >
                            <Text style={styles.revokeOthersBtnText}>
                                Sign Out Others
                            </Text>
                        </Pressable>
                    ) : null}
                </View>

                {/* Current Active Session Spotlight */}
                {currentSession ? (
                    <View
                        style={[
                            styles.currentSessionCard,
                            isDarkHud && styles.darkCurrentSessionCard,
                        ]}
                    >
                        <View style={styles.sessionTopRow}>
                            <View style={styles.currentSessionLeft}>
                                <View
                                    style={[
                                        styles.deviceIconSquircle,
                                        isDarkHud
                                            ? styles.darkCurrentDeviceIconSquircle
                                            : styles.lightCurrentDeviceIconSquircle,
                                    ]}
                                >
                                    <Icon
                                        color={
                                            isDarkHud ? '#34D399' : '#059669'
                                        }
                                        name={getSessionIcon(
                                            currentSession.platform,
                                            currentSession.device_type,
                                        )}
                                        size={20}
                                    />
                                </View>
                                <View style={styles.sessionMeta}>
                                    <View style={styles.labelCurrentRow}>
                                        <Text
                                            style={[
                                                styles.sessionLabel,
                                                isDarkHud &&
                                                    styles.darkSessionLabel,
                                            ]}
                                        >
                                            {currentSession.device_label ||
                                                'Current Device'}
                                        </Text>
                                        <View style={styles.currentBadge}>
                                            <View style={styles.beaconRing}>
                                                <View
                                                    style={styles.onlineDot}
                                                />
                                            </View>
                                            <Text
                                                style={styles.currentBadgeText}
                                            >
                                                This Device
                                            </Text>
                                        </View>
                                    </View>
                                    <Text
                                        style={[
                                            styles.sessionDetails,
                                            isDarkHud &&
                                                styles.darkSessionDetails,
                                        ]}
                                    >
                                        {currentSession.browser} ·{' '}
                                        {currentSession.platform} ·{' '}
                                        {currentSession.ip_address}
                                    </Text>
                                    <Text
                                        style={[
                                            styles.sessionLocation,
                                            isDarkHud &&
                                                styles.darkSessionLocation,
                                        ]}
                                    >
                                        {currentSession.location} · Active now
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>
                ) : null}

                {/* Other Active Sessions */}
                {otherSessions.length > 0 ? (
                    <View style={styles.otherSessionsList}>
                        <Text
                            style={[
                                styles.otherSessionsHeader,
                                isDarkHud && styles.darkOtherSessionsHeader,
                            ]}
                        >
                            Other Authenticated Sessions ({otherSessions.length}
                            )
                        </Text>
                        <View
                            style={[
                                styles.groupedInsetContainer,
                                isDarkHud && styles.darkGroupedInsetContainer,
                            ]}
                        >
                            {otherSessions.map((session, index) => {
                                const isRevoking =
                                    revokingSessionId === session.id;
                                const isLast =
                                    index === otherSessions.length - 1;

                                return (
                                    <View key={session.id}>
                                        <View
                                            style={[
                                                styles.sessionItem,
                                                isDarkHud &&
                                                    styles.darkSessionItem,
                                            ]}
                                            testID={`session-item-${session.id}`}
                                        >
                                            <View
                                                style={[
                                                    styles.deviceIconSquircle,
                                                    isDarkHud
                                                        ? styles.darkDeviceIconSquircle
                                                        : styles.lightDeviceIconSquircle,
                                                ]}
                                            >
                                                <Icon
                                                    color={
                                                        isDarkHud
                                                            ? '#94A3B8'
                                                            : '#2563EB'
                                                    }
                                                    name={getSessionIcon(
                                                        session.platform,
                                                        session.device_type,
                                                    )}
                                                    size={18}
                                                />
                                            </View>
                                            <View style={styles.sessionMeta}>
                                                <Text
                                                    style={[
                                                        styles.sessionLabel,
                                                        isDarkHud &&
                                                            styles.darkSessionLabel,
                                                    ]}
                                                >
                                                    {session.device_label ||
                                                        'Web / Device'}
                                                </Text>
                                                <Text
                                                    style={[
                                                        styles.sessionDetails,
                                                        isDarkHud &&
                                                            styles.darkSessionDetails,
                                                    ]}
                                                >
                                                    {session.browser} ·{' '}
                                                    {session.platform} ·{' '}
                                                    {session.ip_address}
                                                </Text>
                                                <Text
                                                    style={[
                                                        styles.sessionLocation,
                                                        isDarkHud &&
                                                            styles.darkSessionLocation,
                                                    ]}
                                                >
                                                    {session.location} ·{' '}
                                                    {session.last_active_human}
                                                </Text>
                                            </View>

                                            <Pressable
                                                accessibilityLabel={`Sign out session ${session.device_label}`}
                                                accessibilityRole="button"
                                                disabled={isRevoking}
                                                onPress={() =>
                                                    handleRevokeSingleSession(
                                                        session.id,
                                                        session.device_label,
                                                    )
                                                }
                                                style={({ pressed }) => [
                                                    styles.revokeSingleBtn,
                                                    isDarkHud &&
                                                        styles.darkRevokeSingleBtn,
                                                    pressed && styles.pressed,
                                                ]}
                                                testID={`revoke-session-${session.id}`}
                                            >
                                                {isRevoking ? (
                                                    <ActivityIndicator
                                                        color="#EF4444"
                                                        size="small"
                                                    />
                                                ) : (
                                                    <Text
                                                        style={
                                                            styles.revokeSingleBtnText
                                                        }
                                                    >
                                                        Sign Out
                                                    </Text>
                                                )}
                                            </Pressable>
                                        </View>
                                        {!isLast ? (
                                            <View
                                                style={[
                                                    styles.hairlineDivider,
                                                    isDarkHud &&
                                                        styles.darkHairlineDivider,
                                                ]}
                                            />
                                        ) : null}
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                ) : null}
            </View>

            {/* Security Activity Audit Log */}
            <View style={[styles.card, isDarkHud && styles.darkCard]}>
                <Text
                    style={[
                        styles.cardTitle,
                        isDarkHud && styles.darkCardTitle,
                    ]}
                >
                    Security Activity Log
                </Text>
                <Text
                    style={[
                        styles.cardSubtitle,
                        isDarkHud && styles.darkCardSubtitle,
                    ]}
                >
                    Immutable audit events recorded for authentication and
                    safety
                </Text>

                <View style={styles.activityTimeline}>
                    {activityList.length === 0 ? (
                        <Text
                            style={[
                                styles.emptyText,
                                isDarkHud && styles.darkEmptyText,
                            ]}
                        >
                            No security activity events recorded yet.
                        </Text>
                    ) : (
                        activityList.map((item, index) => {
                            const isSuccess = item.outcome === 'success';
                            const isLast = index === activityList.length - 1;

                            return (
                                <View
                                    key={item.id}
                                    style={styles.timelineRow}
                                    testID={`activity-item-${item.id}`}
                                >
                                    {/* Timeline track and node */}
                                    <View style={styles.timelineTrackContainer}>
                                        <View
                                            style={[
                                                styles.timelineNode,
                                                isSuccess
                                                    ? isDarkHud
                                                        ? styles.timelineNodeSuccessDark
                                                        : styles.timelineNodeSuccessLight
                                                    : isDarkHud
                                                      ? styles.timelineNodeFailedDark
                                                      : styles.timelineNodeFailedLight,
                                            ]}
                                        >
                                            <View
                                                style={[
                                                    styles.timelineDot,
                                                    isSuccess
                                                        ? styles.timelineDotSuccess
                                                        : styles.timelineDotFailed,
                                                ]}
                                            />
                                        </View>
                                        {!isLast ? (
                                            <View
                                                style={[
                                                    styles.timelineLine,
                                                    isDarkHud &&
                                                        styles.darkTimelineLine,
                                                ]}
                                            />
                                        ) : null}
                                    </View>

                                    {/* Activity item card */}
                                    <View
                                        style={[
                                            styles.activityCard,
                                            isDarkHud &&
                                                styles.darkActivityCard,
                                        ]}
                                    >
                                        <View style={styles.activityTopRow}>
                                            <View style={styles.actionBlock}>
                                                <Text
                                                    style={[
                                                        styles.activityLabel,
                                                        isDarkHud &&
                                                            styles.darkActivityLabel,
                                                    ]}
                                                >
                                                    {item.event_label ||
                                                        item.action}
                                                </Text>
                                                <Text
                                                    style={[
                                                        styles.activityMeta,
                                                        isDarkHud &&
                                                            styles.darkActivityMeta,
                                                    ]}
                                                >
                                                    {item.device_label} ·{' '}
                                                    {item.ip_address}
                                                </Text>
                                            </View>

                                            <View
                                                style={[
                                                    styles.outcomeBadge,
                                                    item.outcome === 'success'
                                                        ? styles.outcomeSuccess
                                                        : styles.outcomeFailed,
                                                ]}
                                            >
                                                <Text
                                                    style={[
                                                        styles.outcomeBadgeText,
                                                        item.outcome ===
                                                        'success'
                                                            ? styles.outcomeSuccessText
                                                            : styles.outcomeFailedText,
                                                    ]}
                                                >
                                                    {item.outcome}
                                                </Text>
                                            </View>
                                        </View>

                                        <View style={styles.activityBottomRow}>
                                            <Text
                                                style={[
                                                    styles.activityTime,
                                                    isDarkHud &&
                                                        styles.darkActivityTime,
                                                ]}
                                            >
                                                {item.occurred_at_human}
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.activityLocation,
                                                    isDarkHud &&
                                                        styles.darkActivityLocation,
                                                ]}
                                            >
                                                {item.location}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            );
                        })
                    )}
                </View>

                {currentPage < lastPage ? (
                    <Pressable
                        accessibilityLabel="Load more activity"
                        accessibilityRole="button"
                        disabled={isLoadingMoreActivity}
                        onPress={handleLoadMoreActivity}
                        style={({ pressed }) => [
                            styles.loadMoreBtn,
                            isDarkHud && styles.darkLoadMoreBtn,
                            pressed && styles.pressed,
                        ]}
                        testID="load-more-activity-btn"
                    >
                        {isLoadingMoreActivity ? (
                            <ActivityIndicator
                                color={isDarkHud ? '#FFBF00' : '#806000'}
                                size="small"
                            />
                        ) : (
                            <Text
                                style={[
                                    styles.loadMoreText,
                                    isDarkHud && styles.darkLoadMoreText,
                                ]}
                            >
                                Load More Activity
                            </Text>
                        )}
                    </Pressable>
                ) : null}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        gap: 16,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        elevation: 1,
        overflow: 'hidden',
    },
    darkCard: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
    },
    darkCardTitle: {
        color: '#F8FAFC',
    },
    cardSubtitle: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2,
    },
    darkCardSubtitle: {
        color: '#94A3B8',
    },
    feedbackBanner: {
        borderRadius: 10,
        padding: 12,
    },
    feedbackSuccess: {
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#A7F3D0',
    },
    feedbackError: {
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    feedbackText: {
        fontSize: 13,
        fontWeight: '600',
    },
    feedbackSuccessText: {
        color: '#047857',
    },
    feedbackErrorText: {
        color: '#B91C1C',
    },
    sessionsHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    revokeOthersBtn: {
        minHeight: 48,
        justifyContent: 'center',
        paddingHorizontal: 8,
    },
    revokeOthersBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#DC2626',
    },
    currentSessionCard: {
        marginTop: 14,
        padding: 14,
        borderRadius: 14,
        backgroundColor: '#F0FDF4',
        borderWidth: 1.5,
        borderColor: '#86EFAC',
    },
    darkCurrentSessionCard: {
        backgroundColor: '#064E3B20',
        borderColor: '#059669',
    },
    sessionTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    currentSessionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    deviceIconSquircle: {
        width: 38,
        height: 38,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    lightCurrentDeviceIconSquircle: {
        backgroundColor: '#DCFCE7',
    },
    darkCurrentDeviceIconSquircle: {
        backgroundColor: '#064E3B',
    },
    lightDeviceIconSquircle: {
        backgroundColor: '#EFF6FF',
    },
    darkDeviceIconSquircle: {
        backgroundColor: '#1E293B',
        borderWidth: 1,
        borderColor: '#334155',
    },
    beaconRing: {
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        padding: 2.5,
        borderRadius: 999,
        justifyContent: 'center',
        alignItems: 'center',
    },
    onlineDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: '#10B981',
    },
    labelCurrentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sessionLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0F172A',
    },
    darkSessionLabel: {
        color: '#F8FAFC',
    },
    currentBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#DCFCE7',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    currentBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#15803D',
    },
    sessionDetails: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2,
    },
    darkSessionDetails: {
        color: '#94A3B8',
    },
    sessionLocation: {
        fontSize: 11,
        color: '#94A3B8',
        marginTop: 2,
    },
    darkSessionLocation: {
        color: '#64748B',
    },
    otherSessionsList: {
        marginTop: 16,
        gap: 10,
    },
    otherSessionsHeader: {
        fontSize: 12,
        fontWeight: '700',
        color: '#475569',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    darkOtherSessionsHeader: {
        color: '#94A3B8',
    },
    groupedInsetContainer: {
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        backgroundColor: '#F8FAFC',
        overflow: 'hidden',
    },
    darkGroupedInsetContainer: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
    },
    hairlineDivider: {
        height: StyleSheet.hairlineWidth,
        marginLeft: 62,
        backgroundColor: '#E2E8F0',
    },
    darkHairlineDivider: {
        backgroundColor: '#334155',
    },
    sessionItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        gap: 12,
    },
    darkSessionItem: {},
    sessionMeta: {
        flex: 1,
        gap: 2,
    },
    revokeSingleBtn: {
        minHeight: 48,
        paddingHorizontal: 12,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FEE2E2',
    },
    darkRevokeSingleBtn: {
        backgroundColor: '#7F1D1D40',
        borderWidth: 1,
        borderColor: '#DC2626',
    },
    revokeSingleBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#DC2626',
    },
    activityTimeline: {
        marginTop: 16,
        gap: 12,
    },
    timelineRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    timelineTrackContainer: {
        width: 20,
        alignItems: 'center',
        marginRight: 10,
        alignSelf: 'stretch',
    },
    timelineNode: {
        width: 18,
        height: 18,
        borderRadius: 9,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 12,
        zIndex: 1,
    },
    timelineNodeSuccessLight: {
        backgroundColor: '#DCFCE7',
    },
    timelineNodeSuccessDark: {
        backgroundColor: '#064E3B',
    },
    timelineNodeFailedLight: {
        backgroundColor: '#FEE2E2',
    },
    timelineNodeFailedDark: {
        backgroundColor: '#7F1D1D',
    },
    timelineDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    timelineDotSuccess: {
        backgroundColor: '#10B981',
    },
    timelineDotFailed: {
        backgroundColor: '#EF4444',
    },
    timelineLine: {
        position: 'absolute',
        top: 26,
        bottom: -12,
        width: 2,
        backgroundColor: '#E2E8F0',
    },
    darkTimelineLine: {
        backgroundColor: '#334155',
    },
    activityCard: {
        flex: 1,
        padding: 12,
        borderRadius: 12,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        gap: 6,
    },
    darkActivityCard: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
    },
    emptyText: {
        fontSize: 13,
        color: '#94A3B8',
        fontStyle: 'italic',
        paddingVertical: 8,
    },
    darkEmptyText: {
        color: '#64748B',
    },
    activityTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    actionBlock: {
        flex: 1,
        gap: 2,
    },
    activityLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0F172A',
    },
    darkActivityLabel: {
        color: '#F8FAFC',
    },
    activityMeta: {
        fontSize: 12,
        color: '#64748B',
    },
    darkActivityMeta: {
        color: '#94A3B8',
    },
    outcomeBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    outcomeSuccess: {
        backgroundColor: '#DCFCE7',
    },
    outcomeFailed: {
        backgroundColor: '#FEE2E2',
    },
    outcomeBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    outcomeSuccessText: {
        color: '#15803D',
    },
    outcomeFailedText: {
        color: '#DC2626',
    },
    activityBottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    activityTime: {
        fontSize: 11,
        color: '#94A3B8',
    },
    darkActivityTime: {
        color: '#64748B',
    },
    activityLocation: {
        fontSize: 11,
        color: '#64748B',
    },
    darkActivityLocation: {
        color: '#94A3B8',
    },
    loadMoreBtn: {
        minHeight: 48,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        marginTop: 12,
    },
    darkLoadMoreBtn: {
        backgroundColor: '#334155',
    },
    loadMoreText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#334155',
    },
    darkLoadMoreText: {
        color: '#F8FAFC',
    },
    pressed: {
        opacity: 0.75,
    },
});
