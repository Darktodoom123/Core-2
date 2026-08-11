import React from 'react';
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
import { colors, sharedStyles } from './nativeStyles';

export interface AssignedJobsListScreenProps {
    jobs: DispatchJob[];
    outboxCommands: OutboxCommand[];
    isLoading: boolean;
    isOnline?: boolean | null;
    error?: string | null;
    onRefresh: () => void;
    onSelectJob: (jobId: number) => void;
    onSyncNow?: () => void;
    onRetryCommand?: (commandId: string) => void;
    onDiscardCommand?: (commandId: string) => void;
}

export const AssignedJobsListScreen: React.FC<AssignedJobsListScreenProps> = ({
    jobs,
    outboxCommands,
    isLoading,
    isOnline = null,
    error,
    onRefresh,
    onSelectJob,
    onSyncNow,
    onRetryCommand,
    onDiscardCommand,
}) => {
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
    const syncGuidance =
        conflictCount > 0
            ? `${conflictCount} saved action${conflictCount === 1 ? '' : 's'} need conflict review.`
            : failedCount > 0
              ? `${failedCount} saved action${failedCount === 1 ? '' : 's'} failed. Retry before leaving the app.`
              : queuedCount > 0
                ? `${queuedCount} action${queuedCount === 1 ? '' : 's'} saved on this device and waiting to sync.`
                : syncingCount > 0
                  ? 'Saved actions are syncing now.'
                  : 'Actions sync automatically when the connection is available.';
    const workSummary =
        isLoading && jobs.length === 0
            ? 'Loading active assignments...'
            : `${jobs.length} ${jobs.length === 1 ? 'active assignment' : 'active assignments'} • ${pendingResponseCount > 0 ? `${pendingResponseCount} need${pendingResponseCount === 1 ? 's' : ''} response` : 'No responses waiting'}`;

    return (
        <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={styles.content}
            refreshControl={
                <RefreshControl
                    refreshing={isLoading}
                    onRefresh={onRefresh}
                    tintColor={colors.blue}
                />
            }
            accessibilityLabel="Active field assignments"
        >
            <View style={[styles.header, isCompact && styles.headerCompact]}>
                <View style={styles.headerCopy}>
                    <Text style={styles.eyebrow}>TODAY'S WORK</Text>
                    <Text style={styles.title}>Active Field Assignments</Text>
                    <Text style={styles.subtitle}>
                        Today’s assigned work and next safe action.
                    </Text>
                    <Text style={styles.workSummary}>{workSummary}</Text>
                </View>
                <Pressable
                    accessibilityLabel={
                        isLoading
                            ? 'Refreshing assignments'
                            : 'Refresh assignments'
                    }
                    accessibilityRole="button"
                    accessibilityState={{
                        busy: isLoading,
                        disabled: isLoading,
                    }}
                    disabled={isLoading}
                    onPress={onRefresh}
                    style={({ pressed }) => [
                        sharedStyles.button,
                        styles.refreshButton,
                        pressed && styles.pressed,
                    ]}
                    testID="refresh-jobs-btn"
                >
                    {isLoading ? (
                        <ActivityIndicator color={colors.amber} size="small" />
                    ) : (
                        <Text style={styles.refreshButtonText}>Refresh</Text>
                    )}
                </Pressable>
            </View>

            <View
                accessible
                accessibilityLiveRegion="polite"
                accessibilityRole="summary"
                style={[
                    styles.outboxBar,
                    conflictCount > 0 && styles.outboxConflict,
                ]}
                testID="outbox-status-bar"
            >
                <View style={styles.outboxHeader}>
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
                    <View style={styles.outboxHeaderCopy}>
                        <Text style={styles.outboxHeading}>Sync status</Text>
                        <Text
                            style={[
                                styles.connectivityValue,
                                isOnline === true
                                    ? styles.onlineValue
                                    : styles.offlineValue,
                            ]}
                        >
                            {isOnline === null
                                ? 'Checking connection'
                                : isOnline
                                  ? 'Online'
                                  : 'Offline — commands stay on this device'}
                        </Text>
                    </View>
                </View>
                <Text
                    style={[
                        styles.outboxSummary,
                        syncAttentionCount > 0 && styles.outboxSummaryAttention,
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
                        <Text style={sharedStyles.buttonText}>Sync now</Text>
                    </Pressable>
                ) : null}
            </View>

            {failedCommands.map((command) => (
                <View
                    accessible
                    accessibilityRole="alert"
                    key={command.id}
                    style={styles.failedCommand}
                    testID={`failed-command-${command.id}`}
                >
                    <Text style={styles.failedTitle}>
                        Action needs review: {command.type.replaceAll('_', ' ')}
                    </Text>
                    <Text style={styles.failedMessage}>
                        {command.error?.message ||
                            'This command could not be synchronized.'}
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
                                accessibilityHint="Permanently removes this unsynchronized action from this device"
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
                <View style={styles.emptyBox} testID="empty-assignments-msg">
                    <View style={styles.emptyMark}>
                        <View style={styles.emptyMarkLine} />
                    </View>
                    <Text style={styles.emptyTitle}>No active assignments</Text>
                    <Text style={styles.emptyText}>
                        New work assigned to your account will appear here. Pull
                        down or use Refresh to check again.
                    </Text>
                </View>
            ) : null}

            <View style={styles.jobList}>
                {jobs.map((job) => {
                    const isPending =
                        job.my_assignment?.response_status === 'pending';
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
                                    <Text style={[styles.badge, priorityStyle]}>
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
                                    <Text selectable style={styles.detailValue}>
                                        {new Date(
                                            job.scheduled_start,
                                        ).toLocaleString()}
                                    </Text>
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
                                    Review assignment
                                </Text>
                            </View>
                        </Pressable>
                    );
                })}
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
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
    eyebrow: {
        color: colors.amberDark,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 1,
        marginBottom: 4,
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
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        gap: 10,
        marginBottom: 16,
        padding: 16,
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
