import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AssignmentResponseCard } from '../components/cards/AssignmentResponseCard';
import { JobListItemCard } from '../components/cards/JobListItemCard';
import { Icon } from '../components/common/Icon';
import { TileScreenHeader } from '../components/layout/tile-screen-header';
import { colors, shadows } from '../components/nativeStyles';
import { useTheme } from '../theme';
import type {
    DispatchJob,
    DispatchStatus,
    OutboxCommand,
} from '../types/index';

export interface DispatchOrdersScreenProps {
    jobs: DispatchJob[];
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
    onOpenRoutes?: () => void;
    conflictedCommands?: OutboxCommand[];
    onAcceptServerState?: (commandId: string) => void;
    onRetryNewVersion?: (commandId: string, newVersion: number) => void;
    testID?: string;
    backTestID?: string;
}

export const DispatchOrdersScreen: React.FC<DispatchOrdersScreenProps> = ({
    jobs,
    onBack,
    onAcceptAssignment,
    onRejectAssignment,
    onSelectJob,
    onTransitionStatus,
    onOpenRoutes,
    conflictedCommands,
    onAcceptServerState,
    onRetryNewVersion,
    testID = 'dispatch-orders-screen',
    backTestID = 'dispatch-back-btn',
}) => {
    const { isDarkHud } = useTheme();

    const pendingJobs = jobs.filter(
        (job) => job.my_assignment?.response_status === 'pending',
    );
    const [userTab, setUserTab] = useState<'pending' | 'all' | null>(null);

    const selectedTab = userTab ?? (pendingJobs.length > 0 ? 'pending' : 'all');
    const displayedJobs = selectedTab === 'pending' ? pendingJobs : jobs;

    return (
        <View
            style={[styles.screenRoot, isDarkHud && styles.darkScreenRoot]}
            testID={testID}
        >
            {/* Unified Tile Screen Header */}
            <TileScreenHeader
                backAccessibilityHint="Returns to dashboard launcher"
                backAccessibilityLabel="Back to dashboard"
                backTestID={backTestID}
                category="Central Dispatch"
                categoryColor={isDarkHud ? '#60A5FA' : '#2563EB'}
                onBack={onBack}
                rightElement={
                    <View
                        style={[
                            styles.headerBadge,
                            isDarkHud && styles.darkHeaderBadge,
                        ]}
                    >
                        <View
                            style={[
                                styles.headerBadgeDot,
                                {
                                    backgroundColor:
                                        pendingJobs.length > 0
                                            ? '#F59E0B'
                                            : '#10B981',
                                },
                            ]}
                        />
                        <Text
                            style={[
                                styles.headerBadgeText,
                                isDarkHud && styles.darkHeaderBadgeText,
                            ]}
                        >
                            {pendingJobs.length > 0
                                ? `${pendingJobs.length} PENDING`
                                : 'ALL CLEAR'}
                        </Text>
                    </View>
                }
                subtitle={`${pendingJobs.length} needs response · ${jobs.length} total orders`}
                title="Dispatch Intake & Orders"
            />

            {/* Segmented Filter Tab Rail */}
            <View
                style={[
                    styles.tabRailContainer,
                    isDarkHud && styles.darkTabRailContainer,
                ]}
            >
                <Pressable
                    accessibilityLabel={`Pending response tab, ${pendingJobs.length} orders`}
                    accessibilityRole="button"
                    onPress={() => setUserTab('pending')}
                    style={[
                        styles.tabItem,
                        selectedTab === 'pending' && styles.tabItemActive,
                        isDarkHud &&
                            selectedTab === 'pending' &&
                            styles.darkTabItemActive,
                    ]}
                    testID="intake-tab-pending"
                >
                    <Text
                        style={[
                            styles.tabItemText,
                            isDarkHud && styles.darkTabItemText,
                            selectedTab === 'pending' &&
                                styles.tabItemTextActive,
                            isDarkHud &&
                                selectedTab === 'pending' &&
                                styles.darkTabItemTextActive,
                        ]}
                    >
                        Needs Response ({pendingJobs.length})
                    </Text>
                </Pressable>

                <Pressable
                    accessibilityLabel={`All orders tab, ${jobs.length} orders`}
                    accessibilityRole="button"
                    onPress={() => setUserTab('all')}
                    style={[
                        styles.tabItem,
                        selectedTab === 'all' && styles.tabItemActive,
                        isDarkHud &&
                            selectedTab === 'all' &&
                            styles.darkTabItemActive,
                    ]}
                    testID="intake-tab-all"
                >
                    <Text
                        style={[
                            styles.tabItemText,
                            isDarkHud && styles.darkTabItemText,
                            selectedTab === 'all' && styles.tabItemTextActive,
                            isDarkHud &&
                                selectedTab === 'all' &&
                                styles.darkTabItemTextActive,
                        ]}
                    >
                        All Orders ({jobs.length})
                    </Text>
                </Pressable>
            </View>

            {/* Scrollable Orders List */}
            <ScrollView
                accessibilityLabel="Dispatch orders list"
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                style={styles.scrollView}
            >
                {displayedJobs.length === 0 ? (
                    <View
                        style={[
                            styles.emptyCard,
                            isDarkHud && styles.darkEmptyCard,
                        ]}
                        testID="dispatch-intake-empty"
                    >
                        <View
                            style={[
                                styles.emptyIconCircle,
                                isDarkHud && styles.darkEmptyIconCircle,
                            ]}
                        >
                            <Icon
                                color={isDarkHud ? '#60A5FA' : '#2563EB'}
                                name="clipboard"
                                size={28}
                            />
                        </View>
                        <Text
                            style={[
                                styles.emptyTitle,
                                isDarkHud && styles.darkEmptyTitle,
                            ]}
                        >
                            {selectedTab === 'pending'
                                ? 'No Orders Pending Response'
                                : 'No Dispatch Orders Found'}
                        </Text>
                        <Text
                            style={[
                                styles.emptySubtext,
                                isDarkHud && styles.darkEmptySubtext,
                            ]}
                        >
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

                        return (
                            <View
                                key={job.id}
                                style={styles.jobCardWrapper}
                                testID={`dispatch-intake-job-${job.id}`}
                            >
                                {/* High-priority response card for pending orders */}
                                {isPending &&
                                onAcceptAssignment &&
                                onRejectAssignment ? (
                                    <AssignmentResponseCard
                                        job={job}
                                        onAccept={onAcceptAssignment}
                                        onReject={onRejectAssignment}
                                    />
                                ) : null}

                                {/* Full Job Detail Card */}
                                <JobListItemCard
                                    conflictedCommands={jobConflictedCommands}
                                    job={job}
                                    onAcceptAssignment={
                                        isPending
                                            ? undefined
                                            : onAcceptAssignment
                                    }
                                    onAcceptServerState={onAcceptServerState}
                                    onOpenDriveRoutes={onOpenRoutes}
                                    onRejectAssignment={
                                        isPending
                                            ? undefined
                                            : onRejectAssignment
                                    }
                                    onRetryNewVersion={onRetryNewVersion}
                                    onSelectJob={onSelectJob}
                                    onTransitionStatus={onTransitionStatus}
                                />
                            </View>
                        );
                    })
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    screenRoot: {
        backgroundColor: colors.background,
        flex: 1,
    },
    darkScreenRoot: {
        backgroundColor: colors.hudBackground,
    },
    headerBadge: {
        alignItems: 'center',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        borderColor: 'rgba(37, 99, 235, 0.25)',
        borderRadius: 14,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    darkHeaderBadge: {
        backgroundColor: 'rgba(96, 165, 250, 0.15)',
        borderColor: 'rgba(96, 165, 250, 0.3)',
    },
    headerBadgeDot: {
        borderRadius: 4,
        height: 8,
        width: 8,
    },
    headerBadgeText: {
        color: '#2563EB',
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.4,
    },
    darkHeaderBadgeText: {
        color: '#93C5FD',
    },
    tabRailContainer: {
        backgroundColor: '#E2E8F0',
        borderRadius: 12,
        flexDirection: 'row',
        marginHorizontal: 16,
        marginTop: 12,
        padding: 4,
    },
    darkTabRailContainer: {
        backgroundColor: '#1E293B',
    },
    tabItem: {
        alignItems: 'center',
        borderRadius: 8,
        flex: 1,
        paddingVertical: 8,
    },
    tabItemActive: {
        backgroundColor: '#2563EB',
        ...shadows.sm,
    },
    darkTabItemActive: {
        backgroundColor: '#2563EB',
    },
    tabItemText: {
        color: '#64748B',
        fontSize: 13,
        fontWeight: '700',
    },
    darkTabItemText: {
        color: '#94A3B8',
    },
    tabItemTextActive: {
        color: '#FFFFFF',
    },
    darkTabItemTextActive: {
        color: '#FFFFFF',
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
    emptyCard: {
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E8F0',
        borderRadius: 16,
        borderWidth: 1,
        marginTop: 24,
        padding: 32,
    },
    darkEmptyCard: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    emptyIconCircle: {
        alignItems: 'center',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        borderRadius: 30,
        height: 60,
        justifyContent: 'center',
        marginBottom: 16,
        width: 60,
    },
    darkEmptyIconCircle: {
        backgroundColor: 'rgba(96, 165, 250, 0.15)',
    },
    emptyTitle: {
        color: '#0F172A',
        fontSize: 17,
        fontWeight: '800',
        marginBottom: 8,
        textAlign: 'center',
    },
    darkEmptyTitle: {
        color: '#F8FAFC',
    },
    emptySubtext: {
        color: '#64748B',
        fontSize: 13.5,
        lineHeight: 20,
        textAlign: 'center',
    },
    darkEmptySubtext: {
        color: '#94A3B8',
    },
});
