import React, { useContext, useEffect, useMemo, useState } from 'react';
import {
    Animated,
    Modal,
    PanResponder,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import type {
    DispatchJob,
    FieldNotificationItem,
    NotificationTab,
    OutboxCommand,
} from '../../types/index';
import { Icon } from '../common/Icon';
import { colors, shadows } from '../nativeStyles';

export type { FieldNotificationItem };

export interface NotificationsSheetProps {
    visible: boolean;
    onClose: () => void;
    queuedCount?: number;
    failedCount?: number;
    conflictCount?: number;
    pendingResponseCount?: number;
    failedCommands?: OutboxCommand[];
    pendingJobs?: DispatchJob[];
    onRetryCommand?: (id: string) => void;
    onDiscardCommand?: (id: string) => void;
    onSyncNow?: () => void;
    onAcceptJob?: (jobId: number) => void;
    onDeclineJob?: (jobId: number) => void;
    isOnline?: boolean | null;
}

export interface CommandDisplayInfo {
    title: string;
    description: string;
    badgeLabel: string;
}

export const getCommandDisplayInfo = (
    cmd: OutboxCommand,
): CommandDisplayInfo => {
    switch (cmd.type) {
        case 'activate_sos':
            return {
                title: 'Emergency SOS alert failed to send',
                description:
                    cmd.error?.message ||
                    'Your SOS distress signal could not reach dispatch. Tap Retry immediately or call dispatch directly.',
                badgeLabel: 'Critical Alert',
            };
        case 'submit_job_report':
            return {
                title: 'Job report upload failed',
                description:
                    cmd.error?.message ||
                    'Your submitted report is saved locally on this device. Tap Retry to upload.',
                badgeLabel: 'Sync Failed',
            };
        case 'transition_status':
            return {
                title: 'Status update failed',
                description:
                    cmd.error?.message ||
                    'Unable to synchronize job status with dispatch. Tap Retry.',
                badgeLabel: 'Sync Failed',
            };
        case 'respond_assignment':
            return {
                title: 'Assignment response failed',
                description:
                    cmd.error?.message ||
                    'Your job response could not be delivered to dispatch. Tap Retry.',
                badgeLabel: 'Sync Failed',
            };
        default:
            return {
                title: `Action needs review: ${cmd.type.replaceAll('_', ' ')}`,
                description:
                    cmd.error?.message ||
                    'This action could not be synchronized with dispatch.',
                badgeLabel: 'Failed',
            };
    }
};

export const NotificationsSheet: React.FC<NotificationsSheetProps> = ({
    visible,
    onClose,
    queuedCount = 0,
    failedCount = 0,
    conflictCount = 0,
    pendingResponseCount = 0,
    failedCommands = [],
    pendingJobs = [],
    onRetryCommand,
    onDiscardCommand,
    onSyncNow,
    onAcceptJob,
    onDeclineJob,
    isOnline,
}) => {
    const { isDarkHud } = useTheme();
    const insets = useContext(SafeAreaInsetsContext);
    const bottomInset = insets?.bottom ?? 0;
    const [activeTab, setActiveTab] = useState<NotificationTab>('all');

    const totalAlerts = failedCount + conflictCount;
    const totalDispatches = pendingJobs.length || pendingResponseCount;
    const totalOutbox = queuedCount;
    const totalAttention = totalAlerts + totalDispatches;
    const totalItems = totalAlerts + totalDispatches + totalOutbox;

    const panY = useMemo(() => new Animated.Value(0), []);

    useEffect(() => {
        if (visible) {
            panY.setValue(0);
        }
    }, [visible, panY]);

    const handleClose = () => {
        setActiveTab('all');
        onClose();
    };

    const panResponder = useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => false,
                onMoveShouldSetPanResponder: (_, gestureState) =>
                    gestureState.dy > 8 && Math.abs(gestureState.dx) < 20,
                onPanResponderMove: (_, gestureState) => {
                    if (gestureState.dy > 0) {
                        panY.setValue(gestureState.dy);
                    }
                },
                onPanResponderRelease: (_, gestureState) => {
                    if (gestureState.dy > 80 || gestureState.vy > 0.5) {
                        Animated.timing(panY, {
                            duration: 150,
                            toValue: 500,
                            useNativeDriver: true,
                        }).start(() => {
                            setActiveTab('all');
                            onClose();
                            panY.setValue(0);
                        });
                    } else {
                        Animated.spring(panY, {
                            bounciness: 4,
                            toValue: 0,
                            useNativeDriver: true,
                        }).start();
                    }
                },
            }),
        [onClose, panY],
    );

    const scrimOpacity = panY.interpolate({
        inputRange: [0, 250],
        outputRange: [isDarkHud ? 0.75 : 0.45, 0],
        extrapolate: 'clamp',
    });

    const hasAlertsSection =
        (activeTab === 'all' || activeTab === 'alerts') &&
        failedCommands.length > 0;
    const hasDispatchesSection =
        (activeTab === 'all' || activeTab === 'dispatches') &&
        pendingJobs.length > 0;
    const hasOutboxSection =
        activeTab === 'outbox' || (activeTab === 'all' && queuedCount > 0);

    const isEmptyTab =
        (activeTab === 'all' &&
            totalItems === 0 &&
            failedCommands.length === 0 &&
            pendingJobs.length === 0 &&
            queuedCount === 0) ||
        (activeTab === 'alerts' && failedCommands.length === 0) ||
        (activeTab === 'dispatches' && pendingJobs.length === 0) ||
        (activeTab === 'outbox' && queuedCount === 0);

    return (
        <Modal
            animationType="slide"
            onRequestClose={handleClose}
            statusBarTranslucent
            transparent
            visible={visible}
        >
            <View
                accessibilityViewIsModal
                style={styles.modalRoot}
                testID="notifications-sheet"
            >
                <Animated.View
                    style={[
                        styles.scrim,
                        {
                            backgroundColor: isDarkHud
                                ? '#090D16'
                                : 'rgba(15, 23, 42, 0.45)',
                            opacity: scrimOpacity,
                        },
                    ]}
                >
                    <Pressable
                        accessibilityLabel="Close notifications backdrop"
                        accessibilityRole="button"
                        onPress={handleClose}
                        style={StyleSheet.absoluteFill}
                        testID="notifications-sheet-dismiss"
                    />
                </Animated.View>

                <Animated.View
                    style={[
                        styles.sheet,
                        isDarkHud && styles.darkSheet,
                        {
                            paddingBottom: Math.max(24, bottomInset + 16),
                            transform: [{ translateY: panY }],
                        },
                    ]}
                >
                    {/* Gesture Handle & Header Bar */}
                    <View {...panResponder.panHandlers} style={styles.dragZone}>
                        <View
                            style={[
                                styles.handle,
                                isDarkHud && styles.darkHandle,
                            ]}
                        />
                        <View style={styles.sheetHeader}>
                            <View style={styles.titleRow}>
                                <Text
                                    accessibilityRole="header"
                                    style={[
                                        styles.title,
                                        isDarkHud && styles.darkTitle,
                                    ]}
                                >
                                    Notifications & Alerts
                                </Text>
                                {totalAttention > 0 ? (
                                    <View
                                        style={[
                                            styles.badge,
                                            isDarkHud && styles.darkBadge,
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.badgeText,
                                                isDarkHud &&
                                                    styles.darkBadgeText,
                                            ]}
                                        >
                                            {totalAttention} Action
                                            {totalAttention > 1 ? 's' : ''}
                                        </Text>
                                    </View>
                                ) : null}
                            </View>
                            <Pressable
                                accessibilityLabel="Close notifications sheet"
                                accessibilityRole="button"
                                hitSlop={{
                                    top: 8,
                                    bottom: 8,
                                    left: 8,
                                    right: 8,
                                }}
                                onPress={handleClose}
                                style={({ pressed }) => [
                                    styles.closeButton,
                                    isDarkHud && styles.darkCloseButton,
                                    pressed && styles.pressed,
                                ]}
                                testID="notifications-sheet-close"
                            >
                                <Icon
                                    color={isDarkHud ? '#CBD5E1' : '#475569'}
                                    name="close"
                                    size={18}
                                />
                            </Pressable>
                        </View>
                    </View>

                    {/* Segmented Filter Tab Controls */}
                    <View
                        accessibilityRole="tablist"
                        style={[
                            styles.segmentedBar,
                            isDarkHud && styles.darkSegmentedBar,
                        ]}
                    >
                        <Pressable
                            accessibilityLabel={`All notifications, ${totalItems} items`}
                            accessibilityRole="tab"
                            accessibilityState={{
                                selected: activeTab === 'all',
                            }}
                            onPress={() => setActiveTab('all')}
                            style={[
                                styles.tabPill,
                                activeTab === 'all' &&
                                    (isDarkHud
                                        ? styles.darkTabPillActive
                                        : styles.tabPillActive),
                            ]}
                            testID="notification-tab-all"
                        >
                            <Text
                                style={[
                                    styles.tabText,
                                    isDarkHud && styles.darkTabText,
                                    activeTab === 'all' &&
                                        (isDarkHud
                                            ? styles.darkTabTextActive
                                            : styles.tabTextActive),
                                ]}
                            >
                                All {totalItems > 0 ? `(${totalItems})` : ''}
                            </Text>
                        </Pressable>

                        <Pressable
                            accessibilityLabel={`Alerts, ${totalAlerts} items`}
                            accessibilityRole="tab"
                            accessibilityState={{
                                selected: activeTab === 'alerts',
                            }}
                            onPress={() => setActiveTab('alerts')}
                            style={[
                                styles.tabPill,
                                activeTab === 'alerts' &&
                                    (isDarkHud
                                        ? styles.darkTabPillActive
                                        : styles.tabPillActive),
                            ]}
                            testID="notification-tab-alerts"
                        >
                            <Text
                                style={[
                                    styles.tabText,
                                    isDarkHud && styles.darkTabText,
                                    activeTab === 'alerts' &&
                                        (isDarkHud
                                            ? styles.darkTabTextActive
                                            : styles.tabTextActive),
                                ]}
                            >
                                Alerts{' '}
                                {totalAlerts > 0 ? `(${totalAlerts})` : ''}
                            </Text>
                        </Pressable>

                        <Pressable
                            accessibilityLabel={`Dispatches, ${totalDispatches} invites`}
                            accessibilityRole="tab"
                            accessibilityState={{
                                selected: activeTab === 'dispatches',
                            }}
                            onPress={() => setActiveTab('dispatches')}
                            style={[
                                styles.tabPill,
                                activeTab === 'dispatches' &&
                                    (isDarkHud
                                        ? styles.darkTabPillActive
                                        : styles.tabPillActive),
                            ]}
                            testID="notification-tab-dispatches"
                        >
                            <Text
                                style={[
                                    styles.tabText,
                                    isDarkHud && styles.darkTabText,
                                    activeTab === 'dispatches' &&
                                        (isDarkHud
                                            ? styles.darkTabTextActive
                                            : styles.tabTextActive),
                                ]}
                            >
                                Dispatches{' '}
                                {totalDispatches > 0
                                    ? `(${totalDispatches})`
                                    : ''}
                            </Text>
                        </Pressable>

                        <Pressable
                            accessibilityLabel={`Outbox, ${totalOutbox} items`}
                            accessibilityRole="tab"
                            accessibilityState={{
                                selected: activeTab === 'outbox',
                            }}
                            onPress={() => setActiveTab('outbox')}
                            style={[
                                styles.tabPill,
                                activeTab === 'outbox' &&
                                    (isDarkHud
                                        ? styles.darkTabPillActive
                                        : styles.tabPillActive),
                            ]}
                            testID="notification-tab-outbox"
                        >
                            <Text
                                style={[
                                    styles.tabText,
                                    isDarkHud && styles.darkTabText,
                                    activeTab === 'outbox' &&
                                        (isDarkHud
                                            ? styles.darkTabTextActive
                                            : styles.tabTextActive),
                                ]}
                            >
                                Outbox{' '}
                                {totalOutbox > 0 ? `(${totalOutbox})` : ''}
                            </Text>
                        </Pressable>
                    </View>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        style={styles.scrollArea}
                    >
                        {/* 1. Sync Attention & Failed Items (Primary - Top of feed) */}
                        {hasAlertsSection ? (
                            <View style={styles.section}>
                                <Text
                                    style={[
                                        styles.sectionLabel,
                                        isDarkHud && styles.darkSectionLabel,
                                    ]}
                                >
                                    Actions Requiring Attention (
                                    {failedCommands.length})
                                </Text>
                                {failedCommands.map((cmd) => {
                                    const display = getCommandDisplayInfo(cmd);

                                    return (
                                        <View
                                            key={cmd.id}
                                            style={[
                                                styles.richCard,
                                                styles.failedCard,
                                                isDarkHud &&
                                                    styles.darkFailedCard,
                                            ]}
                                        >
                                            <View style={styles.cardHeaderRow}>
                                                <View
                                                    style={[
                                                        styles.cardIconWrap,
                                                        styles.alertIconWrap,
                                                        isDarkHud &&
                                                            styles.darkAlertIconWrap,
                                                    ]}
                                                >
                                                    <Icon
                                                        color={
                                                            isDarkHud
                                                                ? '#F87171'
                                                                : colors.red
                                                        }
                                                        name="alert-circle"
                                                        size={18}
                                                    />
                                                </View>
                                                <View
                                                    style={
                                                        styles.cardHeaderCopy
                                                    }
                                                >
                                                    <View
                                                        style={
                                                            styles.cardTitleTopRow
                                                        }
                                                    >
                                                        <Text
                                                            style={[
                                                                styles.failedTitle,
                                                                isDarkHud &&
                                                                    styles.darkFailedTitle,
                                                            ]}
                                                        >
                                                            {display.title}
                                                        </Text>
                                                        <View
                                                            style={[
                                                                styles.pillBadge,
                                                                styles.redPillBadge,
                                                                isDarkHud &&
                                                                    styles.darkRedPillBadge,
                                                            ]}
                                                        >
                                                            <Text
                                                                style={[
                                                                    styles.redPillBadgeText,
                                                                    isDarkHud &&
                                                                        styles.darkRedPillBadgeText,
                                                                ]}
                                                            >
                                                                {
                                                                    display.badgeLabel
                                                                }
                                                            </Text>
                                                        </View>
                                                    </View>
                                                    <Text
                                                        style={[
                                                            styles.failedDesc,
                                                            isDarkHud &&
                                                                styles.darkFailedDesc,
                                                        ]}
                                                    >
                                                        {display.description}
                                                    </Text>
                                                </View>
                                            </View>

                                            <View style={styles.cardActionsRow}>
                                                {cmd.error?.retryable &&
                                                onRetryCommand ? (
                                                    <Pressable
                                                        accessibilityLabel={`Retry action ${display.title}`}
                                                        accessibilityRole="button"
                                                        hitSlop={{
                                                            top: 4,
                                                            bottom: 4,
                                                            left: 4,
                                                            right: 4,
                                                        }}
                                                        onPress={() =>
                                                            onRetryCommand(
                                                                cmd.id,
                                                            )
                                                        }
                                                        style={({
                                                            pressed,
                                                        }) => [
                                                            styles.retryBtn,
                                                            pressed &&
                                                                styles.pressed,
                                                        ]}
                                                        testID={`notification-retry-btn-${cmd.id}`}
                                                    >
                                                        <Text
                                                            style={
                                                                styles.retryBtnText
                                                            }
                                                        >
                                                            Retry
                                                        </Text>
                                                    </Pressable>
                                                ) : null}
                                                {onDiscardCommand ? (
                                                    <Pressable
                                                        accessibilityHint="Permanently removes this unsaved action from this device"
                                                        accessibilityLabel={`Discard action ${display.title}`}
                                                        accessibilityRole="button"
                                                        hitSlop={{
                                                            top: 4,
                                                            bottom: 4,
                                                            left: 4,
                                                            right: 4,
                                                        }}
                                                        onPress={() =>
                                                            onDiscardCommand(
                                                                cmd.id,
                                                            )
                                                        }
                                                        style={({
                                                            pressed,
                                                        }) => [
                                                            styles.discardBtn,
                                                            isDarkHud &&
                                                                styles.darkDiscardBtn,
                                                            pressed &&
                                                                styles.pressed,
                                                        ]}
                                                        testID={`notification-discard-btn-${cmd.id}`}
                                                    >
                                                        <Text
                                                            style={[
                                                                styles.discardBtnText,
                                                                isDarkHud &&
                                                                    styles.darkDiscardBtnText,
                                                            ]}
                                                        >
                                                            Discard
                                                        </Text>
                                                    </Pressable>
                                                ) : null}
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        ) : null}

                        {/* 2. Pending Assignment Notifications (Rich Cards with Accept / Decline) */}
                        {hasDispatchesSection ? (
                            <View style={styles.section}>
                                <Text
                                    style={[
                                        styles.sectionLabel,
                                        isDarkHud && styles.darkSectionLabel,
                                    ]}
                                >
                                    New Assignment Invites ({pendingJobs.length}
                                    )
                                </Text>
                                {pendingJobs.map((job) => (
                                    <View
                                        key={job.id}
                                        style={[
                                            styles.richCard,
                                            isDarkHud && styles.darkRichCard,
                                        ]}
                                    >
                                        <View style={styles.cardHeaderRow}>
                                            <View
                                                style={[
                                                    styles.cardIconWrap,
                                                    styles.dispatchIconWrap,
                                                    isDarkHud &&
                                                        styles.darkDispatchIconWrap,
                                                ]}
                                            >
                                                <Icon
                                                    color={
                                                        isDarkHud
                                                            ? '#60A5FA'
                                                            : colors.blueDark
                                                    }
                                                    name="file-text"
                                                    size={18}
                                                />
                                            </View>
                                            <View style={styles.cardHeaderCopy}>
                                                <View
                                                    style={
                                                        styles.cardTitleTopRow
                                                    }
                                                >
                                                    <Text
                                                        style={[
                                                            styles.cardTitle,
                                                            isDarkHud &&
                                                                styles.darkCardTitle,
                                                        ]}
                                                    >
                                                        {job.reference} ·{' '}
                                                        {job.title}
                                                    </Text>
                                                    <View
                                                        style={[
                                                            styles.pillBadge,
                                                            styles.bluePillBadge,
                                                            isDarkHud &&
                                                                styles.darkBluePillBadge,
                                                        ]}
                                                    >
                                                        <Text
                                                            style={[
                                                                styles.bluePillBadgeText,
                                                                isDarkHud &&
                                                                    styles.darkBluePillBadgeText,
                                                            ]}
                                                        >
                                                            Invite
                                                        </Text>
                                                    </View>
                                                </View>
                                                <Text
                                                    style={[
                                                        styles.cardSubtitle,
                                                        isDarkHud &&
                                                            styles.darkCardSubtitle,
                                                    ]}
                                                >
                                                    Site:{' '}
                                                    {job.site ||
                                                        'Main Terminal'}
                                                </Text>
                                            </View>
                                        </View>

                                        <View style={styles.cardActionsRow}>
                                            {onAcceptJob ? (
                                                <Pressable
                                                    accessibilityLabel={`Accept dispatch ${job.reference}`}
                                                    accessibilityRole="button"
                                                    hitSlop={{
                                                        top: 4,
                                                        bottom: 4,
                                                        left: 4,
                                                        right: 4,
                                                    }}
                                                    onPress={() =>
                                                        onAcceptJob(job.id)
                                                    }
                                                    style={({ pressed }) => [
                                                        styles.acceptJobBtn,
                                                        pressed &&
                                                            styles.pressed,
                                                    ]}
                                                    testID={`notification-accept-job-${job.id}`}
                                                >
                                                    <Text
                                                        style={
                                                            styles.acceptJobBtnText
                                                        }
                                                    >
                                                        Accept Dispatch
                                                    </Text>
                                                </Pressable>
                                            ) : null}
                                            {onDeclineJob ? (
                                                <Pressable
                                                    accessibilityLabel={`Decline dispatch ${job.reference}`}
                                                    accessibilityRole="button"
                                                    hitSlop={{
                                                        top: 4,
                                                        bottom: 4,
                                                        left: 4,
                                                        right: 4,
                                                    }}
                                                    onPress={() =>
                                                        onDeclineJob(job.id)
                                                    }
                                                    style={({ pressed }) => [
                                                        styles.declineJobBtn,
                                                        isDarkHud &&
                                                            styles.darkDeclineJobBtn,
                                                        pressed &&
                                                            styles.pressed,
                                                    ]}
                                                    testID={`notification-decline-job-${job.id}`}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.declineJobBtnText,
                                                            isDarkHud &&
                                                                styles.darkDeclineJobBtnText,
                                                        ]}
                                                    >
                                                        Decline
                                                    </Text>
                                                </Pressable>
                                            ) : null}
                                        </View>
                                    </View>
                                ))}
                            </View>
                        ) : null}

                        {/* 3. Connection & Outbox Sync Banner (Third - only when queued items exist or on Outbox tab) */}
                        {hasOutboxSection ? (
                            <View style={styles.section}>
                                <Text
                                    style={[
                                        styles.sectionLabel,
                                        isDarkHud && styles.darkSectionLabel,
                                    ]}
                                >
                                    System Status & Outbox
                                </Text>
                                <View
                                    style={[
                                        styles.statusCard,
                                        isDarkHud && styles.darkStatusCard,
                                    ]}
                                >
                                    <View style={styles.statusRow}>
                                        <View style={styles.statusLeft}>
                                            <View
                                                style={[
                                                    styles.statusDot,
                                                    isOnline === false
                                                        ? styles.statusDotOffline
                                                        : styles.statusDotOnline,
                                                ]}
                                            />
                                            <Text
                                                style={[
                                                    styles.statusTitle,
                                                    isDarkHud &&
                                                        styles.darkStatusTitle,
                                                ]}
                                            >
                                                {isOnline === false
                                                    ? 'Offline Mode'
                                                    : 'Connected to Network'}
                                            </Text>
                                        </View>
                                        <Text
                                            style={[
                                                styles.statusMeta,
                                                isDarkHud &&
                                                    styles.darkStatusMeta,
                                            ]}
                                        >
                                            {isOnline === false
                                                ? 'Saved locally'
                                                : 'Online'}
                                        </Text>
                                    </View>

                                    {queuedCount > 0 ? (
                                        <View
                                            style={[
                                                styles.outboxNotice,
                                                isDarkHud &&
                                                    styles.darkOutboxNotice,
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.outboxNoticeText,
                                                    isDarkHud &&
                                                        styles.darkOutboxNoticeText,
                                                ]}
                                            >
                                                ⏳ {queuedCount} action
                                                {queuedCount > 1
                                                    ? 's'
                                                    : ''}{' '}
                                                queued for upload
                                            </Text>
                                            {isOnline !== false && onSyncNow ? (
                                                <Pressable
                                                    accessibilityLabel="Sync now"
                                                    accessibilityRole="button"
                                                    hitSlop={{
                                                        top: 6,
                                                        bottom: 6,
                                                        left: 6,
                                                        right: 6,
                                                    }}
                                                    onPress={onSyncNow}
                                                    style={({ pressed }) => [
                                                        styles.syncNowBtn,
                                                        pressed &&
                                                            styles.pressed,
                                                    ]}
                                                >
                                                    <Text
                                                        style={
                                                            styles.syncNowBtnText
                                                        }
                                                    >
                                                        Sync now
                                                    </Text>
                                                </Pressable>
                                            ) : null}
                                        </View>
                                    ) : null}
                                </View>
                            </View>
                        ) : null}

                        {/* 4. Empty State when current view is all clear */}
                        {isEmptyTab ? (
                            <View
                                style={[
                                    styles.emptyCard,
                                    isDarkHud && styles.darkEmptyCard,
                                ]}
                                testID="notification-empty-state"
                            >
                                <View
                                    style={[
                                        styles.emptyIconCircle,
                                        isDarkHud && styles.darkEmptyIconCircle,
                                    ]}
                                >
                                    <Icon
                                        color={
                                            isDarkHud
                                                ? '#34D399'
                                                : colors.greenDark
                                        }
                                        name="shield-check"
                                        size={28}
                                    />
                                </View>
                                <Text
                                    style={[
                                        styles.emptyTitle,
                                        isDarkHud && styles.darkEmptyTitle,
                                    ]}
                                >
                                    {activeTab === 'dispatches'
                                        ? 'No Pending Dispatches'
                                        : activeTab === 'alerts'
                                          ? 'No Active Alerts'
                                          : activeTab === 'outbox'
                                            ? 'Outbox Synchronized'
                                            : "You're all caught up!"}
                                </Text>
                                <Text
                                    style={[
                                        styles.emptyBody,
                                        isDarkHud && styles.darkEmptyBody,
                                    ]}
                                >
                                    {activeTab === 'dispatches'
                                        ? 'All dispatch assignments have been reviewed and accepted.'
                                        : activeTab === 'alerts'
                                          ? 'No safety warnings, errors, or failed sync commands.'
                                          : activeTab === 'outbox'
                                            ? 'All local field actions and telemetry logs have been synced to dispatch.'
                                            : 'No pending alerts or unsynced actions. All field operations are up to date.'}
                                </Text>
                            </View>
                        ) : null}
                    </ScrollView>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalRoot: {
        backgroundColor: 'transparent',
        flex: 1,
        justifyContent: 'flex-end',
    },
    scrim: {
        ...StyleSheet.absoluteFill,
    },
    sheet: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderWidth: 1,
        gap: 12,
        maxHeight: '85%',
        paddingBottom: 24,
        paddingHorizontal: 18,
        paddingTop: 10,
        ...shadows.lg,
    },
    darkSheet: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
    },
    dragZone: {
        gap: 10,
        paddingBottom: 2,
    },
    handle: {
        alignSelf: 'center',
        backgroundColor: colors.borderStrong,
        borderRadius: 3,
        height: 5,
        width: 44,
    },
    darkHandle: {
        backgroundColor: '#475569',
    },
    sheetHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 2,
    },
    titleRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    title: {
        color: colors.text,
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: -0.2,
    },
    darkTitle: {
        color: '#F8FAFC',
    },
    badge: {
        backgroundColor: colors.warningSoft,
        borderColor: colors.warningBorder,
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    darkBadge: {
        backgroundColor: 'rgba(245, 158, 11, 0.16)',
        borderColor: 'rgba(245, 158, 11, 0.4)',
    },
    badgeText: {
        color: colors.warningDark,
        fontSize: 11,
        fontWeight: '800',
    },
    darkBadgeText: {
        color: '#FBBF24',
    },
    closeButton: {
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        borderColor: colors.border,
        borderRadius: 18,
        borderWidth: 1,
        height: 36,
        justifyContent: 'center',
        width: 36,
    },
    darkCloseButton: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    segmentedBar: {
        backgroundColor: '#F1F5F9',
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: 'row',
        padding: 3,
    },
    darkSegmentedBar: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    tabPill: {
        alignItems: 'center',
        borderRadius: 9,
        flex: 1,
        justifyContent: 'center',
        minHeight: 34,
        paddingHorizontal: 4,
        paddingVertical: 6,
    },
    tabPillActive: {
        backgroundColor: '#0F172A',
        ...shadows.sm,
    },
    darkTabPillActive: {
        backgroundColor: '#F59E0B',
        ...shadows.sm,
    },
    tabText: {
        color: colors.secondary,
        fontSize: 12,
        fontWeight: '700',
    },
    darkTabText: {
        color: '#94A3B8',
    },
    tabTextActive: {
        color: '#FFFFFF',
        fontWeight: '800',
    },
    darkTabTextActive: {
        color: '#0F172A',
        fontWeight: '900',
    },
    scrollArea: {
        flexGrow: 0,
    },
    section: {
        gap: 8,
        marginBottom: 16,
    },
    sectionLabel: {
        color: colors.muted,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
    darkSectionLabel: {
        color: '#94A3B8',
    },
    statusCard: {
        backgroundColor: '#F8FAFC',
        borderColor: colors.border,
        borderRadius: 14,
        borderWidth: 1,
        gap: 10,
        padding: 12,
        ...shadows.sm,
    },
    darkStatusCard: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    statusRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    statusLeft: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    statusDot: {
        borderRadius: 4,
        height: 8,
        width: 8,
    },
    statusDotOnline: {
        backgroundColor: colors.green,
    },
    statusDotOffline: {
        backgroundColor: colors.warning,
    },
    statusTitle: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '700',
    },
    darkStatusTitle: {
        color: '#F8FAFC',
    },
    statusMeta: {
        color: colors.secondary,
        fontSize: 12,
        fontWeight: '600',
    },
    darkStatusMeta: {
        color: '#94A3B8',
    },
    outboxNotice: {
        alignItems: 'center',
        borderTopColor: colors.border,
        borderTopWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingTop: 8,
    },
    darkOutboxNotice: {
        borderTopColor: '#334155',
    },
    outboxNoticeText: {
        color: colors.secondary,
        fontSize: 13,
        fontWeight: '600',
    },
    darkOutboxNoticeText: {
        color: '#CBD5E1',
    },
    syncNowBtn: {
        backgroundColor: colors.amber,
        borderRadius: 8,
        minHeight: 34,
        justifyContent: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    syncNowBtnText: {
        color: '#0F172A',
        fontSize: 12,
        fontWeight: '800',
    },
    richCard: {
        backgroundColor: '#FFFFFF',
        borderColor: colors.border,
        borderRadius: 14,
        borderWidth: 1,
        gap: 10,
        padding: 12,
        ...shadows.sm,
    },
    darkRichCard: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    failedCard: {
        backgroundColor: '#FEF2F2',
        borderColor: colors.redBorder,
    },
    darkFailedCard: {
        backgroundColor: '#1E293B',
        borderColor: 'rgba(239, 68, 68, 0.45)',
    },
    cardHeaderRow: {
        alignItems: 'flex-start',
        flexDirection: 'row',
        gap: 10,
    },
    cardIconWrap: {
        alignItems: 'center',
        borderRadius: 10,
        height: 36,
        justifyContent: 'center',
        width: 36,
    },
    dispatchIconWrap: {
        backgroundColor: '#EFF6FF',
    },
    darkDispatchIconWrap: {
        backgroundColor: 'rgba(37, 99, 235, 0.2)',
    },
    alertIconWrap: {
        backgroundColor: '#FEE2E2',
    },
    darkAlertIconWrap: {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
    },
    cardHeaderCopy: {
        flex: 1,
        gap: 3,
    },
    cardTitleTopRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    cardTitle: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '800',
        flex: 1,
        marginRight: 6,
    },
    darkCardTitle: {
        color: '#F8FAFC',
    },
    cardSubtitle: {
        color: colors.secondary,
        fontSize: 12,
    },
    darkCardSubtitle: {
        color: '#94A3B8',
    },
    failedTitle: {
        color: colors.red,
        fontSize: 13,
        fontWeight: '800',
        flex: 1,
        marginRight: 6,
        textTransform: 'capitalize',
    },
    darkFailedTitle: {
        color: '#F87171',
    },
    failedDesc: {
        color: colors.secondary,
        fontSize: 12,
        lineHeight: 16,
    },
    darkFailedDesc: {
        color: '#CBD5E1',
    },
    pillBadge: {
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    bluePillBadge: {
        backgroundColor: '#DBEAFE',
    },
    darkBluePillBadge: {
        backgroundColor: 'rgba(37, 99, 235, 0.3)',
    },
    bluePillBadgeText: {
        color: '#1D4ED8',
        fontSize: 10,
        fontWeight: '800',
    },
    darkBluePillBadgeText: {
        color: '#93C5FD',
        fontSize: 10,
        fontWeight: '800',
    },
    redPillBadge: {
        backgroundColor: '#FEE2E2',
    },
    darkRedPillBadge: {
        backgroundColor: 'rgba(239, 68, 68, 0.3)',
    },
    redPillBadgeText: {
        color: '#B91C1C',
        fontSize: 10,
        fontWeight: '800',
    },
    darkRedPillBadgeText: {
        color: '#FCA5A5',
        fontSize: 10,
        fontWeight: '800',
    },
    cardActionsRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 2,
    },
    acceptJobBtn: {
        alignItems: 'center',
        backgroundColor: colors.blue,
        borderRadius: 8,
        flex: 1,
        justifyContent: 'center',
        minHeight: 40,
        paddingHorizontal: 12,
    },
    acceptJobBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800',
    },
    declineJobBtn: {
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        flex: 1,
        justifyContent: 'center',
        minHeight: 40,
        paddingHorizontal: 12,
    },
    darkDeclineJobBtn: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    declineJobBtnText: {
        color: colors.secondary,
        fontSize: 12,
        fontWeight: '700',
    },
    darkDeclineJobBtnText: {
        color: '#94A3B8',
    },
    retryBtn: {
        alignItems: 'center',
        backgroundColor: colors.amber,
        borderRadius: 8,
        flex: 1,
        justifyContent: 'center',
        minHeight: 40,
        paddingHorizontal: 12,
    },
    retryBtnText: {
        color: '#0F172A',
        fontSize: 12,
        fontWeight: '800',
    },
    discardBtn: {
        alignItems: 'center',
        backgroundColor: '#FFF1F2',
        borderColor: '#FECDD3',
        borderRadius: 8,
        borderWidth: 1,
        flex: 1,
        justifyContent: 'center',
        minHeight: 40,
        paddingHorizontal: 12,
    },
    darkDiscardBtn: {
        backgroundColor: 'rgba(239, 68, 68, 0.12)',
        borderColor: 'rgba(248, 113, 113, 0.65)',
        borderWidth: 1.5,
    },
    discardBtnText: {
        color: '#E11D48',
        fontSize: 12,
        fontWeight: '800',
    },
    darkDiscardBtnText: {
        color: '#FCA5A5',
        fontSize: 12,
        fontWeight: '800',
    },
    emptyCard: {
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderColor: colors.border,
        borderRadius: 16,
        borderWidth: 1,
        gap: 8,
        marginVertical: 12,
        padding: 24,
        ...shadows.sm,
    },
    darkEmptyCard: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    emptyIconCircle: {
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        borderColor: '#A7F3D0',
        borderRadius: 24,
        borderWidth: 1,
        height: 48,
        justifyContent: 'center',
        marginBottom: 4,
        width: 48,
    },
    darkEmptyIconCircle: {
        backgroundColor: 'rgba(16, 185, 129, 0.16)',
        borderColor: 'rgba(16, 185, 129, 0.4)',
    },
    emptyTitle: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '800',
    },
    darkEmptyTitle: {
        color: '#F8FAFC',
    },
    emptyBody: {
        color: colors.secondary,
        fontSize: 13,
        lineHeight: 18,
        textAlign: 'center',
    },
    darkEmptyBody: {
        color: '#94A3B8',
    },
    pressed: {
        opacity: 0.78,
    },
});
