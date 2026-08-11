import React, { useContext, useEffect, useRef } from 'react';
import { Animated, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import type { OutboxCommand, DispatchJob } from '../types/index';
import { colors, sharedStyles } from './nativeStyles';

export interface FieldNotificationItem {
    id: string;
    type: 'sync_attention' | 'pending_assignment' | 'system_info';
    title: string;
    message: string;
    timestamp?: string;
    actionLabel?: string;
    onAction?: () => void;
}

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
    onSyncNow?: () => void;
    isOnline?: boolean | null;
}

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
    onSyncNow,
    isOnline,
}) => {
    const insets = useContext(SafeAreaInsetsContext);
    const bottomInset = insets?.bottom ?? 0;

    const totalAttention = failedCount + conflictCount + pendingResponseCount;

    const panY = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            panY.setValue(0);
        }
    }, [visible, panY]);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
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
    ).current;

    return (
        <Modal
            animationType="slide"
            onRequestClose={onClose}
            statusBarTranslucent
            transparent
            visible={visible}
        >
            <View
                accessibilityViewIsModal
                style={styles.modalRoot}
                testID="notifications-sheet"
            >
                <Pressable
                    accessibilityLabel="Close notifications"
                    accessibilityRole="button"
                    onPress={onClose}
                    style={styles.scrim}
                    testID="notifications-sheet-dismiss"
                />
                <Animated.View
                    style={[
                        styles.sheet,
                        {
                            paddingBottom: Math.max(24, bottomInset + 16),
                            transform: [{ translateY: panY }],
                        },
                    ]}
                >
                    <View {...panResponder.panHandlers} style={styles.dragZone}>
                        <View style={styles.handle} />
                        <View style={styles.sheetHeader}>
                            <View style={styles.titleRow}>
                                <Text accessibilityRole="header" style={styles.title}>
                                    Notifications & Alerts
                                </Text>
                                {totalAttention > 0 ? (
                                    <View style={styles.badge}>
                                        <Text style={styles.badgeText}>
                                            {totalAttention} Action{totalAttention > 1 ? 's' : ''}
                                        </Text>
                                    </View>
                                ) : null}
                            </View>
                            <Pressable
                                accessibilityLabel="Close notifications"
                                accessibilityRole="button"
                                onPress={onClose}
                                style={({ pressed }) => [
                                    styles.closeButton,
                                    pressed && styles.pressed,
                                ]}
                                testID="notifications-sheet-close"
                            >
                                <Text style={styles.closeButtonText}>Close</Text>
                            </Pressable>
                        </View>
                    </View>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        style={styles.scrollArea}
                    >
                        {/* 1. Connection & Outbox Sync Banner */}
                        <View style={styles.section}>
                            <Text style={styles.sectionLabel}>System Status</Text>
                            <View style={styles.statusCard}>
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
                                        <Text style={styles.statusTitle}>
                                            {isOnline === false
                                                ? 'Offline Mode'
                                                : 'Connected to Network'}
                                        </Text>
                                    </View>
                                    <Text style={styles.statusMeta}>
                                        {isOnline === false
                                            ? 'Saved locally'
                                            : 'Online'}
                                    </Text>
                                </View>

                                {queuedCount > 0 ? (
                                    <View style={styles.outboxNotice}>
                                        <Text style={styles.outboxNoticeText}>
                                            ⏳ {queuedCount} action{queuedCount > 1 ? 's' : ''} queued for upload
                                        </Text>
                                        {isOnline !== false && onSyncNow ? (
                                            <Pressable
                                                accessibilityLabel="Sync now"
                                                accessibilityRole="button"
                                                onPress={onSyncNow}
                                                style={({ pressed }) => [
                                                    styles.syncNowBtn,
                                                    pressed && styles.pressed,
                                                ]}
                                            >
                                                <Text style={styles.syncNowBtnText}>
                                                    Sync now
                                                </Text>
                                            </Pressable>
                                        ) : null}
                                    </View>
                                ) : null}
                            </View>
                        </View>

                        {/* 2. Pending Assignment Notifications */}
                        {pendingJobs.length > 0 ? (
                            <View style={styles.section}>
                                <Text style={styles.sectionLabel}>
                                    New Assignment Invites ({pendingJobs.length})
                                </Text>
                                {pendingJobs.map((job) => (
                                    <View key={job.id} style={styles.alertCardNotice}>
                                        <Text style={styles.alertCardTitle}>
                                            📋 {job.reference} · {job.title}
                                        </Text>
                                        <Text style={styles.alertCardBody}>
                                            Site: {job.site}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        ) : null}

                        {/* 3. Sync Attention & Failed Items */}
                        {failedCommands.length > 0 ? (
                            <View style={styles.section}>
                                <Text style={styles.sectionLabel}>
                                    Failed Commands ({failedCommands.length})
                                </Text>
                                {failedCommands.map((cmd) => (
                                    <View key={cmd.id} style={styles.alertCardWarning}>
                                        <Text style={styles.alertCardTitleWarning}>
                                            ⚠️ Action Failed: {cmd.type.replaceAll('_', ' ')}
                                        </Text>
                                        <Text style={styles.alertCardBodyWarning}>
                                            {cmd.error?.message ||
                                                'Could not sync this action with dispatch.'}
                                        </Text>
                                        {cmd.error?.retryable && onRetryCommand ? (
                                            <Pressable
                                                accessibilityLabel="Retry command"
                                                accessibilityRole="button"
                                                onPress={() => onRetryCommand(cmd.id)}
                                                style={({ pressed }) => [
                                                    sharedStyles.button,
                                                    styles.retryButton,
                                                    pressed && styles.pressed,
                                                ]}
                                            >
                                                <Text style={sharedStyles.buttonText}>
                                                    Retry sync
                                                </Text>
                                            </Pressable>
                                        ) : null}
                                    </View>
                                ))}
                            </View>
                        ) : null}

                        {/* 4. Empty State when all clear */}
                        {totalAttention === 0 && queuedCount === 0 ? (
                            <View style={styles.emptyCard}>
                                <Text style={styles.emptyIcon}>🔔</Text>
                                <Text style={styles.emptyTitle}>You're all caught up!</Text>
                                <Text style={styles.emptyBody}>
                                    No pending alerts or unsynced actions. All field operations are up to date.
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
        backgroundColor: 'rgba(15, 23, 42, 0.42)',
        flex: 1,
        justifyContent: 'flex-end',
    },
    scrim: {
        ...StyleSheet.absoluteFill,
    },
    sheet: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderWidth: 1,
        gap: 14,
        maxHeight: '85%',
        paddingBottom: 24,
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    dragZone: {
        gap: 12,
        paddingBottom: 4,
    },
    handle: {
        alignSelf: 'center',
        backgroundColor: colors.borderStrong,
        borderRadius: 3,
        height: 5,
        width: 42,
    },
    sheetHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
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
    },
    badge: {
        backgroundColor: colors.warningSoft,
        borderColor: colors.warningBorder,
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    badgeText: {
        color: colors.warningDark,
        fontSize: 12,
        fontWeight: '800',
    },
    closeButton: {
        alignItems: 'center',
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        justifyContent: 'center',
        minHeight: 40,
        paddingHorizontal: 12,
    },
    closeButtonText: {
        color: colors.secondary,
        fontSize: 13,
        fontWeight: '700',
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
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
    statusCard: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        gap: 10,
        padding: 12,
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
    statusMeta: {
        color: colors.secondary,
        fontSize: 12,
    },
    outboxNotice: {
        alignItems: 'center',
        borderTopColor: colors.border,
        borderTopWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingTop: 8,
    },
    outboxNoticeText: {
        color: colors.secondary,
        fontSize: 13,
        fontWeight: '600',
    },
    syncNowBtn: {
        backgroundColor: colors.amber,
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    syncNowBtnText: {
        color: colors.text,
        fontSize: 12,
        fontWeight: '800',
    },
    alertCardNotice: {
        backgroundColor: colors.blueSoft,
        borderColor: colors.blueBorder,
        borderRadius: 10,
        borderWidth: 1,
        gap: 4,
        padding: 12,
    },
    alertCardTitle: {
        color: colors.blueDark,
        fontSize: 14,
        fontWeight: '800',
    },
    alertCardBody: {
        color: colors.secondary,
        fontSize: 13,
    },
    alertCardWarning: {
        backgroundColor: colors.redSoft,
        borderColor: colors.redBorder,
        borderRadius: 10,
        borderWidth: 1,
        gap: 6,
        padding: 12,
    },
    alertCardTitleWarning: {
        color: colors.redDark,
        fontSize: 14,
        fontWeight: '800',
    },
    alertCardBodyWarning: {
        color: colors.redDark,
        fontSize: 13,
        lineHeight: 18,
    },
    retryButton: {
        backgroundColor: colors.amber,
        marginTop: 6,
        minHeight: 40,
    },
    emptyCard: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        gap: 8,
        marginVertical: 12,
        padding: 24,
    },
    emptyIcon: {
        fontSize: 32,
    },
    emptyTitle: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '800',
    },
    emptyBody: {
        color: colors.secondary,
        fontSize: 13,
        lineHeight: 18,
        textAlign: 'center',
    },
    pressed: {
        opacity: 0.78,
    },
});
