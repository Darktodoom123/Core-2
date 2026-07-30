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
    error?: string | null;
    onRefresh: () => void;
    onSelectJob: (jobId: number) => void;
}

export const AssignedJobsListScreen: React.FC<AssignedJobsListScreenProps> = ({
    jobs,
    outboxCommands,
    isLoading,
    error,
    onRefresh,
    onSelectJob,
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

    return (
        <ScrollView
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
                    <Text style={styles.title}>Active Field Assignments</Text>
                    <Text style={styles.subtitle}>
                        Server-authoritative field operations
                    </Text>
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
                        <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                        <Text style={sharedStyles.buttonText}>Refresh</Text>
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
                <Text style={styles.outboxHeading}>Outbox status</Text>
                <Text style={[styles.outboxValue, { color: colors.blue }]}>
                    Queued: {queuedCount}
                </Text>
                <Text style={[styles.outboxValue, { color: colors.amber }]}>
                    Syncing: {syncingCount}
                </Text>
                <Text style={[styles.outboxValue, { color: colors.red }]}>
                    Failed: {failedCount}
                </Text>
                <Text
                    style={[
                        styles.outboxValue,
                        conflictCount > 0 && styles.conflictValue,
                    ]}
                >
                    Conflicts: {conflictCount}
                </Text>
            </View>

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
                    <Text style={styles.emptyTitle}>No active assignments</Text>
                    <Text style={styles.emptyText}>
                        New work assigned to your account will appear here.
                    </Text>
                </View>
            ) : null}

            <View style={styles.jobList}>
                {jobs.map((job) => {
                    const isPending =
                        job.my_assignment?.response_status === 'pending';
                    const priorityColor =
                        job.priority.value === 'emergency'
                            ? colors.red
                            : job.priority.value === 'priority'
                              ? colors.amber
                              : colors.green;

                    return (
                        <Pressable
                            accessibilityLabel={`Open assignment ${job.reference}`}
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
                                            {
                                                backgroundColor: `${priorityColor}22`,
                                                color: priorityColor,
                                            },
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
                            <Text style={styles.site}>Site: {job.site}</Text>

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
        maxWidth: 1040,
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
        fontSize: 20,
        fontWeight: '800',
    },
    subtitle: {
        color: colors.secondary,
        fontSize: 12,
        marginTop: 4,
    },
    refreshButton: {
        minWidth: 96,
    },
    pressed: {
        opacity: 0.78,
    },
    outboxBar: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 16,
        padding: 12,
    },
    outboxConflict: {
        backgroundColor: colors.redSoft,
        borderColor: colors.redBorder,
    },
    outboxHeading: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '800',
        width: '100%',
    },
    outboxValue: {
        fontSize: 13,
        fontWeight: '700',
    },
    conflictValue: {
        color: colors.red,
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
        backgroundColor: colors.surfaceMuted,
        borderRadius: 10,
        marginBottom: 16,
        padding: 32,
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
        color: colors.blue,
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
        color: colors.blue,
    },
    jobTitle: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '800',
        lineHeight: 21,
        marginTop: 12,
    },
    site: {
        color: colors.secondary,
        fontSize: 14,
        lineHeight: 20,
        marginTop: 8,
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
});
