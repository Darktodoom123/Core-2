import React, { useState } from 'react';
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import type {
    DispatchJob,
    DispatchStatus,
    OutboxCommand,
} from '../../types/index';
import { AssignmentResponseCard } from '../cards/AssignmentResponseCard';
import { JobListItemCard } from '../cards/JobListItemCard';
import { Icon } from '../common/Icon';
import { shadows } from '../nativeStyles';

export interface DispatchIntakeSheetProps {
    visible: boolean;
    onClose: () => void;
    jobs: DispatchJob[];
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
}

export const DispatchIntakeSheet: React.FC<DispatchIntakeSheetProps> = ({
    visible,
    onClose,
    jobs,
    onAcceptAssignment,
    onRejectAssignment,
    onSelectJob,
    onTransitionStatus,
    onOpenRoutes,
    conflictedCommands,
    onAcceptServerState,
    onRetryNewVersion,
}) => {
    const { isDarkHud } = useTheme();
    const insets = useSafeAreaInsets();
    const pendingJobs = jobs.filter(
        (job) => job.my_assignment?.response_status === 'pending',
    );
    const [userTab, setUserTab] = useState<'pending' | 'all' | null>(null);
    const [prevVisible, setPrevVisible] = useState(visible);

    if (visible !== prevVisible) {
        setPrevVisible(visible);
        setUserTab(null);
    }

    const selectedTab = userTab ?? (pendingJobs.length > 0 ? 'pending' : 'all');
    const setSelectedTab = setUserTab;

    const displayedJobs = selectedTab === 'pending' ? pendingJobs : jobs;

    return (
        <Modal
            animationType="slide"
            onRequestClose={onClose}
            transparent
            visible={visible}
        >
            <View style={styles.overlay} testID="dispatch-intake-sheet">
                <Pressable
                    accessibilityLabel="Close dispatch intake sheet backdrop"
                    accessibilityRole="button"
                    onPress={onClose}
                    style={styles.backdrop}
                />
                <View
                    style={[
                        styles.sheetContainer,
                        isDarkHud && styles.darkSheetContainer,
                        { paddingBottom: Math.max(insets.bottom, 16) },
                    ]}
                >
                    {/* Drag Handle Indicator */}
                    <View style={styles.handleBar} />

                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <View
                                style={[
                                    styles.iconCircle,
                                    isDarkHud && styles.darkIconCircle,
                                ]}
                            >
                                <Icon
                                    color={isDarkHud ? '#38BDF8' : '#0284C7'}
                                    name="file-text"
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
                                    Dispatch Intake &amp; Orders
                                </Text>
                                <Text
                                    style={[
                                        styles.subtitle,
                                        isDarkHud && styles.darkSubtitle,
                                    ]}
                                >
                                    Review &amp; accept central dispatch
                                    assignments
                                </Text>
                            </View>
                        </View>

                        <Pressable
                            accessibilityLabel="Close dispatch intake sheet"
                            accessibilityRole="button"
                            onPress={onClose}
                            style={({ pressed }) => [
                                styles.closeButton,
                                isDarkHud && styles.darkCloseButton,
                                pressed && styles.pressed,
                            ]}
                            testID="close-dispatch-intake-btn"
                        >
                            <Icon
                                color={isDarkHud ? '#94A3B8' : '#64748B'}
                                name="close"
                                size={20}
                            />
                        </Pressable>
                    </View>

                    {/* Filter Tabs */}
                    <View
                        style={[
                            styles.tabsRow,
                            isDarkHud && styles.darkTabsRow,
                        ]}
                    >
                        <Pressable
                            accessibilityLabel={`Pending review tab, ${pendingJobs.length} orders`}
                            accessibilityRole="button"
                            onPress={() => setSelectedTab('pending')}
                            style={[
                                styles.tabButton,
                                selectedTab === 'pending' &&
                                    styles.tabButtonActive,
                                isDarkHud &&
                                    selectedTab === 'pending' &&
                                    styles.darkTabButtonActive,
                            ]}
                            testID="intake-tab-pending"
                        >
                            <Text
                                style={[
                                    styles.tabButtonText,
                                    isDarkHud && styles.darkTabButtonText,
                                    selectedTab === 'pending' &&
                                        styles.tabButtonTextActive,
                                    isDarkHud &&
                                        selectedTab === 'pending' &&
                                        styles.darkTabButtonTextActive,
                                ]}
                            >
                                Needs Response ({pendingJobs.length})
                            </Text>
                        </Pressable>

                        <Pressable
                            accessibilityLabel={`All orders tab, ${jobs.length} orders`}
                            accessibilityRole="button"
                            onPress={() => setSelectedTab('all')}
                            style={[
                                styles.tabButton,
                                selectedTab === 'all' && styles.tabButtonActive,
                                isDarkHud &&
                                    selectedTab === 'all' &&
                                    styles.darkTabButtonActive,
                            ]}
                            testID="intake-tab-all"
                        >
                            <Text
                                style={[
                                    styles.tabButtonText,
                                    isDarkHud && styles.darkTabButtonText,
                                    selectedTab === 'all' &&
                                        styles.tabButtonTextActive,
                                    isDarkHud &&
                                        selectedTab === 'all' &&
                                        styles.darkTabButtonTextActive,
                                ]}
                            >
                                All Orders ({jobs.length})
                            </Text>
                        </Pressable>
                    </View>

                    {/* Scrollable Orders List */}
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        style={styles.scrollView}
                    >
                        {displayedJobs.length === 0 ? (
                            <View
                                style={[
                                    styles.emptyState,
                                    isDarkHud && styles.darkEmptyState,
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
                                        color={
                                            isDarkHud ? '#34D399' : '#059669'
                                        }
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
                                        ? 'No Orders Pending Intake'
                                        : 'No Dispatch Orders Available'}
                                </Text>
                                <Text
                                    style={[
                                        styles.emptySub,
                                        isDarkHud && styles.darkEmptySub,
                                    ]}
                                >
                                    {selectedTab === 'pending'
                                        ? 'All dispatched orders have been reviewed. New incoming orders from central dispatch will appear here.'
                                        : 'There are currently no active or scheduled dispatch assignments.'}
                                </Text>
                            </View>
                        ) : (
                            displayedJobs.map((job) => {
                                const isPending =
                                    job.my_assignment?.response_status ===
                                    'pending';

                                const jobConflictedCommands =
                                    conflictedCommands?.filter(
                                        (command) =>
                                            command.jobId === job.id ||
                                            (command.payload as any)
                                                ?.dispatch_job_id === job.id ||
                                            (command.payload as any)?.jobId ===
                                                job.id ||
                                            (!command.jobId &&
                                                jobs.length === 1),
                                    );

                                return (
                                    <View
                                        key={job.id}
                                        style={styles.jobItemWrapper}
                                        testID={`dispatch-intake-job-${job.id}`}
                                    >
                                        {/* Assignment Response Callout for pending intake */}
                                        {isPending &&
                                        onAcceptAssignment &&
                                        onRejectAssignment ? (
                                            <AssignmentResponseCard
                                                job={job}
                                                onAccept={onAcceptAssignment}
                                                onReject={onRejectAssignment}
                                            />
                                        ) : null}

                                        {/* Comprehensive Scope & Equipment Details Card */}
                                        <JobListItemCard
                                            conflictedCommands={
                                                jobConflictedCommands
                                            }
                                            job={job}
                                            onAcceptAssignment={
                                                isPending
                                                    ? undefined
                                                    : onAcceptAssignment
                                            }
                                            onAcceptServerState={
                                                onAcceptServerState
                                            }
                                            onOpenDriveRoutes={onOpenRoutes}
                                            onRejectAssignment={
                                                isPending
                                                    ? undefined
                                                    : onRejectAssignment
                                            }
                                            onRetryNewVersion={
                                                onRetryNewVersion
                                            }
                                            onSelectJob={(jobId) => {
                                                onSelectJob?.(jobId);
                                                onClose();
                                            }}
                                            onTransitionStatus={
                                                onTransitionStatus
                                            }
                                        />
                                    </View>
                                );
                            })
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
    },
    sheetContainer: {
        backgroundColor: '#F8FAFC',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
        minHeight: 480,
        ...shadows.md,
    },
    darkSheetContainer: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
        borderTopWidth: 1,
    },
    handleBar: {
        alignSelf: 'center',
        backgroundColor: '#CBD5E1',
        borderRadius: 3,
        height: 5,
        marginTop: 10,
        width: 44,
    },
    header: {
        alignItems: 'center',
        borderBottomColor: '#E2E8F0',
        borderBottomWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    headerLeft: {
        alignItems: 'center',
        flexDirection: 'row',
        flex: 1,
        gap: 12,
    },
    iconCircle: {
        alignItems: 'center',
        backgroundColor: 'rgba(2, 132, 199, 0.12)',
        borderRadius: 20,
        height: 40,
        justifyContent: 'center',
        width: 40,
    },
    darkIconCircle: {
        backgroundColor: 'rgba(56, 189, 248, 0.18)',
    },
    headerTitles: {
        flex: 1,
    },
    title: {
        color: '#0F172A',
        fontSize: 17,
        fontWeight: '800',
        letterSpacing: -0.2,
    },
    darkTitle: {
        color: '#F8FAFC',
    },
    subtitle: {
        color: '#64748B',
        fontSize: 12,
        marginTop: 1,
    },
    darkSubtitle: {
        color: '#94A3B8',
    },
    closeButton: {
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        borderRadius: 18,
        height: 36,
        justifyContent: 'center',
        width: 36,
    },
    darkCloseButton: {
        backgroundColor: '#1E293B',
    },
    pressed: {
        opacity: 0.75,
    },
    tabsRow: {
        backgroundColor: '#E2E8F0',
        borderRadius: 10,
        flexDirection: 'row',
        marginHorizontal: 16,
        marginTop: 12,
        padding: 3,
    },
    darkTabsRow: {
        backgroundColor: '#1E293B',
    },
    tabButton: {
        alignItems: 'center',
        borderRadius: 8,
        flex: 1,
        paddingVertical: 8,
    },
    tabButtonActive: {
        backgroundColor: '#FFFFFF',
        ...shadows.sm,
    },
    darkTabButtonActive: {
        backgroundColor: '#334155',
    },
    tabButtonText: {
        color: '#64748B',
        fontSize: 12.5,
        fontWeight: '700',
    },
    darkTabButtonText: {
        color: '#94A3B8',
    },
    tabButtonTextActive: {
        color: '#0F172A',
    },
    darkTabButtonTextActive: {
        color: '#F8FAFC',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 32,
    },
    jobItemWrapper: {
        gap: 12,
        marginBottom: 16,
    },
    emptyState: {
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E8F0',
        borderRadius: 16,
        borderWidth: 1,
        marginTop: 20,
        padding: 28,
    },
    darkEmptyState: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    emptyIconCircle: {
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        borderRadius: 28,
        height: 56,
        justifyContent: 'center',
        marginBottom: 14,
        width: 56,
    },
    darkEmptyIconCircle: {
        backgroundColor: 'rgba(16, 185, 129, 0.16)',
    },
    emptyTitle: {
        color: '#0F172A',
        fontSize: 16,
        fontWeight: '800',
        marginBottom: 6,
        textAlign: 'center',
    },
    darkEmptyTitle: {
        color: '#F8FAFC',
    },
    emptySub: {
        color: '#64748B',
        fontSize: 13,
        lineHeight: 18,
        textAlign: 'center',
    },
    darkEmptySub: {
        color: '#94A3B8',
    },
});
