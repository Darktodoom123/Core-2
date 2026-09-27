import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AssignmentResponseCard } from '../components/cards/AssignmentResponseCard';
import { activeJobs } from '../components/cards/job-card/job-lifecycle';
import { JobListItemCard } from '../components/cards/JobListItemCard';
import { Icon } from '../components/common/Icon';
import { TileScreenHeader } from '../components/layout/tile-screen-header';
import { ReportDelayModal } from '../components/sheets/ReportDelayModal';
import type { FieldApiClient } from '../services/apiClient';
import { useTheme, useThemedStyles } from '../theme';
import type { ThemeColors } from '../theme';
import type {
    DispatchJob,
    DispatchStatus,
    OutboxCommand,
    ReportDelayPayload,
} from '../types/index';
import { JobHistoryList } from './dispatch/job-history-list';
import { useJobHistory } from './dispatch/use-job-history';

type DispatchTab = 'pending' | 'active' | 'history';

export interface DispatchOrdersScreenProps {
    jobs: DispatchJob[];
    /** Loads the History tab; finished jobs come only from the server. */
    apiClient?: FieldApiClient;
    onBack?: () => void;
    onAcceptAssignment?: (
        jobId: number,
        assignmentId: number,
        version: number,
    ) => void;
    onRejectAssignment?: (
        jobId: number,
        assignmentId: number,
        reason: string,
        version: number,
    ) => void;
    onSelectJob?: (jobId: number) => void;
    onTransitionStatus?: (
        jobId: number,
        nextStatus: DispatchStatus,
        version: number,
    ) => void;
    onOpenDvir?: () => void;
    /** Delegates delay reporting to a parent that owns its own delay form. */
    onReportDelay?: (job: DispatchJob) => void;
    /** Submits a delay from this screen's own delay form. */
    onSubmitDelay?: (
        jobId: number,
        payload: ReportDelayPayload,
    ) => Promise<void> | void;
    conflictedCommands?: OutboxCommand[];
    outboxCommands?: OutboxCommand[];
    onAcceptServerState?: (commandId: string) => void;
    onRetryNewVersion?: (commandId: string, newVersion: number) => void;
    testID?: string;
    backTestID?: string;
}

