import React, {
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import {
    ActivityIndicator,
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
import { projectOutbox } from '../../services/outboxProjection';
import type {
    OutboxItemDisplay,
    OutboxProjection,
} from '../../services/outboxProjection';
import { useTheme } from '../../theme';
import type { OutboxCommand } from '../../types/index';
import { Icon } from '../common/Icon';
import { colors, shadows } from '../nativeStyles';

export interface OutboxStatusSheetProps {
    visible: boolean;
    onClose: () => void;
    commands: OutboxCommand[];
    isOnline: boolean | null;
    isAuthenticated?: boolean;
    lastSuccessfulSyncAt?: string | null;
    userName?: string | null;
    userRole?: string | null;
    onSyncNow?: () => void;
    onRetryCommand?: (commandId: string) => void;
    onDiscardCommand?: (commandId: string) => void;
    onAcceptServerState?: (commandId: string) => void;
    onRetryNewVersion?: (commandId: string, newVersion: number) => void;
    onSignIn?: () => void;
    onRecaptureAttachment?: (commandId: string, oldUri: string) => void;
}

type OutboxFilterTab = 'all' | 'attention' | 'waiting' | 'completed';

export const OutboxStatusSheet: React.FC<OutboxStatusSheetProps> = ({
    visible,
    onClose,
    commands,
    isOnline,
    isAuthenticated = true,
    lastSuccessfulSyncAt,
    userName,
    userRole,
    onSyncNow,
    onRetryCommand,
    onDiscardCommand,
    onAcceptServerState,
    onRetryNewVersion,
    onSignIn,
    onRecaptureAttachment,
}) => {
    const { isDarkHud } = useTheme();
    const insets = useContext(SafeAreaInsetsContext);
    const bottomInset = insets?.bottom ?? 0;

    const [activeFilter, setActiveFilter] = useState<OutboxFilterTab>('all');
    const [commandToDiscard, setCommandToDiscard] =
        useState<OutboxItemDisplay | null>(null);

    const projection: OutboxProjection = useMemo(
        () =>
            projectOutbox(
                commands,
                isOnline,
                isAuthenticated,
                undefined,
                lastSuccessfulSyncAt,
            ),
        [commands, isOnline, isAuthenticated, lastSuccessfulSyncAt],
    );

    const panY = useMemo(() => new Animated.Value(0), []);

    useEffect(() => {
        if (visible) {
            panY.setValue(0);
        }
    }, [visible, panY]);

    const handleClose = useCallback(() => {
        setActiveFilter('all');
        setCommandToDiscard(null);
        onClose();
    }, [onClose]);

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
                            handleClose();
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
        [handleClose, panY],
    );

    const scrimOpacity = panY.interpolate({
        inputRange: [0, 250],
        outputRange: [isDarkHud ? 0.75 : 0.45, 0],
        extrapolate: 'clamp',
    });

    const filteredAttention =
        activeFilter === 'all' || activeFilter === 'attention'
            ? projection.sections.attention
            : [];
    const filteredActive =
        activeFilter === 'all' || activeFilter === 'waiting'
            ? projection.sections.active
            : [];
    const filteredCompleted =
        activeFilter === 'all' || activeFilter === 'completed'
            ? projection.sections.recentCompleted
            : [];
    const showTelemetry =
        (activeFilter === 'all' || activeFilter === 'waiting') &&
        projection.sections.telemetry !== null;

    const isEmptyView =
        filteredAttention.length === 0 &&
        filteredActive.length === 0 &&
        filteredCompleted.length === 0 &&
        !showTelemetry;

    const confirmDiscard = () => {
        if (commandToDiscard && onDiscardCommand) {
            onDiscardCommand(commandToDiscard.id);
            setCommandToDiscard(null);
        }
    };

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
                testID="outbox-status-sheet"
            >
                {/* Backdrop Scrim */}
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
                        accessibilityLabel="Close outbox sheet backdrop"
                        accessibilityRole="button"
                        onPress={handleClose}
                        style={StyleSheet.absoluteFill}
                        testID="outbox-sheet-dismiss"
                    />
                </Animated.View>

                {/* Main Sheet Container */}
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
                    {/* Drag Handle & Header */}
                    <View {...panResponder.panHandlers} style={styles.dragZone}>
                        <View
                            style={[
                                styles.handle,
                                isDarkHud && styles.darkHandle,
                            ]}
                        />
                        <View style={styles.sheetHeader}>
                            <View style={styles.titleRow}>
                                <View style={styles.headerIconContainer}>
                                    <Icon
                                        color={
                                            projection.counts.attention > 0
                                                ? '#F59E0B'
                                                : isDarkHud
                                                  ? '#FDE047'
                                                  : '#D97706'
                                        }
                                        name="sync"
                                        size={20}
                                    />
                                </View>
                                <View style={styles.headerTitles}>
                                    <Text
                                        accessibilityRole="header"
                                        style={[
                                            styles.title,
                                            isDarkHud && styles.darkTitle,
                                        ]}
                                    >
                                        Outbox Synchronization
                                    </Text>
                                    <Text
                                        style={[
                                            styles.subtitle,
                                            isDarkHud && styles.darkSubtitle,
                                        ]}
                                    >
                                        {userName ? `${userName} · ` : ''}
                                        {userRole || 'Field Operator'}
                                    </Text>
                                </View>
                            </View>
                            <Pressable
                                accessibilityHint="Closes synchronization feedback sheet"
                                accessibilityLabel="Close outbox sheet"
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
                                testID="outbox-sheet-close-btn"
                            >
                                <Icon
                                    color={isDarkHud ? '#94A3B8' : '#64748B'}
                                    name="close"
                                    size={20}
                                />
                            </Pressable>
                        </View>
                    </View>

                    {/* Summary Card */}
                    <View
                        style={[
                            styles.overviewCard,
                            isDarkHud && styles.darkOverviewCard,
                            projection.counts.attention > 0 &&
                                (isDarkHud
                                    ? styles.darkOverviewCardAttention
                                    : styles.overviewCardAttention),
                        ]}
                        testID="outbox-overview-card"
                    >
                        <View style={styles.overviewHeaderRow}>
                            <View style={styles.connectionIndicatorRow}>
                                <View
                                    style={[
                                        styles.statusDot,
                                        isOnline === true && styles.dotOnline,
                                        isOnline === false && styles.dotOffline,
                                        isOnline === null && styles.dotChecking,
                                    ]}
                                />
                                <Text
                                    style={[
                                        styles.connectionText,
                                        isDarkHud && styles.darkConnectionText,
                                    ]}
                                >
                                    {isOnline === true
                                        ? 'Connected'
                                        : isOnline === false
                                          ? 'Device Offline'
                                          : 'Checking network'}
                                </Text>
                            </View>
                            {projection.isProcessing ? (
                                <View style={styles.syncingBadge}>
                                    <ActivityIndicator
                                        color={
                                            isDarkHud ? '#F59E0B' : '#D97706'
                                        }
                                        size="small"
                                    />
                                    <Text
                                        style={[
                                            styles.syncingBadgeText,
                                            isDarkHud &&
                                                styles.darkSyncingBadgeText,
                                        ]}
                                    >
                                        Syncing…
                                    </Text>
                                </View>
                            ) : null}
                        </View>

                        <Text
                            style={[
                                styles.guidanceText,
                                isDarkHud && styles.darkGuidanceText,
                            ]}
                            testID="outbox-sheet-guidance"
                        >
                            {projection.syncGuidance}
                        </Text>

                        {/* Counts Chips Row */}
                        <View style={styles.chipsRow}>
                            <View
                                style={[
                                    styles.summaryChip,
                                    isDarkHud && styles.darkSummaryChip,
                                    projection.counts.waiting > 0 &&
                                        styles.chipActiveWaiting,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.chipText,
                                        isDarkHud && styles.darkChipText,
                                        projection.counts.waiting > 0 &&
                                            styles.chipTextActiveWaiting,
                                    ]}
                                >
                                    Waiting: {projection.counts.waiting}
                                </Text>
                            </View>

                            <View
                                style={[
                                    styles.summaryChip,
                                    isDarkHud && styles.darkSummaryChip,
                                    projection.counts.submitting > 0 &&
                                        styles.chipActiveSyncing,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.chipText,
                                        isDarkHud && styles.darkChipText,
                                        projection.counts.submitting > 0 &&
                                            styles.chipTextActiveSyncing,
                                    ]}
                                >
                                    Syncing: {projection.counts.submitting}
                                </Text>
                            </View>

                            <View
                                style={[
                                    styles.summaryChip,
                                    isDarkHud && styles.darkSummaryChip,
                                    projection.counts.attention > 0 &&
                                        styles.chipActiveAttention,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.chipText,
                                        isDarkHud && styles.darkChipText,
                                        projection.counts.attention > 0 &&
                                            styles.chipTextActiveAttention,
                                    ]}
                                >
                                    Needs Attention:{' '}
                                    {projection.counts.attention}
                                </Text>
                            </View>

                            <View
                                style={[
                                    styles.summaryChip,
                                    isDarkHud && styles.darkSummaryChip,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.chipText,
                                        isDarkHud && styles.darkChipText,
                                    ]}
                                >
                                    Synced: {projection.counts.completed}
                                </Text>
                            </View>
                        </View>

                        {/* Sync Now / Retry Action Button */}
                        {onSyncNow &&
                        isOnline === true &&
                        (projection.canSyncNow || projection.isProcessing) ? (
                            <Pressable
                                accessibilityHint="Attempts immediate synchronization of queued and eligible actions"
                                accessibilityLabel="Sync outbox now"
                                accessibilityRole="button"
                                disabled={projection.isProcessing}
                                onPress={onSyncNow}
                                style={({ pressed }) => [
                                    styles.syncNowBtn,
                                    isDarkHud && styles.darkSyncNowBtn,
                                    projection.isProcessing &&
                                        styles.syncNowBtnDisabled,
                                    pressed && styles.pressed,
                                ]}
                                testID="sheet-sync-now-btn"
                            >
                                <Icon
                                    color={isDarkHud ? '#1E293B' : '#FFFFFF'}
                                    name="sync"
                                    size={16}
                                />
                                <Text
                                    style={[
                                        styles.syncNowBtnText,
                                        isDarkHud && styles.darkSyncNowBtnText,
                                    ]}
                                >
                                    {projection.isProcessing
                                        ? 'Syncing Actions…'
                                        : projection.counts.attention > 0 &&
                                            projection.sections.attention.some(
                                                (i) => i.retryable,
                                            )
                                          ? 'Sync & Retry Eligible'
                                          : `Sync Now (${projection.counts.waiting})`}
                                </Text>
                            </Pressable>
                        ) : null}
                    </View>

                    {/* Filter Segment Tabs */}
                    <View style={styles.filterTabsRow}>
                        <Pressable
                            accessibilityLabel={`All items: ${projection.counts.totalActive + projection.counts.completed}`}
                            accessibilityRole="button"
                            accessibilityState={{
                                selected: activeFilter === 'all',
                            }}
                            onPress={() => setActiveFilter('all')}
                            style={[
                                styles.filterTab,
                                isDarkHud && styles.darkFilterTab,
                                activeFilter === 'all' &&
                                    (isDarkHud
                                        ? styles.darkFilterTabActive
                                        : styles.filterTabActive),
                            ]}
                            testID="outbox-filter-all"
                        >
                            <Text
                                style={[
                                    styles.filterTabText,
                                    isDarkHud && styles.darkFilterTabText,
                                    activeFilter === 'all' &&
                                        (isDarkHud
                                            ? styles.darkFilterTabTextActive
                                            : styles.filterTabTextActive),
                                ]}
                            >
                                All (
                                {projection.counts.totalActive +
                                    projection.counts.completed}
                                )
                            </Text>
                        </Pressable>

                        <Pressable
                            accessibilityLabel={`Needs attention: ${projection.counts.attention}`}
                            accessibilityRole="button"
                            accessibilityState={{
                                selected: activeFilter === 'attention',
                            }}
                            onPress={() => setActiveFilter('attention')}
                            style={[
                                styles.filterTab,
                                isDarkHud && styles.darkFilterTab,
                                activeFilter === 'attention' &&
                                    (isDarkHud
                                        ? styles.darkFilterTabActive
                                        : styles.filterTabActive),
                            ]}
                            testID="outbox-filter-attention"
                        >
                            <Text
                                style={[
                                    styles.filterTabText,
                                    isDarkHud && styles.darkFilterTabText,
                                    activeFilter === 'attention' &&
                                        (isDarkHud
                                            ? styles.darkFilterTabTextActive
                                            : styles.filterTabTextActive),
                                ]}
                            >
                                Attention ({projection.counts.attention})
                            </Text>
                        </Pressable>

                        <Pressable
                            accessibilityLabel={`Waiting to send: ${projection.counts.waiting + projection.counts.submitting}`}
                            accessibilityRole="button"
                            accessibilityState={{
                                selected: activeFilter === 'waiting',
                            }}
                            onPress={() => setActiveFilter('waiting')}
                            style={[
                                styles.filterTab,
                                isDarkHud && styles.darkFilterTab,
                                activeFilter === 'waiting' &&
                                    (isDarkHud
                                        ? styles.darkFilterTabActive
                                        : styles.filterTabActive),
                            ]}
                            testID="outbox-filter-waiting"
                        >
                            <Text
                                style={[
                                    styles.filterTabText,
                                    isDarkHud && styles.darkFilterTabText,
                                    activeFilter === 'waiting' &&
                                        (isDarkHud
                                            ? styles.darkFilterTabTextActive
                                            : styles.filterTabTextActive),
                                ]}
                            >
                                Queued (
                                {projection.counts.waiting +
                                    projection.counts.submitting}
                                )
                            </Text>
                        </Pressable>

                        <Pressable
                            accessibilityLabel={`Recently synced: ${projection.counts.completed}`}
                            accessibilityRole="button"
                            accessibilityState={{
                                selected: activeFilter === 'completed',
                            }}
                            onPress={() => setActiveFilter('completed')}
                            style={[
                                styles.filterTab,
                                isDarkHud && styles.darkFilterTab,
                                activeFilter === 'completed' &&
                                    (isDarkHud
                                        ? styles.darkFilterTabActive
                                        : styles.filterTabActive),
                            ]}
                            testID="outbox-filter-completed"
                        >
                            <Text
                                style={[
                                    styles.filterTabText,
                                    isDarkHud && styles.darkFilterTabText,
                                    activeFilter === 'completed' &&
                                        (isDarkHud
                                            ? styles.darkFilterTabTextActive
                                            : styles.filterTabTextActive),
                                ]}
                            >
                                Synced ({projection.counts.completed})
                            </Text>
                        </Pressable>
                    </View>

                    {/* Scrollable Itemized List */}
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        style={styles.scrollView}
                        testID="outbox-items-list"
                    >
                        {isEmptyView ? (
                            <View
                                style={styles.emptyState}
                                testID="outbox-empty-state"
                            >
                                <View
                                    style={[
                                        styles.emptyIconCircle,
                                        isDarkHud && styles.darkEmptyIconCircle,
                                    ]}
                                >
                                    <Icon
                                        color={
                                            isDarkHud ? '#34D399' : '#059669'
                                        }
                                        name="check-circle"
                                        size={32}
                                    />
                                </View>
                                <Text
                                    style={[
                                        styles.emptyTitle,
                                        isDarkHud && styles.darkEmptyTitle,
                                    ]}
                                >
                                    {projection.counts.totalActive === 0
                                        ? 'Outbox is clear'
                                        : activeFilter === 'attention'
                                          ? 'No actions require attention'
                                          : activeFilter === 'waiting'
                                            ? 'No actions waiting to sync'
                                            : 'No recent synchronization history'}
                                </Text>
                                <Text
                                    style={[
                                        styles.emptySubtitle,
                                        isDarkHud && styles.darkEmptySubtitle,
                                    ]}
                                >
                                    {projection.counts.totalActive === 0
                                        ? 'All completed inspections, handovers, and field actions are synchronized with dispatch.'
                                        : activeFilter === 'attention'
                                          ? 'All queued actions are healthy or syncing normally.'
                                          : activeFilter === 'waiting'
                                            ? 'There are no pending actions queued locally.'
                                            : 'Synchronized actions will appear here after upload.'}
                                </Text>
                            </View>
                        ) : null}

                        {/* Attention Section */}
                        {filteredAttention.length > 0 ? (
                            <View
                                style={styles.sectionContainer}
                                testID="outbox-section-attention"
                            >
                                <Text
                                    style={[
                                        styles.sectionHeader,
                                        isDarkHud && styles.darkSectionHeader,
                                        styles.sectionHeaderAttention,
                                    ]}
                                >
                                    ACTIONS REQUIRING ATTENTION
                                </Text>

                                {filteredAttention.map((item) => (
                                    <OutboxItemCard
                                        isDarkHud={isDarkHud}
                                        item={item}
                                        key={item.id}
                                        onAcceptServerState={
                                            onAcceptServerState
                                        }
                                        onPromptDiscard={() =>
                                            setCommandToDiscard(item)
                                        }
                                        onRecaptureAttachment={
                                            onRecaptureAttachment
                                        }
                                        onRetryCommand={onRetryCommand}
                                        onRetryNewVersion={onRetryNewVersion}
                                        onSignIn={onSignIn}
                                    />
                                ))}
                            </View>
                        ) : null}

                        {/* Queued / In-flight Section */}
                        {filteredActive.length > 0 ? (
                            <View
                                style={styles.sectionContainer}
                                testID="outbox-section-active"
                            >
                                <Text
                                    style={[
                                        styles.sectionHeader,
                                        isDarkHud && styles.darkSectionHeader,
                                    ]}
                                >
                                    WAITING TO SYNC & SUBMITTING
                                </Text>

                                {filteredActive.map((item) => (
                                    <OutboxItemCard
                                        isDarkHud={isDarkHud}
                                        item={item}
                                        key={item.id}
                                        onAcceptServerState={
                                            onAcceptServerState
                                        }
                                        onPromptDiscard={() =>
                                            setCommandToDiscard(item)
                                        }
                                        onRecaptureAttachment={
                                            onRecaptureAttachment
                                        }
                                        onRetryCommand={onRetryCommand}
                                        onRetryNewVersion={onRetryNewVersion}
                                        onSignIn={onSignIn}
                                    />
                                ))}
                            </View>
                        ) : null}

                        {/* Grouped Telemetry Summary */}
                        {showTelemetry && projection.sections.telemetry ? (
                            <View
                                style={[
                                    styles.telemetryCard,
                                    isDarkHud && styles.darkTelemetryCard,
                                ]}
                                testID="outbox-telemetry-card"
                            >
                                <View style={styles.telemetryHeaderRow}>
                                    <View style={styles.telemetryLeftRow}>
                                        <View
                                            style={[
                                                styles.telemetryIconSquircle,
                                                isDarkHud &&
                                                    styles.darkTelemetryIconSquircle,
                                            ]}
                                        >
                                            <Icon
                                                color={
                                                    isDarkHud
                                                        ? '#60A5FA'
                                                        : '#2563EB'
                                                }
                                                name="location"
                                                size={18}
                                            />
                                        </View>
                                        <View>
                                            <Text
                                                style={[
                                                    styles.telemetryTitle,
                                                    isDarkHud &&
                                                        styles.darkTelemetryTitle,
                                                ]}
                                            >
                                                Background GPS Telemetry
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.telemetrySubtitle,
                                                    isDarkHud &&
                                                        styles.darkTelemetrySubtitle,
                                                ]}
                                            >
                                                {
                                                    projection.sections
                                                        .telemetry.count
                                                }{' '}
                                                coordinate ping
                                                {projection.sections.telemetry
                                                    .count === 1
                                                    ? ''
                                                    : 's'}{' '}
                                                queued
                                            </Text>
                                        </View>
                                    </View>
                                    <View
                                        style={[
                                            styles.telemetryBadge,
                                            isDarkHud &&
                                                styles.darkTelemetryBadge,
                                        ]}
                                    >
                                        <Text style={styles.telemetryBadgeText}>
                                            Auto-Batched
                                        </Text>
                                    </View>
                                </View>
                                <Text
                                    style={[
                                        styles.telemetryInfoText,
                                        isDarkHud &&
                                            styles.darkTelemetryInfoText,
                                    ]}
                                >
                                    Location coordinates are compressed and
                                    streamed in background batches of up to 100
                                    records when connectivity is available.
                                </Text>
                            </View>
                        ) : null}

                        {/* Recently Synchronized Section */}
                        {filteredCompleted.length > 0 ? (
                            <View
                                style={styles.sectionContainer}
                                testID="outbox-section-completed"
                            >
                                <Text
                                    style={[
                                        styles.sectionHeader,
                                        isDarkHud && styles.darkSectionHeader,
                                    ]}
                                >
                                    RECENTLY SYNCHRONIZED
                                </Text>

                                {filteredCompleted.map((item) => (
                                    <OutboxItemCard
                                        isDarkHud={isDarkHud}
                                        item={item}
                                        key={item.id}
                                        onAcceptServerState={
                                            onAcceptServerState
                                        }
                                        onPromptDiscard={() =>
                                            setCommandToDiscard(item)
                                        }
                                        onRecaptureAttachment={
                                            onRecaptureAttachment
                                        }
                                        onRetryCommand={onRetryCommand}
                                        onRetryNewVersion={onRetryNewVersion}
                                        onSignIn={onSignIn}
                                    />
                                ))}
                            </View>
                        ) : null}
                    </ScrollView>
                </Animated.View>

                {/* Safe Discard Confirmation Dialog */}
                {commandToDiscard ? (
                    <View
                        style={[StyleSheet.absoluteFill, styles.dialogBackdrop]}
                        testID="discard-confirm-dialog"
                    >
                        <View
                            style={[
                                styles.dialogCard,
                                isDarkHud && styles.darkDialogCard,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.dialogTitle,
                                    isDarkHud && styles.darkDialogTitle,
                                ]}
                            >
                                Discard Unsynced Action?
                            </Text>
                            <Text
                                style={[
                                    styles.dialogMessage,
                                    isDarkHud && styles.darkDialogMessage,
                                ]}
                            >
                                {commandToDiscard.isUncertainOutcome
                                    ? `⚠️ Server outcome uncertain: this action was sent, but the connection timed out before a response was received. If central dispatch already processed this action, discarding it here will not undo it.\n\nAre you sure you want to permanently discard "${commandToDiscard.title}"?`
                                    : `Are you sure you want to permanently discard "${commandToDiscard.title}"? Unsaved data on this phone will be lost and cannot be recovered.`}
                            </Text>
                            <View style={styles.dialogActions}>
                                <Pressable
                                    accessibilityLabel="Cancel discard"
                                    accessibilityRole="button"
                                    onPress={() => setCommandToDiscard(null)}
                                    style={({ pressed }) => [
                                        styles.dialogCancelBtn,
                                        isDarkHud && styles.darkDialogCancelBtn,
                                        pressed && styles.pressed,
                                    ]}
                                    testID="cancel-discard-btn"
                                >
                                    <Text
                                        style={[
                                            styles.dialogCancelText,
                                            isDarkHud &&
                                                styles.darkDialogCancelText,
                                        ]}
                                    >
                                        Keep Action
                                    </Text>
                                </Pressable>
                                <Pressable
                                    accessibilityLabel="Confirm discard"
                                    accessibilityRole="button"
                                    onPress={confirmDiscard}
                                    style={({ pressed }) => [
                                        styles.dialogConfirmBtn,
                                        pressed && styles.pressed,
                                    ]}
                                    testID="confirm-discard-btn"
                                >
                                    <Text style={styles.dialogConfirmText}>
                                        Discard
                                    </Text>
                                </Pressable>
                            </View>
                        </View>
                    </View>
                ) : null}
            </View>
        </Modal>
    );
};

