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
import { useTheme, useThemedStyles } from '../../../theme';
import type { ThemeColors } from '../../../theme';
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
    const { isDarkHud, theme } = useTheme();
    const styles = useThemedStyles(createStyles);
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
            <View style={[styles.card]}>
                <View style={styles.sessionsHeaderRow}>
                    <View>
                        <Text style={[styles.cardTitle]}>
                            Active Sessions ({sessions.length})
                        </Text>
                        <Text style={[styles.cardSubtitle]}>
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
                                        color={theme.successEmerald}
                                        name={getSessionIcon(
                                            currentSession.platform,
                                            currentSession.device_type,
                                        )}
                                        size={20}
                                    />
                                </View>
                                <View style={styles.sessionMeta}>
                                    <View style={styles.labelCurrentRow}>
                                        <Text style={[styles.sessionLabel]}>
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
                                    <Text style={[styles.sessionDetails]}>
                                        {currentSession.browser} ·{' '}
                                        {currentSession.platform} ·{' '}
                                        {currentSession.ip_address}
                                    </Text>
                                    <Text style={[styles.sessionLocation]}>
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
                        <Text style={[styles.otherSessionsHeader]}>
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
                                                    color={theme.actionCobalt}
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
                                                    ]}
                                                >
                                                    {session.device_label ||
                                                        'Web / Device'}
                                                </Text>
                                                <Text
                                                    style={[
                                                        styles.sessionDetails,
                                                    ]}
                                                >
                                                    {session.browser} ·{' '}
                                                    {session.platform} ·{' '}
                                                    {session.ip_address}
                                                </Text>
                                                <Text
                                                    style={[
                                                        styles.sessionLocation,
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
                                                        color={theme.hazardRed}
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
                                                style={[styles.hairlineDivider]}
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
            <View style={[styles.card]}>
                <Text style={[styles.cardTitle]}>Security Activity Log</Text>
                <Text style={[styles.cardSubtitle]}>
                    Immutable audit events recorded for authentication and
                    safety
                </Text>

                <View style={styles.activityTimeline}>
                    {activityList.length === 0 ? (
                        <Text style={[styles.emptyText]}>
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
                                                style={[styles.timelineLine]}
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
                                                    ]}
                                                >
                                                    {item.event_label ||
                                                        item.action}
                                                </Text>
                                                <Text
                                                    style={[
                                                        styles.activityMeta,
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
                                            <Text style={[styles.activityTime]}>
                                                {item.occurred_at_human}
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.activityLocation,
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
                                color={theme.brandAmberText}
                                size="small"
                            />
                        ) : (
                            <Text style={[styles.loadMoreText]}>
                                Load More Activity
                            </Text>
                        )}
                    </Pressable>
                ) : null}
            </View>
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        container: {
            gap: 16,
        },
        card: {
            backgroundColor: theme.surface,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: theme.border,
            elevation: 1,
            overflow: 'hidden',
        },
        cardTitle: {
            fontSize: 16,
            fontWeight: '700',
            color: theme.textPrimary,
        },
        cardSubtitle: {
            fontSize: 12,
            color: theme.textSecondary,
            marginTop: 2,
        },
        feedbackBanner: {
            borderRadius: 10,
            padding: 12,
        },
        feedbackSuccess: {
            backgroundColor: theme.successEmeraldLight,
            borderWidth: 1,
            borderColor: theme.successEmerald,
        },
        feedbackError: {
            backgroundColor: theme.hazardRedLight,
            borderWidth: 1,
            borderColor: theme.hazardRed,
        },
        feedbackText: {
            fontSize: 13,
            fontWeight: '600',
        },
        feedbackSuccessText: {
            color: theme.successEmeraldText,
        },
        feedbackErrorText: {
            color: theme.hazardRedText,
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
            color: theme.hazardRed,
        },
        currentSessionCard: {
            marginTop: 14,
            padding: 14,
            borderRadius: 14,
            backgroundColor: theme.successEmeraldLight,
            borderWidth: 1.5,
            borderColor: theme.successEmerald,
        },
        darkCurrentSessionCard: {
            backgroundColor: `${theme.successEmeraldLight}20`,
            borderColor: theme.successEmerald,
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
            backgroundColor: theme.successEmeraldLight,
        },
        darkCurrentDeviceIconSquircle: {
            backgroundColor: theme.successEmeraldLight,
        },
        lightDeviceIconSquircle: {
            backgroundColor: theme.actionCobaltLight,
        },
        darkDeviceIconSquircle: {
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: theme.border,
        },
        beaconRing: {
            backgroundColor: `${theme.hudGlowEmerald}33`,
            padding: 2.5,
            borderRadius: 999,
            justifyContent: 'center',
            alignItems: 'center',
        },
        onlineDot: {
            width: 7,
            height: 7,
            borderRadius: 3.5,
            backgroundColor: theme.hudGlowEmerald,
        },
        labelCurrentRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        sessionLabel: {
            fontSize: 14,
            fontWeight: '700',
            color: theme.textPrimary,
        },
        currentBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            backgroundColor: theme.successEmeraldLight,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 6,
        },
        currentBadgeText: {
            fontSize: 12,
            fontWeight: '700',
            color: theme.successEmeraldText,
        },
        sessionDetails: {
            fontSize: 12,
            color: theme.textSecondary,
            marginTop: 2,
        },
        sessionLocation: {
            fontSize: 12,
            color: theme.textMuted,
            marginTop: 2,
        },
        otherSessionsList: {
            marginTop: 16,
            gap: 10,
        },
        otherSessionsHeader: {
            fontSize: 12,
            fontWeight: '700',
            color: theme.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        groupedInsetContainer: {
            borderRadius: 14,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.surfaceHighlight,
            overflow: 'hidden',
        },
        darkGroupedInsetContainer: {
            backgroundColor: theme.textInverse,
            borderColor: theme.border,
        },
        hairlineDivider: {
            height: StyleSheet.hairlineWidth,
            marginLeft: 62,
            backgroundColor: theme.border,
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
            backgroundColor: theme.hazardRedLight,
        },
        darkRevokeSingleBtn: {
            backgroundColor: `${theme.hazardRedLight}40`,
            borderWidth: 1,
            borderColor: theme.hazardRed,
        },
        revokeSingleBtnText: {
            fontSize: 12,
            fontWeight: '600',
            color: theme.hazardRed,
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
            backgroundColor: theme.successEmeraldLight,
        },
        timelineNodeSuccessDark: {
            backgroundColor: theme.successEmeraldLight,
        },
        timelineNodeFailedLight: {
            backgroundColor: theme.hazardRedLight,
        },
        timelineNodeFailedDark: {
            backgroundColor: theme.hazardRedLight,
        },
        timelineDot: {
            width: 8,
            height: 8,
            borderRadius: 4,
        },
        timelineDotSuccess: {
            backgroundColor: theme.hudGlowEmerald,
        },
        timelineDotFailed: {
            backgroundColor: theme.hazardRed,
        },
        timelineLine: {
            position: 'absolute',
            top: 26,
            bottom: -12,
            width: 2,
            backgroundColor: theme.border,
        },
        activityCard: {
            flex: 1,
            padding: 12,
            borderRadius: 12,
            backgroundColor: theme.surfaceHighlight,
            borderWidth: 1,
            borderColor: theme.border,
            gap: 6,
        },
        darkActivityCard: {
            backgroundColor: theme.textInverse,
            borderColor: theme.border,
        },
        emptyText: {
            fontSize: 13,
            color: theme.textMuted,
            fontStyle: 'italic',
            paddingVertical: 8,
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
            color: theme.textPrimary,
        },
        activityMeta: {
            fontSize: 12,
            color: theme.textSecondary,
        },
        outcomeBadge: {
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 4,
        },
        outcomeSuccess: {
            backgroundColor: theme.successEmeraldLight,
        },
        outcomeFailed: {
            backgroundColor: theme.hazardRedLight,
        },
        outcomeBadgeText: {
            fontSize: 12,
            fontWeight: '700',
            textTransform: 'uppercase',
        },
        outcomeSuccessText: {
            color: theme.successEmeraldText,
        },
        outcomeFailedText: {
            color: theme.hazardRed,
        },
        activityBottomRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        activityTime: {
            fontSize: 12,
            color: theme.textMuted,
        },
        activityLocation: {
            fontSize: 12,
            color: theme.textSecondary,
        },
        loadMoreBtn: {
            minHeight: 48,
            borderRadius: 10,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: theme.canvas,
            marginTop: 12,
        },
        darkLoadMoreBtn: {
            backgroundColor: theme.border,
        },
        loadMoreText: {
            fontSize: 13,
            fontWeight: '700',
            color: theme.textPrimary,
        },
        pressed: {
            opacity: 0.75,
        },
    });
