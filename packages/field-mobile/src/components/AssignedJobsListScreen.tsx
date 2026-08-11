import React, { useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';
import type { DispatchJob, OutboxCommand } from '../types/index';
import { FieldBottomNav, type FieldNavItem } from './field-bottom-nav';
import { FieldHeader, type SyncTone } from './field-header';
import { PlannedRoutePanel } from './planned-route-panel';
import { NotificationsSheet } from './notifications-sheet';
import { ProfileSheet } from './profile-sheet';
import { SyncStatusPanel } from './sync-status-panel';
import { colors, sharedStyles } from './nativeStyles';

export interface AssignedJobsListScreenProps {
    jobs: DispatchJob[];
    outboxCommands: OutboxCommand[];
    isLoading: boolean;
    isOnline?: boolean | null;
    userName?: string | null;
    userRole?: string | null;
    error?: string | null;
    onRefresh: () => void;
    onSelectJob: (jobId: number) => void;
    onLogout?: () => void;
    onSyncNow?: () => void;
    onRetryCommand?: (commandId: string) => void;
    onDiscardCommand?: (commandId: string) => void;
}

export const AssignedJobsListScreen: React.FC<AssignedJobsListScreenProps> = ({
    jobs,
    outboxCommands,
    isLoading,
    isOnline = null,
    userName,
    userRole,
    error,
    onRefresh,
    onSelectJob,
    onLogout,
    onSyncNow,
    onRetryCommand,
    onDiscardCommand,
}) => {
    const [profileSheetOpen, setProfileSheetOpen] = useState(false);
    const [notificationsSheetOpen, setNotificationsSheetOpen] = useState(false);
    const [signOutConfirmationOpen, setSignOutConfirmationOpen] =
        useState(false);
    const [activeNavItem, setActiveNavItem] = useState<FieldNavItem>('today');
    const { width } = useWindowDimensions();
    const isCompact = width < 600;
    const queuedCount = outboxCommands.filter(
        (command) => command.state === 'queued',
    ).length;
    const syncingCount = outboxCommands.filter(
        (command) => command.state === 'syncing',
    ).length;
    const failedCount = outboxCommands.filter(
        (command) => command.state === 'failed',
    ).length;
    const conflictCount = outboxCommands.filter(
        (command) => command.state === 'conflict',
    ).length;
    const failedCommands = outboxCommands.filter(
        (command) => command.state === 'failed',
    );
    const pendingResponseCount = jobs.filter(
        (job) => job.my_assignment?.response_status === 'pending',
    ).length;
    const syncAttentionCount = failedCount + conflictCount;
    const hasOutboxActivity =
        syncAttentionCount > 0 || queuedCount > 0 || syncingCount > 0;
    const hasSyncAttention = isOnline === false || hasOutboxActivity;
    const syncDetailsExpanded = hasOutboxActivity;
    const syncGuidance =
        conflictCount > 0
            ? `${conflictCount} saved action${conflictCount === 1 ? '' : 's'} need conflict review.`
            : failedCount > 0
              ? `${failedCount} saved action${failedCount === 1 ? '' : 's'} failed. Retry before leaving the app.`
              : isOnline === false
                ? 'Commands stay on this device until the connection returns.'
                : queuedCount > 0
                  ? `${queuedCount} action${queuedCount === 1 ? '' : 's'} saved on this device and waiting to sync.`
                  : syncingCount > 0
                    ? 'Saved actions are syncing now.'
                    : 'Actions sync automatically when the connection is available.';
    const syncStatusLabel =
        isOnline === null
            ? 'Checking connection'
            : isOnline === false
              ? 'Offline'
              : syncAttentionCount > 0
                ? 'Needs review'
                : queuedCount > 0 || syncingCount > 0
                  ? 'Syncing'
                  : 'Synced';
    const syncStatusMessage =
        isOnline === null
            ? 'Checking…'
            : isOnline === true && !hasOutboxActivity
              ? 'Just now'
              : isOnline === false
                ? 'Reconnect to sync'
                : 'Action needed';
    const syncTone: SyncTone =
        isOnline === null
            ? 'checking'
            : isOnline === false
              ? 'offline'
              : syncAttentionCount > 0
                ? 'attention'
                : 'online';
    const workSummary =
        isLoading && jobs.length === 0
            ? 'Loading active assignments...'
            : jobs.length === 0
              ? 'No active assignments'
              : `${jobs.length} ${jobs.length === 1 ? 'active assignment' : 'active assignments'}${pendingResponseCount > 0 ? ` · ${pendingResponseCount} response${pendingResponseCount === 1 ? '' : 's'} needed` : ''}`;

    const handleOpenProfile = () => {
        setProfileSheetOpen(true);
        setSignOutConfirmationOpen(false);
        setActiveNavItem('profile');
    };
    const handleCloseProfile = (nextItem: FieldNavItem = 'today') => {
        setProfileSheetOpen(false);
        setSignOutConfirmationOpen(false);
        setActiveNavItem(nextItem);
    };
    const handleStartSignOut = () => setSignOutConfirmationOpen(true);
    const handleCancelSignOut = () => setSignOutConfirmationOpen(false);
    const handleLogout = () => {
        setProfileSheetOpen(false);
        setSignOutConfirmationOpen(false);
        onLogout?.();
    };
    const handleNavSelect = (item: FieldNavItem) => {
        if (item === 'profile') {
            handleOpenProfile();

            return;
        }

        handleCloseProfile(item);
    };
    return (
        <View style={styles.screenRoot} testID="field-mobile-screen">
            <ScrollView
                contentInsetAdjustmentBehavior="automatic"
                contentContainerStyle={styles.content}
                style={styles.scrollView}
                testID="refresh-control"
                refreshControl={
                    <RefreshControl
                        refreshing={isLoading}
                        onRefresh={onRefresh}
                        tintColor={colors.blue}
                    />
                }
                accessibilityLabel="Active field assignments"
            >
                <FieldHeader
                    userName={userName}
                    userRole={userRole}
                    syncStatusLabel={syncStatusLabel}
                    syncStatusMessage={syncStatusMessage}
                    syncTone={syncTone}
                    profileOpen={profileSheetOpen}
                    onOpenProfile={handleOpenProfile}
                    notificationCount={syncAttentionCount + pendingResponseCount}
                    onOpenNotifications={() => setNotificationsSheetOpen(true)}
                />
                {false ? (
                    <View style={styles.screenTopBar}>
                        <View style={styles.screenTopBarCopy}>
                            <Text
                                accessibilityRole="header"
                                style={styles.screenTitle}
                            >
                                TODAY'S WORK
                            </Text>
                            {userName ? (
                                <View style={styles.screenUserRow}>
                                    <Text selectable style={styles.screenUser}>
                                        {userName}
                                    </Text>
                                    <Text style={styles.screenRole}>
                                        · {userRole || 'Field worker'}
                                    </Text>
                                </View>
                            ) : null}
                        </View>
                        <View style={styles.topBarActions}>
                            {onLogout ? (
                                <View style={styles.accountMenuWrap}>
                                    <Pressable
                                        accessibilityLabel="Open account menu"
                                        accessibilityHint="Shows account actions"
                                        accessibilityRole="button"
                                        accessibilityState={{
                                            expanded: profileSheetOpen,
                                        }}
                                        onPress={() => {
                                            handleOpenProfile();
                                            setSignOutConfirmationOpen(false);
                                        }}
                                        style={({ pressed }) => [
                                            styles.accountButton,
                                            pressed && styles.pressed,
                                        ]}
                                        testID="account-menu-button"
                                    >
                                        <Text style={styles.accountButtonText}>
                                            Account
                                        </Text>
                                    </Pressable>
                                    {profileSheetOpen ? (
                                        <View
                                            accessibilityViewIsModal
                                            style={styles.accountMenu}
                                            testID="account-menu"
                                        >
                                            <Text
                                                style={styles.accountMenuName}
                                            >
                                                {userName || 'Field account'}
                                            </Text>
                                            <Text
                                                style={styles.accountMenuRole}
                                            >
                                                {userRole || 'Field worker'}
                                            </Text>
                                            <View
                                                style={
                                                    styles.accountMenuDivider
                                                }
                                            />
                                            {signOutConfirmationOpen ? (
                                                <View
                                                    style={
                                                        styles.signOutConfirm
                                                    }
                                                >
                                                    <Text
                                                        style={
                                                            styles.signOutTitle
                                                        }
                                                    >
                                                        Sign out of the field
                                                        app?
                                                    </Text>
                                                    <Text
                                                        style={
                                                            styles.signOutMessage
                                                        }
                                                    >
                                                        You can sign in again
                                                        when you need to access
                                                        field work.
                                                    </Text>
                                                    <View
                                                        style={
                                                            styles.signOutActions
                                                        }
                                                    >
                                                        <Pressable
                                                            accessibilityLabel="Cancel sign out"
                                                            accessibilityRole="button"
                                                            onPress={() =>
                                                                setSignOutConfirmationOpen(
                                                                    false,
                                                                )
                                                            }
                                                            style={({
                                                                pressed,
                                                            }) => [
                                                                styles.accountAction,
                                                                pressed &&
                                                                    styles.pressed,
                                                            ]}
                                                            testID="cancel-sign-out-button"
                                                        >
                                                            <Text
                                                                style={
                                                                    styles.accountActionText
                                                                }
                                                            >
                                                                Cancel
                                                            </Text>
                                                        </Pressable>
                                                        <Pressable
                                                            accessibilityLabel="Confirm sign out"
                                                            accessibilityRole="button"
                                                            onPress={onLogout}
                                                            style={({
                                                                pressed,
                                                            }) => [
                                                                styles.accountAction,
                                                                styles.signOutAction,
                                                                pressed &&
                                                                    styles.pressed,
                                                            ]}
                                                            testID="confirm-sign-out-button"
                                                        >
                                                            <Text
                                                                style={
                                                                    styles.signOutActionText
                                                                }
                                                            >
                                                                Sign out
                                                            </Text>
                                                        </Pressable>
                                                    </View>
                                                </View>
                                            ) : (
                                                <Pressable
                                                    accessibilityLabel="Start sign out"
                                                    accessibilityRole="button"
                                                    onPress={() =>
                                                        setSignOutConfirmationOpen(
                                                            true,
                                                        )
                                                    }
                                                    style={({ pressed }) => [
                                                        styles.accountAction,
                                                        pressed &&
                                                            styles.pressed,
                                                    ]}
                                                    testID="account-sign-out-button"
                                                >
                                                    <Text
                                                        style={
                                                            styles.accountActionText
                                                        }
                                                    >
                                                        Sign out
                                                    </Text>
                                                </Pressable>
                                            )}
                                        </View>
                                    ) : null}
                                </View>
                            ) : null}
                        </View>
                    </View>
                ) : null}

                <View
                    style={[styles.header, isCompact && styles.headerCompact]}
                >
                    <View style={styles.headerCopy}>
                        <Text style={styles.title}>Your assignments</Text>
                        <Text style={styles.subtitle}>
                            See today’s jobs and what to do next.
                        </Text>
                        <Text style={styles.workSummary}>{workSummary}</Text>
                    </View>
                </View>

                {activeNavItem === 'route' ? (
                    <PlannedRoutePanel
                        onBackToToday={() => setActiveNavItem('today')}
                    />
                ) : null}
                <SyncStatusPanel
                    showDetails={hasOutboxActivity}
                    syncGuidance={syncGuidance}
                    queuedCount={queuedCount}
                    syncingCount={syncingCount}
                    failedCount={failedCount}
                    conflictCount={conflictCount}
                    onSyncNow={onSyncNow}
                    isOnline={isOnline}
                />

                {false ? (
                    <View
                        accessibilityLiveRegion="polite"
                        style={[
                            styles.outboxBar,
                            syncDetailsExpanded
                                ? styles.outboxExpanded
                                : styles.outboxCompact,
                            isOnline === true &&
                                !hasSyncAttention &&
                                styles.outboxSynchronized,
                            conflictCount > 0 && styles.outboxConflict,
                            isOnline === false && styles.outboxOffline,
                        ]}
                        testID="outbox-status-bar"
                    >
                        <View style={styles.syncStripRow}>
                            <View
                                style={[
                                    styles.connectionMark,
                                    isOnline === null
                                        ? styles.connectionChecking
                                        : isOnline
                                          ? styles.connectionOnline
                                          : styles.connectionOffline,
                                ]}
                            />
                            <View
                                style={styles.outboxHeaderCopy}
                                accessible
                                accessibilityRole="summary"
                            >
                                <Text style={styles.outboxHeading}>
                                    Sync status
                                </Text>
                                <Text
                                    style={[
                                        styles.connectivityValue,
                                        isOnline === true
                                            ? styles.onlineValue
                                            : styles.offlineValue,
                                    ]}
                                >
                                    {syncStatusLabel}
                                </Text>
                            </View>
                            <Text style={styles.syncStatusMessage} selectable>
                                {syncStatusMessage}
                            </Text>
                        </View>
                        {syncDetailsExpanded ? (
                            <View
                                style={styles.syncDetails}
                                testID="sync-details"
                            >
                                <Text
                                    style={[
                                        styles.outboxSummary,
                                        syncAttentionCount > 0 &&
                                            styles.outboxSummaryAttention,
                                    ]}
                                    testID="sync-guidance"
                                >
                                    {syncGuidance}
                                </Text>
                                <View style={styles.outboxChipRow}>
                                    <View
                                        style={[
                                            styles.outboxChip,
                                            queuedCount > 0
                                                ? styles.queuedChip
                                                : styles.zeroChip,
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.outboxChipText,
                                                queuedCount > 0
                                                    ? styles.queuedChipText
                                                    : styles.zeroChipText,
                                            ]}
                                        >
                                            Queued: {queuedCount}
                                        </Text>
                                    </View>
                                    <View
                                        style={[
                                            styles.outboxChip,
                                            syncingCount > 0
                                                ? styles.syncingChip
                                                : styles.zeroChip,
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.outboxChipText,
                                                syncingCount > 0
                                                    ? styles.syncingChipText
                                                    : styles.zeroChipText,
                                            ]}
                                        >
                                            Syncing: {syncingCount}
                                        </Text>
                                    </View>
                                    <View
                                        style={[
                                            styles.outboxChip,
                                            failedCount > 0
                                                ? styles.failedChip
                                                : styles.zeroChip,
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.outboxChipText,
                                                failedCount > 0
                                                    ? styles.failedChipText
                                                    : styles.zeroChipText,
                                            ]}
                                        >
                                            Failed: {failedCount}
                                        </Text>
                                    </View>
                                    <View
                                        style={[
                                            styles.outboxChip,
                                            conflictCount > 0
                                                ? styles.conflictChip
                                                : styles.zeroChip,
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.outboxChipText,
                                                conflictCount > 0
                                                    ? styles.conflictChipText
                                                    : styles.zeroChipText,
                                            ]}
                                        >
                                            Conflicts: {conflictCount}
                                        </Text>
                                    </View>
                                </View>
                                {onSyncNow &&
                                isOnline === true &&
                                (queuedCount > 0 || failedCount > 0) ? (
                                    <Pressable
                                        accessibilityLabel="Sync queued commands now"
                                        accessibilityRole="button"
                                        onPress={onSyncNow}
                                        style={({ pressed }) => [
                                            sharedStyles.button,
                                            styles.syncButton,
                                            pressed && styles.pressed,
                                        ]}
                                    >
                                        <Text style={sharedStyles.buttonText}>
                                            Sync now
                                        </Text>
                                    </Pressable>
                                ) : null}
                            </View>
                        ) : null}
                    </View>
                ) : null}

                {failedCommands.map((command) => (
                    <View
                        accessible
                        accessibilityRole="alert"
                        key={command.id}
                        style={styles.failedCommand}
                        testID={`failed-command-${command.id}`}
                    >
                        <Text style={styles.failedTitle}>
                            Action needs review:{' '}
                            {command.type.replaceAll('_', ' ')}
                        </Text>
                        <Text style={styles.failedMessage}>
                            {command.error?.message ||
                                'This command could not be synced.'}
                        </Text>
                        <Text style={styles.failedMeta}>
                            Attempts: {command.attempts}
                        </Text>
                        <View style={styles.failedActions}>
                            {command.error?.retryable && onRetryCommand ? (
                                <Pressable
                                    accessibilityLabel="Retry failed command"
                                    accessibilityRole="button"
                                    onPress={() => onRetryCommand(command.id)}
                                    style={({ pressed }) => [
                                        sharedStyles.button,
                                        styles.retryButton,
                                        pressed && styles.pressed,
                                    ]}
                                >
                                    <Text style={sharedStyles.buttonText}>
                                        Retry
                                    </Text>
                                </Pressable>
                            ) : null}
                            {onDiscardCommand ? (
                                <Pressable
                                    accessibilityLabel="Discard failed command"
                                    accessibilityHint="Permanently removes this unsynced action from this device"
                                    accessibilityRole="button"
                                    onPress={() => onDiscardCommand(command.id)}
                                    style={({ pressed }) => [
                                        sharedStyles.button,
                                        styles.discardButton,
                                        pressed && styles.pressed,
                                    ]}
                                >
                                    <Text style={sharedStyles.buttonText}>
                                        Discard
                                    </Text>
                                </Pressable>
                            ) : null}
                        </View>
                    </View>
                ))}

                {error ? (
                    <View
                        accessible
                        accessibilityLiveRegion="assertive"
                        accessibilityRole="alert"
                        style={styles.errorBox}
                    >
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : null}

                {isLoading && jobs.length === 0 ? (
                    <View
                        accessibilityLiveRegion="polite"
                        style={styles.loadingBox}
                    >
                        <ActivityIndicator color={colors.blue} />
                        <Text style={sharedStyles.statusText}>
                            Loading assignments…
                        </Text>
                    </View>
                ) : null}

                {jobs.length === 0 && !isLoading ? (
                    <View
                        style={styles.emptyBox}
                        testID="empty-assignments-msg"
                    >
                        <View style={styles.emptyMark}>
                            <View style={styles.emptyMarkLine} />
                        </View>
                        <Text style={styles.emptyTitle}>
                            No work assigned yet
                        </Text>
                        <Text style={styles.emptyText}>
                            New assignments will appear here. Pull down to
                            refresh and check again.
                        </Text>
                    </View>
                ) : null}

                <View style={styles.jobList}>
                    {jobs.map((job) => {
                        const isPending =
                            job.my_assignment?.response_status === 'pending';
                        const assignedAsset =
                            job.asset_assignments?.[0] ?? null;
                        const priorityStyle =
                            job.priority.value === 'emergency'
                                ? styles.emergencyBadge
                                : job.priority.value === 'priority'
                                  ? styles.priorityBadge
                                  : styles.routineBadge;

                        return (
                            <Pressable
                                accessibilityLabel={`Open assignment ${job.reference}`}
                                accessibilityHint="Reviews the job, assignment response, progress, and safety context"
                                accessibilityRole="button"
                                key={job.id}
                                onPress={() => onSelectJob(job.id)}
                                style={({ pressed }) => [
                                    styles.jobCard,
                                    pressed && styles.cardPressed,
                                ]}
                                testID={`job-card-${job.id}`}
                            >
                                <View style={styles.cardTopRow}>
                                    <Text style={styles.reference}>
                                        {job.reference}
                                    </Text>
                                    <View style={styles.badgeRow}>
                                        <Text
                                            style={[
                                                styles.badge,
                                                priorityStyle,
                                            ]}
                                        >
                                            {job.priority.label}
                                        </Text>
                                        <Text
                                            style={[
                                                styles.badge,
                                                styles.statusBadge,
                                            ]}
                                        >
                                            {job.status.label} (v{job.version})
                                        </Text>
                                    </View>
                                </View>

                                <Text style={styles.jobTitle}>
                                    {job.title} — {job.client}
                                </Text>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Site</Text>
                                    <Text selectable style={styles.detailValue}>
                                        {job.site}
                                    </Text>
                                </View>
                                {job.scheduled_start ? (
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>
                                            Starts
                                        </Text>
                                        <Text
                                            selectable
                                            style={styles.detailValue}
                                        >
                                            {new Date(
                                                job.scheduled_start,
                                            ).toLocaleString()}
                                        </Text>
                                    </View>
                                ) : null}

                                {assignedAsset ? (
                                    <View style={styles.assetSummary}>
                                        <View style={styles.assetIcon}>
                                            <Text style={styles.assetIconText}>
                                                CR
                                            </Text>
                                        </View>
                                        <View style={styles.assetCopy}>
                                            <Text style={styles.assetLabel}>
                                                {assignedAsset.asset_kind ===
                                                'crane'
                                                    ? 'Assigned crane'
                                                    : 'Assigned asset'}
                                            </Text>
                                            <Text
                                                selectable
                                                style={styles.assetValue}
                                            >
                                                {assignedAsset.asset_code} ·{' '}
                                                {assignedAsset.asset_name}
                                            </Text>
                                        </View>
                                    </View>
                                ) : null}

                                {isPending ? (
                                    <View
                                        style={styles.pendingBadge}
                                        testID={`pending-badge-${job.id}`}
                                    >
                                        <Text style={styles.pendingText}>
                                            Response pending
                                        </Text>
                                    </View>
                                ) : null}

                                <View style={styles.cardActionRow}>
                                    <Text style={styles.actionMeta}>
                                        Tap to view job details
                                    </Text>
                                    <Text style={styles.actionBtnText}>
                                        Open assignment
                                    </Text>
                                </View>
                            </Pressable>
                        );
                    })}
                </View>
            </ScrollView>
            <FieldBottomNav
                activeItem={activeNavItem}
                onSelect={handleNavSelect}
            />
            <NotificationsSheet
                visible={notificationsSheetOpen}
                onClose={() => setNotificationsSheetOpen(false)}
                queuedCount={queuedCount}
                failedCount={failedCount}
                conflictCount={conflictCount}
                pendingResponseCount={pendingResponseCount}
                failedCommands={failedCommands}
                pendingJobs={jobs.filter((j) => j.my_assignment?.response_status === 'pending')}
                onRetryCommand={onRetryCommand}
                onSyncNow={onSyncNow}
                isOnline={isOnline}
            />
            <ProfileSheet
                visible={profileSheetOpen}
                userName={userName}
                userRole={userRole}
                assignedAssetLabel={
                    jobs.flatMap((j) => j.asset_assignments || [])[0]
                        ?.asset_name || null
                }
                isOnline={isOnline}
                queuedCount={queuedCount}
                onSyncNow={onSyncNow}
                signOutConfirmationOpen={signOutConfirmationOpen}
                onClose={() => handleCloseProfile()}
                onStartSignOut={handleStartSignOut}
                onCancelSignOut={handleCancelSignOut}
                onLogout={handleLogout}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    screenRoot: {
        backgroundColor: colors.background,
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        alignSelf: 'center',
        maxWidth: 720,
        padding: 16,
        paddingBottom: 32,
        width: '100%',
    },
    screenTopBar: {
        alignItems: 'center',
        borderBottomColor: colors.border,
        borderBottomWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
        minHeight: 52,
        paddingBottom: 12,
    },
    screenTopBarCopy: {
        flex: 1,
        minWidth: 0,
    },
    screenUserRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 4,
        marginTop: 3,
    },
    screenTitle: {
        color: colors.text,
        fontSize: 20,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    screenUser: {
        color: colors.secondary,
        fontSize: 12,
        textTransform: 'capitalize',
    },
    screenRole: {
        color: colors.muted,
        fontSize: 12,
        textTransform: 'capitalize',
    },
    topBarActions: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    accountMenuWrap: {
        position: 'relative',
        zIndex: 3,
    },
    accountButton: {
        alignItems: 'center',
        borderColor: colors.borderStrong,
        borderRadius: 8,
        borderWidth: 1,
        justifyContent: 'center',
        minHeight: 44,
        paddingHorizontal: 12,
    },
    accountButtonText: {
        color: colors.text,
        fontSize: 12,
        fontWeight: '800',
    },
    accountMenu: {
        backgroundColor: colors.surface,
        borderColor: colors.borderStrong,
        borderRadius: 12,
        borderWidth: 1,
        minWidth: 220,
        padding: 12,
        position: 'absolute',
        right: 0,
        top: 52,
        zIndex: 4,
    },
    accountMenuName: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '800',
    },
    accountMenuRole: {
        color: colors.muted,
        fontSize: 12,
        marginTop: 2,
        textTransform: 'capitalize',
    },
    accountMenuDivider: {
        backgroundColor: colors.border,
        height: 1,
        marginVertical: 10,
    },
    accountAction: {
        alignItems: 'center',
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        justifyContent: 'center',
        minHeight: 44,
        paddingHorizontal: 12,
    },
    accountActionText: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '700',
    },
    signOutConfirm: {
        gap: 8,
    },
    signOutTitle: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '800',
    },
    signOutMessage: {
        color: colors.secondary,
        fontSize: 13,
        lineHeight: 18,
    },
    signOutActions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 4,
    },
    signOutAction: {
        backgroundColor: colors.redSoft,
        borderColor: colors.redBorder,
        flex: 1,
    },
    signOutActionText: {
        color: colors.redDark,
        fontSize: 14,
        fontWeight: '800',
    },
    headerCompact: {
        alignItems: 'stretch',
        flexDirection: 'column',
        gap: 12,
    },
    header: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    headerCopy: {
        flex: 1,
        paddingRight: 12,
    },
    title: {
        color: colors.text,
        fontSize: 22,
        fontWeight: '800',
        lineHeight: 28,
    },
    subtitle: {
        color: colors.secondary,
        fontSize: 14,
        lineHeight: 20,
        marginTop: 4,
    },
    workSummary: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '700',
        lineHeight: 19,
        marginTop: 8,
    },
    refreshButton: {
        backgroundColor: colors.surface,
        borderColor: colors.amberBorder,
        borderWidth: 1,
        minHeight: 48,
        minWidth: 96,
        borderRadius: 8,
        paddingHorizontal: 14,
    },
    refreshButtonText: {
        color: colors.amberDark,
        fontSize: 15,
        fontWeight: '800',
        textAlign: 'center',
    },
    pressed: {
        opacity: 0.78,
    },
    outboxBar: {
        marginBottom: 16,
    },
    outboxCompact: {
        alignSelf: 'stretch',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 999,
        borderWidth: 1,
        minHeight: 44,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    outboxExpanded: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        gap: 8,
        padding: 12,
    },
    syncStripRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 10,
        minHeight: 30,
    },
    outboxHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 10,
    },
    outboxHeaderCopy: {
        flex: 1,
    },
    outboxSummary: {
        color: colors.secondary,
        fontSize: 13,
        lineHeight: 19,
    },
    outboxSummaryAttention: {
        color: colors.warningDark,
        fontWeight: '700',
    },
    syncStatusMessage: {
        color: colors.muted,
        flex: 1,
        fontSize: 12,
        lineHeight: 17,
        textAlign: 'right',
    },
    syncDetails: {
        borderTopColor: colors.border,
        borderTopWidth: 1,
        gap: 8,
        paddingTop: 8,
    },
    connectionMark: {
        borderRadius: 6,
        height: 12,
        width: 12,
    },
    connectionChecking: {
        backgroundColor: colors.muted,
    },
    connectionOnline: {
        backgroundColor: colors.green,
    },
    connectionOffline: {
        backgroundColor: colors.warning,
    },
    outboxChipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 2,
    },
    outboxChip: {
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    outboxChipText: {
        fontSize: 12,
        fontWeight: '800',
        fontVariant: ['tabular-nums'],
    },
    queuedChip: {
        backgroundColor: colors.surfaceMuted,
    },
    queuedChipText: {
        color: colors.secondary,
    },
    syncingChip: {
        backgroundColor: colors.blueSoft,
    },
    syncingChipText: {
        color: colors.blueDark,
    },
    failedChip: {
        backgroundColor: colors.redSoft,
    },
    failedChipText: {
        color: colors.redDark,
    },
    conflictChip: {
        backgroundColor: colors.warningSoft,
    },
    conflictChipText: {
        color: colors.warningDark,
    },
    zeroChip: {
        backgroundColor: colors.surfaceMuted,
    },
    zeroChipText: {
        color: colors.secondary,
    },
    outboxConflict: {
        backgroundColor: colors.warningLight,
        borderColor: colors.warningBorder,
    },
    outboxOffline: {
        backgroundColor: colors.warningLight,
        borderColor: colors.warningBorder,
    },
    outboxSynchronized: {
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
    },
    outboxHeading: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '800',
    },
    connectivityValue: {
        fontSize: 13,
        fontWeight: '800',
    },
    onlineValue: {
        color: colors.green,
    },
    offlineValue: {
        color: colors.warningDark,
    },
    syncButton: {
        backgroundColor: colors.amber,
        minHeight: 48,
        width: '100%',
    },
    failedCommand: {
        backgroundColor: colors.redSoft,
        borderColor: colors.redBorder,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 12,
        padding: 12,
    },
    failedTitle: {
        color: colors.red,
        fontSize: 14,
        fontWeight: '800',
        textTransform: 'capitalize',
    },
    failedMessage: {
        color: colors.secondary,
        fontSize: 13,
        lineHeight: 19,
        marginTop: 4,
    },
    failedMeta: {
        color: colors.muted,
        fontSize: 12,
        marginTop: 4,
    },
    failedActions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 10,
    },
    retryButton: {
        backgroundColor: colors.amber,
        flexGrow: 1,
        minHeight: 48,
    },
    discardButton: {
        backgroundColor: colors.red,
        flexGrow: 1,
        minHeight: 48,
    },
    errorBox: {
        backgroundColor: colors.redSoft,
        borderColor: colors.redBorder,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 16,
        padding: 12,
    },
    errorText: {
        color: colors.red,
        fontSize: 14,
        lineHeight: 20,
    },
    loadingBox: {
        alignItems: 'center',
        gap: 10,
        padding: 32,
    },
    emptyBox: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 16,
        padding: 36,
    },
    emptyMark: {
        alignItems: 'center',
        backgroundColor: colors.amberSoft,
        borderRadius: 24,
        justifyContent: 'center',
        width: 48,
        height: 48,
        marginBottom: 12,
    },
    emptyMarkLine: {
        backgroundColor: colors.amberDark,
        borderRadius: 2,
        height: 4,
        width: 18,
    },
    emptyTitle: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '800',
    },
    emptyText: {
        color: colors.secondary,
        fontSize: 14,
        lineHeight: 20,
        marginTop: 8,
        textAlign: 'center',
    },
    jobList: {
        gap: 12,
    },
    jobCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 10,
        borderWidth: 1,
        padding: 16,
    },
    cardPressed: {
        backgroundColor: colors.surfaceMuted,
    },
    cardTopRow: {
        alignItems: 'flex-start',
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8,
    },
    reference: {
        color: colors.blueDark,
        flexShrink: 1,
        fontSize: 16,
        fontWeight: '800',
    },
    badgeRow: {
        alignItems: 'flex-end',
        flexDirection: 'row',
        flexShrink: 1,
        flexWrap: 'wrap',
        gap: 6,
        justifyContent: 'flex-end',
    },
    badge: {
        borderRadius: 12,
        fontSize: 11,
        fontWeight: '800',
        overflow: 'hidden',
        paddingHorizontal: 8,
        paddingVertical: 4,
        textTransform: 'uppercase',
    },
    statusBadge: {
        backgroundColor: colors.blueSoft,
        color: colors.blueDark,
    },
    emergencyBadge: {
        backgroundColor: colors.redSoft,
        color: colors.redDark,
    },
    priorityBadge: {
        backgroundColor: colors.warningSoft,
        color: colors.warningDark,
    },
    routineBadge: {
        backgroundColor: colors.surfaceMuted,
        color: colors.secondary,
    },
    jobTitle: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '800',
        lineHeight: 21,
        marginTop: 12,
    },
    assetSummary: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 10,
        marginTop: 12,
        padding: 10,
    },
    assetIcon: {
        alignItems: 'center',
        backgroundColor: colors.amberSoft,
        borderRadius: 20,
        height: 40,
        justifyContent: 'center',
        width: 40,
    },
    assetIconText: {
        color: colors.amberDark,
        fontSize: 11,
        fontWeight: '800',
    },
    assetCopy: {
        flex: 1,
        gap: 2,
    },
    assetLabel: {
        color: colors.muted,
        fontSize: 12,
        fontWeight: '800',
    },
    assetValue: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '700',
        lineHeight: 19,
    },
    detailRow: {
        alignItems: 'flex-start',
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    detailLabel: {
        color: colors.muted,
        fontSize: 13,
        fontWeight: '700',
        width: 48,
    },
    detailValue: {
        color: colors.secondary,
        flex: 1,
        fontSize: 14,
        lineHeight: 20,
    },
    pendingBadge: {
        alignSelf: 'flex-start',
        backgroundColor: colors.amberSoft,
        borderColor: colors.amberBorder,
        borderRadius: 6,
        borderWidth: 1,
        marginTop: 12,
        paddingHorizontal: 8,
        paddingVertical: 6,
    },
    pendingText: {
        color: colors.amberDark,
        fontSize: 12,
        fontWeight: '800',
    },
    cardActionRow: {
        alignItems: 'center',
        borderTopColor: colors.border,
        borderTopWidth: 1,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 16,
        minHeight: 48,
        paddingTop: 10,
    },
    actionMeta: {
        color: colors.muted,
        flex: 1,
        fontSize: 12,
    },
    actionBtnText: {
        color: colors.amberDark,
        fontSize: 14,
        fontWeight: '800',
    },
});