// Itemized Card Component for individual command presentation
interface OutboxItemCardProps {
    item: OutboxItemDisplay;
    isDarkHud: boolean;
    onRetryCommand?: (commandId: string) => void;
    onPromptDiscard: () => void;
    onAcceptServerState?: (commandId: string) => void;
    onRetryNewVersion?: (commandId: string, newVersion: number) => void;
    onSignIn?: () => void;
    onRecaptureAttachment?: (commandId: string, oldUri: string) => void;
}

const OutboxItemCard: React.FC<OutboxItemCardProps> = ({
    item,
    isDarkHud,
    onRetryCommand,
    onPromptDiscard,
    onAcceptServerState,
    onRetryNewVersion,
    onSignIn,
    onRecaptureAttachment,
}) => {
    const isUnresolved = item.state === 'unresolved';
    const isFailed = item.state === 'failed' || isUnresolved;
    const isConflict = item.isConflict;
    const isSyncing = item.state === 'syncing';
    const isCompleted = item.state === 'completed';
    const isExpired = item.state === 'expired';

    return (
        <View
            accessibilityRole="alert"
            style={[
                styles.itemCard,
                isDarkHud && styles.darkItemCard,
                (isFailed || isConflict || isExpired) &&
                    styles.itemCardAttention,
                isDarkHud &&
                    (isFailed || isConflict || isExpired) &&
                    styles.darkItemCardAttention,
                isCompleted && styles.itemCardCompleted,
                isDarkHud && isCompleted && styles.darkItemCardCompleted,
            ]}
            testID={`outbox-item-${item.id}`}
        >
            {/* Header: Title, Reference, Status Badge */}
            <View style={styles.itemHeaderRow}>
                <View style={styles.itemTitleBlock}>
                    <Text
                        style={[
                            styles.itemTitle,
                            isDarkHud && styles.darkItemTitle,
                        ]}
                    >
                        {item.title}
                    </Text>
                    <Text
                        style={[
                            styles.itemReference,
                            isDarkHud && styles.darkItemReference,
                        ]}
                    >
                        {item.reference}
                        {item.attachmentCount > 0
                            ? ` · ${item.attachmentCount} photo${item.attachmentCount === 1 ? '' : 's'}`
                            : ''}
                    </Text>
                </View>

                <View
                    style={[
                        styles.itemStateBadge,
                        isSyncing && styles.badgeSyncing,
                        (isFailed || isExpired) && styles.badgeFailed,
                        isConflict && styles.badgeConflict,
                        isCompleted && styles.badgeCompleted,
                    ]}
                >
                    {isSyncing ? (
                        <ActivityIndicator
                            color={isDarkHud ? '#F59E0B' : '#D97706'}
                            size="small"
                        />
                    ) : null}
                    <Text
                        style={[
                            styles.itemStateBadgeText,
                            isSyncing && styles.badgeTextSyncing,
                            (isFailed || isExpired) && styles.badgeTextFailed,
                            isConflict && styles.badgeTextConflict,
                            isCompleted && styles.badgeTextCompleted,
                        ]}
                    >
                        {item.stateLabel}
                    </Text>
                </View>
            </View>

            {/* Explanation / Progress Details */}
            {item.explanation ? (
                <Text
                    style={[
                        styles.itemExplanation,
                        isDarkHud && styles.darkItemExplanation,
                        (isFailed || isConflict || isExpired) &&
                            (isDarkHud
                                ? styles.darkExplanationAttention
                                : styles.explanationAttention),
                    ]}
                >
                    {item.explanation}
                </Text>
            ) : null}

            {/* Server Conflict Snapshot & Cancellation/Completion Warning */}
            {isConflict && item.serverReference && item.serverStatusLabel ? (
                <Text
                    style={[
                        styles.serverStateNotice,
                        isDarkHud && styles.darkServerStateNotice,
                    ]}
                    testID={`server-state-${item.id}`}
                >
                    Server state: {item.serverReference} —{' '}
                    {item.serverStatusLabel}
                </Text>
            ) : null}
            {isConflict && item.isCancelledOnServer ? (
                <Text
                    style={[
                        styles.serverCancelledNotice,
                        isDarkHud && styles.darkServerCancelledNotice,
                    ]}
                    testID={`server-cancelled-notice-${item.id}`}
                >
                    Job was cancelled on the server. This action cannot be
                    retried.
                </Text>
            ) : null}
            {isConflict && item.isCompletedOnServer ? (
                <Text
                    style={[
                        styles.serverCancelledNotice,
                        isDarkHud && styles.darkServerCancelledNotice,
                    ]}
                    testID={`server-completed-notice-${item.id}`}
                >
                    Job was completed on the server. This action cannot be
                    retried.
                </Text>
            ) : null}

            {/* Missing Attachment Notice */}
            {item.isMissingAttachments && item.missingAttachmentUri ? (
                <View
                    style={[
                        styles.missingAttachmentNotice,
                        isDarkHud && styles.darkMissingAttachmentNotice,
                    ]}
                    testID={`missing-attachment-notice-${item.id}`}
                >
                    <Icon
                        color={isDarkHud ? '#F87171' : '#DC2626'}
                        name="camera"
                        size={14}
                    />
                    <Text
                        numberOfLines={1}
                        style={[
                            styles.missingAttachmentText,
                            isDarkHud && styles.darkMissingAttachmentText,
                        ]}
                    >
                        Missing file: {item.missingAttachmentUri}
                    </Text>
                </View>
            ) : null}

            {/* Uncertain Server Outcome Callout */}
            {item.isUncertainOutcome ? (
                <View
                    style={[
                        styles.uncertainBanner,
                        isDarkHud && styles.darkUncertainBanner,
                    ]}
                    testID={`uncertain-outcome-banner-${item.id}`}
                >
                    <Icon
                        color={isDarkHud ? '#FBBF24' : '#D97706'}
                        name="alert"
                        size={14}
                    />
                    <Text
                        style={[
                            styles.uncertainBannerText,
                            isDarkHud && styles.darkUncertainBannerText,
                        ]}
                    >
                        {isUnresolved
                            ? 'Server outcome unresolved: reconcile the original command before changing or discarding its evidence.'
                            : 'Server outcome uncertain: timed out before central acknowledgement.'}
                    </Text>
                </View>
            ) : null}

            {/* Discard Blocked Reason */}
            {!item.canDiscard &&
            item.discardBlockReason &&
            (isFailed || isConflict || isExpired) ? (
                <View
                    style={[
                        styles.discardBlockNotice,
                        isDarkHud && styles.darkDiscardBlockNotice,
                    ]}
                    testID={`discard-blocked-notice-${item.id}`}
                >
                    <Icon
                        color={isDarkHud ? '#94A3B8' : '#64748B'}
                        name="shield"
                        size={12}
                    />
                    <Text
                        style={[
                            styles.discardBlockText,
                            isDarkHud && styles.darkDiscardBlockText,
                        ]}
                    >
                        {item.discardBlockReason}
                    </Text>
                </View>
            ) : null}

            {/* Stage Progress if in-flight syncing */}
            {isSyncing && item.stage ? (
                <View
                    style={[
                        styles.stageProgressBar,
                        isDarkHud && styles.darkStageProgressBar,
                    ]}
                >
                    <View style={styles.stageDotActive} />
                    <Text
                        style={[
                            styles.stageText,
                            isDarkHud && styles.darkStageText,
                        ]}
                    >
                        {item.stage}
                    </Text>
                </View>
            ) : null}

            {/* Metadata Footer: Timestamps, attempts */}
            <View style={styles.itemMetaRow}>
                <Text
                    style={[styles.metaText, isDarkHud && styles.darkMetaText]}
                >
                    Created: {item.formattedCreatedAt}
                </Text>
                {item.attempts > 0 ? (
                    <Text
                        style={[
                            styles.metaText,
                            isDarkHud && styles.darkMetaText,
                        ]}
                    >
                        Attempts: {item.attempts}
                    </Text>
                ) : null}
                {item.completedAt ? (
                    <Text
                        style={[
                            styles.metaText,
                            isDarkHud && styles.darkMetaText,
                        ]}
                    >
                        Synced: {item.formattedCompletedAt}
                    </Text>
                ) : null}
            </View>

            {/* Safe Action Buttons */}
            {(item.retryable ||
                item.canDiscard ||
                isConflict ||
                item.isAuthenticationRequired) &&
            !isSyncing &&
            !isCompleted ? (
                <View style={styles.itemActionsRow}>
                    {/* Retry Button */}
                    {item.retryable && onRetryCommand ? (
                        <Pressable
                            accessibilityLabel={`Retry ${item.title}`}
                            accessibilityRole="button"
                            onPress={() => onRetryCommand(item.id)}
                            style={({ pressed }) => [
                                styles.actionBtn,
                                styles.retryActionBtn,
                                pressed && styles.pressed,
                            ]}
                            testID={`outbox-retry-${item.id}`}
                        >
                            <Icon color="#FFFFFF" name="sync" size={14} />
                            <Text style={styles.actionBtnText}>Retry</Text>
                        </Pressable>
                    ) : null}

                    {/* Conflict Resolution Buttons */}
                    {isConflict ? (
                        <>
                            {onAcceptServerState ? (
                                <Pressable
                                    accessibilityLabel="Accept server state"
                                    accessibilityRole="button"
                                    onPress={() => onAcceptServerState(item.id)}
                                    style={({ pressed }) => [
                                        styles.actionBtn,
                                        styles.acceptServerActionBtn,
                                        pressed && styles.pressed,
                                    ]}
                                    testID={`outbox-accept-server-${item.id}`}
                                >
                                    <Text style={styles.actionBtnText}>
                                        Accept Server
                                    </Text>
                                </Pressable>
                            ) : null}

                            {onRetryNewVersion &&
                            item.canRetryWithVersion &&
                            item.currentVersion ? (
                                <Pressable
                                    accessibilityLabel="Retry with newer version"
                                    accessibilityRole="button"
                                    onPress={() =>
                                        onRetryNewVersion(
                                            item.id,
                                            item.currentVersion!,
                                        )
                                    }
                                    style={({ pressed }) => [
                                        styles.actionBtn,
                                        styles.retryVersionActionBtn,
                                        pressed && styles.pressed,
                                    ]}
                                    testID={`outbox-retry-version-${item.id}`}
                                >
                                    <Text style={styles.actionBtnText}>
                                        Retry v{item.currentVersion}
                                    </Text>
                                </Pressable>
                            ) : null}
                        </>
                    ) : null}

                    {/* Recapture Photo Action */}
                    {item.isMissingAttachments &&
                    !isUnresolved &&
                    item.missingAttachmentUri &&
                    onRecaptureAttachment ? (
                        <Pressable
                            accessibilityLabel="Recapture missing photo"
                            accessibilityRole="button"
                            onPress={() =>
                                onRecaptureAttachment(
                                    item.id,
                                    item.missingAttachmentUri!,
                                )
                            }
                            style={({ pressed }) => [
                                styles.actionBtn,
                                styles.recaptureActionBtn,
                                pressed && styles.pressed,
                            ]}
                            testID={`outbox-recapture-${item.id}`}
                        >
                            <Icon color="#FFFFFF" name="camera" size={14} />
                            <Text style={styles.actionBtnText}>
                                Recapture Photo
                            </Text>
                        </Pressable>
                    ) : null}

                    {/* Authentication Re-login Action */}
                    {item.isAuthenticationRequired && onSignIn ? (
                        <Pressable
                            accessibilityLabel="Sign in to re-authenticate"
                            accessibilityRole="button"
                            onPress={onSignIn}
                            style={({ pressed }) => [
                                styles.actionBtn,
                                styles.signInActionBtn,
                                pressed && styles.pressed,
                            ]}
                            testID={`outbox-signin-${item.id}`}
                        >
                            <Text style={styles.actionBtnText}>Sign In</Text>
                        </Pressable>
                    ) : null}

                    {/* Safe Discard Action */}
                    {item.canDiscard ? (
                        <Pressable
                            accessibilityLabel={`Discard ${item.title}`}
                            accessibilityRole="button"
                            onPress={onPromptDiscard}
                            style={({ pressed }) => [
                                styles.actionBtn,
                                styles.discardActionBtn,
                                isDarkHud && styles.darkDiscardActionBtn,
                                pressed && styles.pressed,
                            ]}
                            testID={`outbox-discard-${item.id}`}
                        >
                            <Text
                                style={[
                                    styles.discardActionBtnText,
                                    isDarkHud &&
                                        styles.darkDiscardActionBtnText,
                                ]}
                            >
                                Discard
                            </Text>
                        </Pressable>
                    ) : null}
                </View>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    modalRoot: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    scrim: {
        ...StyleSheet.absoluteFill,
    },
    sheet: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
        minHeight: '50%',
        overflow: 'hidden',
        ...shadows.lg,
    },
    darkSheet: {
        backgroundColor: '#0F172A',
        borderColor: '#1E293B',
        borderTopWidth: 1,
    },
    dragZone: {
        paddingHorizontal: 20,
        paddingTop: 12,
    },
    handle: {
        alignSelf: 'center',
        backgroundColor: '#CBD5E1',
        borderRadius: 3,
        height: 4,
        marginBottom: 12,
        width: 36,
    },
    darkHandle: {
        backgroundColor: '#334155',
    },
    sheetHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingBottom: 12,
    },
    titleRow: {
        alignItems: 'center',
        flexDirection: 'row',
        flex: 1,
        gap: 12,
    },
    headerIconContainer: {
        alignItems: 'center',
        backgroundColor: 'rgba(217, 119, 6, 0.1)',
        borderRadius: 12,
        height: 38,
        justifyContent: 'center',
        width: 38,
    },
    headerTitles: {
        flex: 1,
    },
    title: {
        color: colors.text,
        fontSize: 18,
        fontWeight: '700',
    },
    darkTitle: {
        color: '#F8FAFC',
    },
    subtitle: {
        color: colors.secondary,
        fontSize: 12,
        marginTop: 2,
    },
    darkSubtitle: {
        color: '#94A3B8',
    },
    closeButton: {
        alignItems: 'center',
        backgroundColor: colors.background,
        borderRadius: 20,
        height: 48,
        justifyContent: 'center',
        width: 48,
    },
    darkCloseButton: {
        backgroundColor: '#1E293B',
    },
    overviewCard: {
        backgroundColor: colors.background,
        borderColor: colors.border,
        borderRadius: 16,
        borderWidth: 1,
        marginHorizontal: 16,
        marginBottom: 12,
        padding: 14,
    },
    darkOverviewCard: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    overviewCardAttention: {
        backgroundColor: 'rgba(245, 158, 11, 0.06)',
        borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    darkOverviewCardAttention: {
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderColor: 'rgba(245, 158, 11, 0.4)',
    },
    overviewHeaderRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    connectionIndicatorRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6,
    },
    statusDot: {
        borderRadius: 4,
        height: 8,
        width: 8,
    },
    dotOnline: {
        backgroundColor: '#10B981',
    },
    dotOffline: {
        backgroundColor: '#F59E0B',
    },
    dotChecking: {
        backgroundColor: '#60A5FA',
    },
    connectionText: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '600',
    },
    darkConnectionText: {
        color: '#F1F5F9',
    },
    syncingBadge: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6,
    },
    syncingBadgeText: {
        color: colors.amberDark,
        fontSize: 12,
        fontWeight: '600',
    },
    darkSyncingBadgeText: {
        color: '#FBBF24',
    },
    guidanceText: {
        color: colors.secondary,
        fontSize: 13,
        lineHeight: 18,
        marginBottom: 12,
    },
    darkGuidanceText: {
        color: '#CBD5E1',
    },
    chipsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 12,
    },
    summaryChip: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    darkSummaryChip: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
    },
    chipActiveWaiting: {
        borderColor: '#60A5FA',
    },
    chipActiveSyncing: {
        borderColor: colors.amberDark,
    },
    chipActiveAttention: {
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        borderColor: '#EF4444',
    },
    chipText: {
        color: colors.secondary,
        fontSize: 11,
        fontWeight: '500',
    },
    darkChipText: {
        color: '#94A3B8',
    },
    chipTextActiveWaiting: {
        color: '#2563EB',
        fontWeight: '600',
    },
    chipTextActiveSyncing: {
        color: colors.amberDark,
        fontWeight: '600',
    },
    chipTextActiveAttention: {
        color: '#EF4444',
        fontWeight: '700',
    },
    syncNowBtn: {
        alignItems: 'center',
        backgroundColor: colors.primary,
        borderRadius: 10,
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
        minHeight: 48,
        paddingHorizontal: 16,
    },
    darkSyncNowBtn: {
        backgroundColor: '#F59E0B',
    },
    syncNowBtnDisabled: {
        opacity: 0.5,
    },
    syncNowBtnText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
    darkSyncNowBtnText: {
        color: '#0F172A',
    },
    filterTabsRow: {
        flexDirection: 'row',
        marginHorizontal: 16,
        marginBottom: 10,
        gap: 6,
    },
    filterTab: {
        backgroundColor: colors.background,
        borderRadius: 8,
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
    },
    darkFilterTab: {
        backgroundColor: '#1E293B',
    },
    filterTabActive: {
        backgroundColor: colors.surface,
        borderColor: colors.primary,
        borderWidth: 1,
    },
    darkFilterTabActive: {
        backgroundColor: '#334155',
        borderColor: '#F59E0B',
        borderWidth: 1,
    },
    filterTabText: {
        color: colors.secondary,
        fontSize: 11,
        fontWeight: '600',
    },
    darkFilterTabText: {
        color: '#94A3B8',
    },
    filterTabTextActive: {
        color: colors.primary,
        fontWeight: '700',
    },
    darkFilterTabTextActive: {
        color: '#F8FAFC',
        fontWeight: '700',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 20,
    },
    sectionContainer: {
        marginBottom: 16,
    },
    sectionHeader: {
        color: colors.secondary,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.6,
        marginBottom: 8,
        marginTop: 4,
    },
    darkSectionHeader: {
        color: '#94A3B8',
    },
    sectionHeaderAttention: {
        color: '#D97706',
    },
    itemCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 10,
        padding: 12,
        ...shadows.sm,
    },
    darkItemCard: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    itemCardAttention: {
        borderColor: 'rgba(239, 68, 68, 0.4)',
        backgroundColor: 'rgba(254, 242, 242, 0.5)',
    },
    darkItemCardAttention: {
        borderColor: 'rgba(239, 68, 68, 0.5)',
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
    },
    itemCardCompleted: {
        borderColor: 'rgba(16, 185, 129, 0.3)',
        backgroundColor: 'rgba(236, 253, 245, 0.3)',
    },
    darkItemCardCompleted: {
        borderColor: 'rgba(16, 185, 129, 0.3)',
        backgroundColor: 'rgba(16, 185, 129, 0.06)',
    },
    itemHeaderRow: {
        alignItems: 'flex-start',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    itemTitleBlock: {
        flex: 1,
        marginRight: 8,
    },
    itemTitle: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '700',
    },
    darkItemTitle: {
        color: '#F8FAFC',
    },
    itemReference: {
        color: colors.secondary,
        fontSize: 12,
        marginTop: 2,
    },
    darkItemReference: {
        color: '#94A3B8',
    },
    itemStateBadge: {
        alignItems: 'center',
        backgroundColor: colors.background,
        borderRadius: 6,
        flexDirection: 'row',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    badgeSyncing: {
        backgroundColor: 'rgba(217, 119, 6, 0.12)',
    },
    badgeFailed: {
        backgroundColor: 'rgba(239, 68, 68, 0.12)',
    },
    badgeConflict: {
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
    },
    badgeCompleted: {
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
    },
    itemStateBadgeText: {
        color: colors.secondary,
        fontSize: 11,
        fontWeight: '600',
    },
    badgeTextSyncing: {
        color: colors.amberDark,
    },
    badgeTextFailed: {
        color: '#DC2626',
    },
    badgeTextConflict: {
        color: '#D97706',
    },
    badgeTextCompleted: {
        color: '#059669',
    },
    itemExplanation: {
        color: colors.secondary,
        fontSize: 12,
        lineHeight: 17,
        marginBottom: 8,
    },
    darkItemExplanation: {
        color: '#CBD5E1',
    },
    explanationAttention: {
        color: '#B91C1C',
    },
    darkExplanationAttention: {
        color: '#FCA5A5',
    },
    stageProgressBar: {
        alignItems: 'center',
        backgroundColor: 'rgba(217, 119, 6, 0.08)',
        borderRadius: 6,
        flexDirection: 'row',
        gap: 8,
        marginBottom: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    darkStageProgressBar: {
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
    },
    stageDotActive: {
        backgroundColor: '#D97706',
        borderRadius: 4,
        height: 6,
        width: 6,
    },
    stageText: {
        color: colors.amberDark,
        fontSize: 12,
        fontWeight: '600',
    },
    darkStageText: {
        color: '#FBBF24',
    },
    itemMetaRow: {
        alignItems: 'center',
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginTop: 2,
    },
    metaText: {
        color: colors.muted,
        fontSize: 11,
    },
    darkMetaText: {
        color: '#64748B',
    },
    itemActionsRow: {
        borderTopColor: colors.border,
        borderTopWidth: StyleSheet.hairlineWidth,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 10,
        paddingTop: 10,
    },
    actionBtn: {
        alignItems: 'center',
        borderRadius: 8,
        flexDirection: 'row',
        gap: 6,
        justifyContent: 'center',
        minHeight: 48,
        paddingHorizontal: 14,
    },
    retryActionBtn: {
        backgroundColor: colors.primary,
        flex: 1,
    },
    acceptServerActionBtn: {
        backgroundColor: '#2563EB',
        flex: 1,
    },
    retryVersionActionBtn: {
        backgroundColor: colors.primary,
        flex: 1,
    },
    signInActionBtn: {
        backgroundColor: colors.primary,
        flex: 1,
    },
    discardActionBtn: {
        backgroundColor: 'transparent',
        borderColor: '#EF4444',
        borderWidth: 1,
        paddingHorizontal: 12,
    },
    darkDiscardActionBtn: {
        borderColor: '#F87171',
    },
    recaptureActionBtn: {
        backgroundColor: '#D97706',
        flex: 1,
    },
    serverStateNotice: {
        color: '#2563EB',
        fontSize: 12,
        fontWeight: '500',
        marginTop: 4,
    },
    darkServerStateNotice: {
        color: '#60A5FA',
    },
    serverCancelledNotice: {
        color: '#DC2626',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 4,
    },
    darkServerCancelledNotice: {
        color: '#F87171',
    },
    missingAttachmentNotice: {
        alignItems: 'center',
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        borderColor: 'rgba(239, 68, 68, 0.25)',
        borderRadius: 8,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 6,
        marginTop: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    darkMissingAttachmentNotice: {
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        borderColor: 'rgba(239, 68, 68, 0.4)',
    },
    missingAttachmentText: {
        color: '#DC2626',
        fontSize: 12,
        fontWeight: '500',
        flex: 1,
    },
    darkMissingAttachmentText: {
        color: '#F87171',
    },
    actionBtnText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '700',
    },
    discardActionBtnText: {
        color: '#EF4444',
        fontSize: 13,
        fontWeight: '600',
    },
    darkDiscardActionBtnText: {
        color: '#F87171',
    },
    telemetryCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 16,
        padding: 14,
    },
    darkTelemetryCard: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    telemetryHeaderRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    telemetryLeftRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 10,
    },
    telemetryIconSquircle: {
        alignItems: 'center',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        borderRadius: 8,
        height: 32,
        justifyContent: 'center',
        width: 32,
    },
    darkTelemetryIconSquircle: {
        backgroundColor: 'rgba(37, 99, 235, 0.2)',
    },
    telemetryTitle: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '700',
    },
    darkTelemetryTitle: {
        color: '#F8FAFC',
    },
    telemetrySubtitle: {
        color: colors.secondary,
        fontSize: 12,
    },
    darkTelemetrySubtitle: {
        color: '#94A3B8',
    },
    telemetryBadge: {
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    darkTelemetryBadge: {
        backgroundColor: 'rgba(37, 99, 235, 0.2)',
    },
    telemetryBadgeText: {
        color: '#2563EB',
        fontSize: 11,
        fontWeight: '600',
    },
    telemetryInfoText: {
        color: colors.secondary,
        fontSize: 12,
        lineHeight: 17,
    },
    darkTelemetryInfoText: {
        color: '#CBD5E1',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 40,
        paddingHorizontal: 20,
    },
    emptyIconCircle: {
        alignItems: 'center',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderRadius: 32,
        height: 64,
        justifyContent: 'center',
        marginBottom: 16,
        width: 64,
    },
    darkEmptyIconCircle: {
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
    },
    emptyTitle: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 6,
    },
    darkEmptyTitle: {
        color: '#F8FAFC',
    },
    emptySubtitle: {
        color: colors.secondary,
        fontSize: 13,
        lineHeight: 19,
        textAlign: 'center',
    },
    darkEmptySubtitle: {
        color: '#94A3B8',
    },
    dialogBackdrop: {
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        flex: 1,
        justifyContent: 'center',
        padding: 24,
    },
    dialogCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 20,
        width: '100%',
        maxWidth: 380,
        ...shadows.lg,
    },
    darkDialogCard: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
        borderWidth: 1,
    },
    dialogTitle: {
        color: colors.text,
        fontSize: 17,
        fontWeight: '700',
        marginBottom: 8,
    },
    darkDialogTitle: {
        color: '#F8FAFC',
    },
    dialogMessage: {
        color: colors.secondary,
        fontSize: 13,
        lineHeight: 19,
        marginBottom: 20,
    },
    darkDialogMessage: {
        color: '#CBD5E1',
    },
    dialogActions: {
        flexDirection: 'row',
        gap: 10,
        justifyContent: 'flex-end',
    },
    dialogCancelBtn: {
        alignItems: 'center',
        backgroundColor: colors.background,
        borderRadius: 8,
        justifyContent: 'center',
        minHeight: 48,
        paddingHorizontal: 16,
    },
    darkDialogCancelBtn: {
        backgroundColor: '#334155',
    },
    dialogCancelText: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '600',
    },
    darkDialogCancelText: {
        color: '#F1F5F9',
    },
    dialogConfirmBtn: {
        alignItems: 'center',
        backgroundColor: '#EF4444',
        borderRadius: 8,
        justifyContent: 'center',
        minHeight: 48,
        paddingHorizontal: 16,
    },
    dialogConfirmText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '700',
    },
    pressed: {
        opacity: 0.75,
    },
    uncertainBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#FEF3C7',
        borderColor: '#FDE68A',
        borderWidth: 1,
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 5,
        marginBottom: 8,
    },
    darkUncertainBanner: {
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    uncertainBannerText: {
        color: '#B45309',
        fontSize: 12,
        fontWeight: '600',
        flex: 1,
    },
    darkUncertainBannerText: {
        color: '#FDE047',
    },
    discardBlockNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#F1F5F9',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
        marginBottom: 8,
    },
    darkDiscardBlockNotice: {
        backgroundColor: '#1E293B',
    },
    discardBlockText: {
        color: '#64748B',
        fontSize: 12,
        fontWeight: '500',
        flex: 1,
    },
    darkDiscardBlockText: {
        color: '#94A3B8',
    },
});
