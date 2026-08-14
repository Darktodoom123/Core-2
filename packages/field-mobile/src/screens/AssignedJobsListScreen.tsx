import React, { useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';
import { FailedCommandsList } from '../components/cards/FailedCommandsList';
import { JobListItemCard } from '../components/cards/JobListItemCard';
import { ShiftStatusCard } from '../components/cards/ShiftStatusCard';
import { FieldBottomNav } from '../components/layout/field-bottom-nav';
import type { FieldNavItem } from '../components/layout/field-bottom-nav';
import { FieldHeader } from '../components/layout/field-header';
import type { SyncTone } from '../components/layout/field-header';
import { colors, sharedStyles } from '../components/nativeStyles';
import { PlannedRoutePanel } from '../components/panels/planned-route-panel';
import { SyncStatusPanel } from '../components/panels/sync-status-panel';
import { NotificationsSheet } from '../components/sheets/notifications-sheet';
import { ProfileSheet } from '../components/sheets/profile-sheet';
import type {
    DispatchJob,
    OutboxCommand,
    ShiftInfo,
    ShiftStatus,
} from '../types/index';

export interface AssignedJobsListScreenProps {
    jobs: DispatchJob[];
    outboxCommands: OutboxCommand[];
    isLoading: boolean;
    isOnline?: boolean | null;
    userName?: string | null;
    userRole?: string | null;
    shiftInfo?: ShiftInfo;
    locationSharingActive?: boolean;
    error?: string | null;
    onRefresh: () => void;
    onSelectJob: (jobId: number) => void;
    onToggleShift?: (nextStatus: ShiftStatus) => void;
    onToggleLocationSharing?: () => void;
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
    shiftInfo = { status: 'on_shift', startedAt: '08:00 AM', hoursElapsed: 4 },
    locationSharingActive = true,
    error,
    onRefresh,
    onSelectJob,
    onToggleShift,
    onToggleLocationSharing,
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
                    notificationCount={
                        syncAttentionCount + pendingResponseCount
                    }
                    onOpenNotifications={() => setNotificationsSheetOpen(true)}
                    onOpenProfile={handleOpenProfile}
                    profileOpen={profileSheetOpen}
                    syncStatusLabel={syncStatusLabel}
                    syncStatusMessage={syncStatusMessage}
                    syncTone={syncTone}
                    userName={userName}
                    userRole={userRole}
                />

                {/* Shift & GPS Sharing Status Strip */}
                <ShiftStatusCard
                    locationSharingActive={locationSharingActive}
                    onToggleLocationSharing={onToggleLocationSharing}
                    onToggleShift={() =>
                        onToggleShift?.(
                            shiftInfo.status === 'on_shift'
                                ? 'on_break'
                                : 'on_shift',
                        )
                    }
                    shiftInfo={shiftInfo}
                />

                {/* ROUTE TAB CONTENT */}
                {activeNavItem === 'route' ? (
                    <PlannedRoutePanel
                        onBackToToday={() => setActiveNavItem('today')}
                    />
                ) : null}

                {/* TODAY ASSIGNMENTS CONTENT */}
                {activeNavItem === 'today' ? (
                    <>
                        <View
                            style={[
                                styles.header,
                                isCompact && styles.headerCompact,
                            ]}
                        >
                            <View style={styles.headerCopy}>
                                <Text style={styles.title}>
                                    Your assignments
                                </Text>
                                <Text style={styles.subtitle}>
                                    See today’s jobs and what to do next.
                                </Text>
                                <Text style={styles.workSummary}>
                                    {workSummary}
                                </Text>
                            </View>
                        </View>

                        <SyncStatusPanel
                            conflictCount={conflictCount}
                            failedCount={failedCount}
                            isOnline={isOnline}
                            onSyncNow={onSyncNow}
                            queuedCount={queuedCount}
                            showDetails={hasOutboxActivity}
                            syncGuidance={syncGuidance}
                            syncingCount={syncingCount}
                        />

                        <FailedCommandsList
                            failedCommands={failedCommands}
                            onDiscardCommand={onDiscardCommand}
                            onRetryCommand={onRetryCommand}
                        />

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
                                    New assignments will appear here. Pull down
                                    to refresh and check again.
                                </Text>
                            </View>
                        ) : null}

                        <View style={styles.jobList}>
                            {jobs.map((job) => (
                                <JobListItemCard
                                    job={job}
                                    key={job.id}
                                    onSelectJob={onSelectJob}
                                />
                            ))}
                        </View>
                    </>
                ) : null}
            </ScrollView>

            <FieldBottomNav
                activeItem={activeNavItem}
                onSelect={handleNavSelect}
            />

            <NotificationsSheet
                conflictCount={conflictCount}
                failedCommands={failedCommands}
                failedCount={failedCount}
                isOnline={isOnline}
                onClose={() => setNotificationsSheetOpen(false)}
                onRetryCommand={onRetryCommand}
                onSyncNow={onSyncNow}
                pendingJobs={jobs.filter(
                    (j) => j.my_assignment?.response_status === 'pending',
                )}
                pendingResponseCount={pendingResponseCount}
                queuedCount={queuedCount}
                visible={notificationsSheetOpen}
            />

            <ProfileSheet
                assignedAssetLabel={
                    jobs.flatMap((j) => j.asset_assignments || [])[0]
                        ?.asset_name || null
                }
                isOnline={isOnline}
                onCancelSignOut={handleCancelSignOut}
                onClose={() => handleCloseProfile()}
                onLogout={handleLogout}
                onStartSignOut={handleStartSignOut}
                onSyncNow={onSyncNow}
                queuedCount={queuedCount}
                signOutConfirmationOpen={signOutConfirmationOpen}
                userName={userName}
                userRole={userRole}
                visible={profileSheetOpen}
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
        height: 48,
        justifyContent: 'center',
        marginBottom: 12,
        width: 48,
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
});