export const DispatchOrdersScreen: React.FC<DispatchOrdersScreenProps> = ({
    jobs: allJobs,
    apiClient,
    onBack,
    onAcceptAssignment,
    onRejectAssignment,
    onSelectJob,
    onTransitionStatus,
    onOpenDvir,
    onReportDelay,
    onSubmitDelay,
    conflictedCommands,
    outboxCommands,
    onAcceptServerState,
    onRetryNewVersion,
    testID = 'dispatch-orders-screen',
    backTestID = 'dispatch-back-btn',
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);

    // Finished jobs never sit among live work; History loads them separately.
    const jobs = activeJobs(allJobs);
    const pendingJobs = jobs.filter(
        (job) => job.my_assignment?.response_status === 'pending',
    );
    const [userTab, setUserTab] = useState<DispatchTab | null>(null);
    const [delayModalJob, setDelayModalJob] = useState<DispatchJob | null>(
        null,
    );

    const hasPending = pendingJobs.length > 0;
    const selectedTab: DispatchTab =
        userTab ?? (pendingJobs.length > 0 ? 'pending' : 'active');
    const displayedJobs = selectedTab === 'pending' ? pendingJobs : jobs;
    const history = useJobHistory(apiClient);
    const tabs: Array<{ id: DispatchTab; label: string; a11y: string }> = [
        {
            id: 'pending',
            label: `Needs Response (${pendingJobs.length})`,
            a11y: `Needs response tab, ${pendingJobs.length} orders`,
        },
        {
            id: 'active',
            label: `Active (${jobs.length})`,
            a11y: `Active orders tab, ${jobs.length} orders`,
        },
        { id: 'history', label: 'History', a11y: 'Finished jobs history tab' },
    ];
    const handleReportDelay =
        onReportDelay ?? (onSubmitDelay ? setDelayModalJob : undefined);

    return (
        <View style={styles.screenRoot} testID={testID}>
            {/* Unified Tile Screen Header */}
            <TileScreenHeader
                backAccessibilityHint="Returns to dashboard launcher"
                backAccessibilityLabel="Back to dashboard"
                backTestID={backTestID}
                category="Central Dispatch"
                onBack={onBack}
                rightElement={
                    <View
                        style={[
                            styles.headerBadge,
                            hasPending
                                ? styles.headerBadgePending
                                : styles.headerBadgeClear,
                        ]}
                        testID="dispatch-header-badge"
                    >
                        <Icon
                            color={
                                hasPending
                                    ? theme.warningOrangeText
                                    : theme.successEmeraldText
                            }
                            name={hasPending ? 'alert' : 'check'}
                            size={14}
                        />
                        <Text
                            style={[
                                styles.headerBadgeText,
                                hasPending
                                    ? styles.headerBadgeTextPending
                                    : styles.headerBadgeTextClear,
                            ]}
                        >
                            {hasPending
                                ? `${pendingJobs.length} PENDING`
                                : 'ALL CLEAR'}
                        </Text>
                    </View>
                }
                subtitle={`${pendingJobs.length} needs response · ${jobs.length} active`}
                title="Dispatch Intake & Orders"
            />

            {/* Segmented Filter Tab Rail */}
            <View style={styles.tabRailContainer}>
                {tabs.map((tab) => {
                    const isSelected = selectedTab === tab.id;

                    return (
                        <Pressable
                            accessibilityLabel={tab.a11y}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: isSelected }}
                            key={tab.id}
                            onPress={() => {
                                setUserTab(tab.id);

                                if (tab.id === 'history') {
                                    history.ensureLoaded();
                                }
                            }}
                            style={[
                                styles.tabItem,
                                isSelected && styles.tabItemActive,
                            ]}
                            testID={`intake-tab-${tab.id}`}
                        >
                            <Text
                                numberOfLines={2}
                                style={[
                                    styles.tabItemText,
                                    isSelected && styles.tabItemTextActive,
                                ]}
                            >
                                {tab.label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>

            {/* Scrollable Orders List */}
            <ScrollView
                accessibilityLabel="Dispatch orders list"
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                style={styles.scrollView}
                testID="dispatch-orders-list"
            >
                {selectedTab === 'history' ? (
                    <JobHistoryList history={history} />
                ) : displayedJobs.length === 0 ? (
                    <View
                        style={styles.emptyCard}
                        testID="dispatch-intake-empty"
                    >
                        <View style={styles.emptyIconCircle}>
                            <Icon
                                color={theme.textSecondary}
                                name="clipboard"
                                size={28}
                            />
                        </View>
                        <Text style={styles.emptyTitle}>
                            {selectedTab === 'pending'
                                ? 'No Orders Pending Response'
                                : 'No Dispatch Orders Found'}
                        </Text>
                        <Text style={styles.emptySubtext}>
                            {selectedTab === 'pending'
                                ? 'All dispatched job orders have been reviewed. New incoming orders from central dispatch will appear here immediately.'
                                : 'There are currently no active or scheduled equipment dispatch assignments.'}
                        </Text>
                    </View>
                ) : (
                    displayedJobs.map((job) => {
                        const isPending =
                            job.my_assignment?.response_status === 'pending';

                        const jobConflictedCommands =
                            conflictedCommands?.filter(
                                (command) =>
                                    command.jobId === job.id ||
                                    (command.payload as any)
                                        ?.dispatch_job_id === job.id ||
                                    (command.payload as any)?.jobId ===
                                        job.id ||
                                    (!command.jobId && jobs.length === 1),
                            );

                        const queuedDelayCommand = outboxCommands?.find(
                            (command) =>
                                command.type === 'report_delay' &&
                                (command.state === 'queued' ||
                                    command.state === 'syncing') &&
                                (command.jobId === job.id ||
                                    (command.payload as any)
                                        ?.dispatch_job_id === job.id),
                        );

                        return (
                            <View
                                key={job.id}
                                style={styles.jobCardWrapper}
                                testID={`dispatch-intake-job-${job.id}`}
                            >
                                {/* Full Job Detail Card */}
                                <View testID={`dispatch-job-context-${job.id}`}>
                                    <JobListItemCard
                                        conflictedCommands={
                                            jobConflictedCommands
                                        }
                                        job={job}
                                        hideAssignmentActions={isPending}
                                        onAcceptAssignment={onAcceptAssignment}
                                        onAcceptServerState={
                                            onAcceptServerState
                                        }
                                        onRejectAssignment={onRejectAssignment}
                                        onReportDelay={handleReportDelay}
                                        queuedDelayCommand={queuedDelayCommand}
                                        onRetryNewVersion={onRetryNewVersion}
                                        onSelectJob={onSelectJob}
                                        onTransitionStatus={onTransitionStatus}
                                    />
                                </View>

                                {/* Keep response controls adjacent to their job context. */}
                                {isPending &&
                                onAcceptAssignment &&
                                onRejectAssignment ? (
                                    <View
                                        testID={`dispatch-job-response-${job.id}`}
                                    >
                                        <AssignmentResponseCard
                                            job={job}
                                            onAccept={onAcceptAssignment}
                                            onReject={onRejectAssignment}
                                        />
                                    </View>
                                ) : null}
                            </View>
                        );
                    })
                )}
            </ScrollView>

            {delayModalJob && onSubmitDelay ? (
                <ReportDelayModal
                    job={delayModalJob}
                    onClose={() => setDelayModalJob(null)}
                    onNavigateDvir={onOpenDvir}
                    onSubmit={async (payload) => {
                        await onSubmitDelay(delayModalJob.id, payload);
                        setDelayModalJob(null);
                    }}
                    visible
                />
            ) : null}
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        screenRoot: {
            backgroundColor: theme.canvas,
            flex: 1,
        },
        headerBadge: {
            alignItems: 'center',
            borderRadius: 14,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 6,
            minHeight: 32,
            paddingHorizontal: 10,
        },
        headerBadgePending: {
            backgroundColor: theme.warningOrangeLight,
            borderColor: theme.warningOrange,
        },
        headerBadgeClear: {
            backgroundColor: theme.successEmeraldLight,
            borderColor: theme.successEmerald,
        },
        headerBadgeText: {
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 0.4,
        },
        headerBadgeTextPending: {
            color: theme.warningOrangeText,
        },
        headerBadgeTextClear: {
            color: theme.successEmeraldText,
        },
        tabRailContainer: {
            backgroundColor: theme.surfaceHighlight,
            borderColor: theme.border,
            borderRadius: 12,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 4,
            marginHorizontal: 16,
            marginTop: 12,
            padding: 4,
        },
        tabItem: {
            alignItems: 'center',
            borderColor: 'transparent',
            borderRadius: 8,
            borderWidth: 1,
            flex: 1,
            justifyContent: 'center',
            minHeight: 48,
            paddingHorizontal: 6,
            paddingVertical: 4,
        },
        // Selected filter: Signal Gold Soft with ink text (selection, not action).
        tabItemActive: {
            backgroundColor: theme.brandAmberLight,
            borderColor: theme.brandAmber,
        },
        tabItemText: {
            color: theme.textSecondary,
            fontSize: 14,
            fontWeight: '500',
            textAlign: 'center',
        },
        tabItemTextActive: {
            color: theme.textPrimary,
            fontWeight: '700',
        },
        scrollView: {
            flex: 1,
        },
        scrollContent: {
            padding: 16,
            paddingBottom: 40,
        },
        jobCardWrapper: {
            gap: 12,
            marginBottom: 16,
        },
        // Resting panel: border only, no shadow.
        emptyCard: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: 16,
            borderWidth: 1,
            marginTop: 24,
            padding: 32,
        },
        emptyIconCircle: {
            alignItems: 'center',
            backgroundColor: theme.surfaceHighlight,
            borderRadius: 30,
            height: 60,
            justifyContent: 'center',
            marginBottom: 16,
            width: 60,
        },
        emptyTitle: {
            color: theme.textPrimary,
            fontSize: 17,
            fontWeight: '700',
            marginBottom: 8,
            textAlign: 'center',
        },
        emptySubtext: {
            color: theme.textSecondary,
            fontSize: 14,
            lineHeight: 20,
            textAlign: 'center',
        },
    });
