import React, { useEffect } from 'react';
import {
    AppState,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import type { AppStateStatus } from 'react-native';
import {
    startBackgroundLocationUpdates,
    stopBackgroundLocationUpdates,
} from '../native/backgroundLocationBridge';
import type {
    LocationCoordinates,
    LocationSharingService,
} from '../services/locationService';
import type {
    DispatchJob,
    DispatchStatus,
    OutboxCommand,
    User,
} from '../types/index';
import { AssignmentResponseCard } from '../components/cards/AssignmentResponseCard';
import { CommandConflictBanner } from '../components/panels/CommandConflictBanner';
import { FieldProgressionStepper } from '../components/layout/FieldProgressionStepper';
import { HeavyCraneRouteCard } from '../components/cards/HeavyCraneRouteCard';
import { LocationSharingCard } from '../components/cards/LocationSharingCard';
import { colors, sharedStyles } from '../components/nativeStyles';

export interface JobDetailScreenProps {
    job: DispatchJob;
    user: User;
    outboxCommands: OutboxCommand[];
    locationService: LocationSharingService;
    getCurrentLocation?: () => Promise<LocationCoordinates>;
    onBackToList: () => void;
    onAcceptAssignment: (
        jobId: number,
        assignmentId: number,
        version: number,
    ) => void;
    onRejectAssignment: (
        jobId: number,
        assignmentId: number,
        reason: string,
        version: number,
    ) => void;
    onTransitionStatus: (
        jobId: number,
        nextStatus: DispatchStatus,
        version: number,
    ) => void;
    onAcceptServerState: (commandId: string) => void;
    onRetryNewVersion: (commandId: string, newVersion: number) => void;
    onLocationQueued?: (commandId: string) => void;
}

export const JobDetailScreen: React.FC<JobDetailScreenProps> = ({
    job,
    user,
    outboxCommands,
    locationService,
    getCurrentLocation,
    onBackToList,
    onAcceptAssignment,
    onRejectAssignment,
    onTransitionStatus,
    onAcceptServerState,
    onRetryNewVersion,
    onLocationQueued,
}) => {
    useEffect(() => {
        if (
            !getCurrentLocation ||
            !locationService.canShareLocation(user, job)
        ) {
            return;
        }

        let disposed = false;
        const context = { actorId: user.id, jobId: job.id };
        const startForegroundTracking = () => {
            if (!disposed) {
                locationService.startAutoTracking(
                    user,
                    job,
                    getCurrentLocation,
                );
            }
        };
        const syncBackgroundTracking = (nextState: AppStateStatus) => {
            if (disposed) {
                return;
            }

            if (nextState === 'active') {
                void stopBackgroundLocationUpdates().catch(() => undefined);
                startForegroundTracking();

                return;
            }

            locationService.stopAutoTracking();
            void startBackgroundLocationUpdates(context).catch(() => undefined);
        };

        if (AppState.currentState === 'active') {
            startForegroundTracking();
        } else {
            syncBackgroundTracking(AppState.currentState);
        }

        const subscription = AppState.addEventListener(
            'change',
            syncBackgroundTracking,
        );

        return () => {
            disposed = true;
            subscription.remove();
            locationService.stopAutoTracking();
            void stopBackgroundLocationUpdates().catch(() => undefined);
        };
    }, [getCurrentLocation, job, locationService, user]);

    const jobConflicts = outboxCommands.filter(
        (command) => command.state === 'conflict' && command.jobId === job.id,
    );
    const jobPendingCommands = outboxCommands.filter(
        (command) =>
            command.jobId === job.id &&
            (command.state === 'queued' || command.state === 'syncing'),
    );
    const primaryAsset = job.asset_assignments?.[0] ?? null;
    const isResponsePending = job.my_assignment?.response_status === 'pending';
    const requirements = Array.isArray(job.requirements)
        ? job.requirements.filter(
              (requirement): requirement is string =>
                  typeof requirement === 'string' &&
                  requirement.trim().length > 0,
          )
        : [];
    const priorityStyle =
        job.priority.value === 'emergency'
            ? styles.emergencyPriority
            : job.priority.value === 'priority'
              ? styles.priorityPriority
              : styles.routinePriority;

    return (
        <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={styles.content}
            accessibilityLabel={`Assignment ${job.reference}`}
        >
            <View style={styles.screenHeader}>
                <Pressable
                    accessibilityLabel="Back to assigned jobs"
                    accessibilityRole="button"
                    onPress={onBackToList}
                    style={({ pressed }) => [
                        styles.backButton,
                        pressed && styles.pressed,
                    ]}
                >
                    <Text style={styles.backIcon}>‹</Text>
                    <Text style={styles.backButtonText}>Back</Text>
                </Pressable>
                <Text accessibilityRole="header" style={styles.screenTitle}>
                    {isResponsePending ? 'RESPOND' : 'PROGRESS'}
                </Text>
                <View style={styles.headerSpacer} />
            </View>

            <CommandConflictBanner
                conflictedCommands={jobConflicts}
                onAcceptServerState={onAcceptServerState}
                onRetryNewVersion={onRetryNewVersion}
            />

            <View
                accessible
                accessibilityLiveRegion="polite"
                accessibilityRole="summary"
                style={[
                    styles.syncBanner,
                    jobConflicts.length > 0 && styles.syncBannerConflict,
                    jobPendingCommands.length > 0 && styles.syncBannerPending,
                ]}
                testID="job-sync-banner"
            >
                <View
                    style={[
                        styles.syncMark,
                        jobConflicts.length > 0 && styles.syncMarkConflict,
                        jobPendingCommands.length > 0 && styles.syncMarkPending,
                    ]}
                >
                    <Text style={styles.syncMarkText}>
                        {jobConflicts.length > 0 ? '!' : '✓'}
                    </Text>
                </View>
                <View style={styles.syncCopy}>
                    <Text style={styles.syncLabel}>
                        {jobConflicts.length > 0
                            ? 'Conflict-safe'
                            : jobPendingCommands.length > 0
                              ? 'Syncing'
                              : 'Synced'}
                    </Text>
                    <Text style={styles.syncMeta}>
                        {jobConflicts.length > 0
                            ? 'Review the server state before saving.'
                            : jobPendingCommands.length > 0
                              ? 'Saved action is waiting for server confirmation.'
                              : 'Current assignment data is up to date.'}
                    </Text>
                </View>
            </View>

            <View style={styles.headerCard}>
                <View style={styles.headerRow}>
                    <View style={styles.referenceBlock}>
                        <Text selectable style={styles.reference}>
                            {job.reference}
                        </Text>
                        <Text selectable style={styles.versionText}>
                            Record version {job.version}
                        </Text>
                    </View>
                    <View style={styles.badgeGroup}>
                        <Text style={[styles.priorityBadge, priorityStyle]}>
                            {job.priority.label}
                        </Text>
                        <View style={styles.statusBadge}>
                            <View style={styles.statusMark} />
                            <Text style={styles.statusText}>
                                {job.status.label}
                            </Text>
                        </View>
                    </View>
                </View>
                <Text style={styles.title}>
                    {job.title} — {job.client}
                </Text>
                <View style={styles.jobMeta}>
                    <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Site</Text>
                        <Text selectable style={styles.metaValue}>
                            {job.site}
                        </Text>
                    </View>
                    {job.scheduled_start ? (
                        <View style={styles.metaRow}>
                            <Text style={styles.metaLabel}>Starts</Text>
                            <Text selectable style={styles.metaValue}>
                                {new Date(job.scheduled_start).toLocaleString()}
                            </Text>
                        </View>
                    ) : null}
                </View>
                {job.site_notes ? (
                    <View style={styles.siteNotes}>
                        <Text style={styles.siteNotesLabel}>Site notes</Text>
                        <Text selectable style={styles.siteNotesText}>
                            {job.site_notes}
                        </Text>
                    </View>
                ) : null}
            </View>

            {primaryAsset ? (
                <View style={styles.assetCard} testID="assigned-asset-card">
                    <View style={styles.assetIcon}>
                        <Text style={styles.assetIconText}>CR</Text>
                    </View>
                    <View style={styles.assetCopy}>
                        <Text style={styles.assetLabel}>
                            {primaryAsset.asset_kind === 'crane'
                                ? 'Assigned crane'
                                : 'Assigned asset'}
                        </Text>
                        <Text selectable style={styles.assetName}>
                            {primaryAsset.asset_code}
                        </Text>
                        <Text selectable style={styles.assetDetail}>
                            {primaryAsset.asset_name} ·{' '}
                            {primaryAsset.asset_kind}
                        </Text>
                    </View>
                </View>
            ) : null}

            {requirements.length > 0 ? (
                <View style={styles.requirementsCard}>
                    <Text
                        accessibilityRole="header"
                        style={styles.sectionHeading}
                    >
                        Job requirements
                    </Text>
                    {requirements.map((requirement, index) => (
                        <View
                            key={`${job.id}-requirement-${index}`}
                            style={styles.requirementRow}
                        >
                            <View style={styles.requirementMark} />
                            <Text selectable style={styles.requirementText}>
                                {requirement}
                            </Text>
                        </View>
                    ))}
                </View>
            ) : null}

            <AssignmentResponseCard
                job={job}
                onAccept={onAcceptAssignment}
                onReject={onRejectAssignment}
            />
            <FieldProgressionStepper
                job={job}
                onTransitionStatus={onTransitionStatus}
            />
            {primaryAsset?.asset_kind === 'crane' ? (
                <HeavyCraneRouteCard
                    assetLabel={`${primaryAsset.asset_code} · ${primaryAsset.asset_name}`}
                    destinationLabel={job.site}
                    status="unavailable"
                />
            ) : null}
            <LocationSharingCard
                user={user}
                job={job}
                locationService={locationService}
                getCurrentLocation={getCurrentLocation}
                onLocationQueued={onLocationQueued}
            />

            <View style={styles.teamCard}>
                <Text accessibilityRole="header" style={styles.sectionHeading}>
                    Team and asset assignments
                </Text>
                <Text style={styles.label}>Assigned assets</Text>
                {job.asset_assignments && job.asset_assignments.length > 0 ? (
                    job.asset_assignments.map((asset) => (
                        <View key={asset.id} style={styles.assignmentRow}>
                            <View style={styles.assignmentMark} />
                            <Text selectable style={styles.listItem}>
                                [{asset.asset_code}] {asset.asset_name} (
                                {asset.asset_kind})
                            </Text>
                        </View>
                    ))
                ) : (
                    <Text style={styles.emptyText}>None assigned</Text>
                )}

                <Text style={[styles.label, styles.personnelLabel]}>
                    Assigned personnel
                </Text>
                {job.personnel_assignments &&
                job.personnel_assignments.length > 0 ? (
                    job.personnel_assignments.map((person) => (
                        <View key={person.id} style={styles.assignmentRow}>
                            <View style={styles.assignmentMark} />
                            <Text selectable style={styles.listItem}>
                                {person.user_name} —{' '}
                                {person.response_status_label}
                            </Text>
                        </View>
                    ))
                ) : (
                    <Text style={styles.emptyText}>None assigned</Text>
                )}
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
    screenHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
        minHeight: 44,
    },
    backButton: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 4,
        minHeight: 48,
        minWidth: 72,
        paddingHorizontal: 4,
    },
    backIcon: {
        color: colors.text,
        fontSize: 30,
        fontWeight: '400',
        lineHeight: 34,
    },
    backButtonText: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '700',
    },
    screenTitle: {
        color: colors.text,
        fontSize: 20,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    headerSpacer: {
        minWidth: 72,
    },
    syncBanner: {
        alignItems: 'center',
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 10,
        marginBottom: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    syncBannerPending: {
        backgroundColor: colors.amberLight,
        borderColor: colors.amberBorder,
    },
    syncBannerConflict: {
        backgroundColor: colors.warningLight,
        borderColor: colors.warningBorder,
    },
    syncMark: {
        alignItems: 'center',
        backgroundColor: colors.green,
        borderRadius: 10,
        height: 20,
        justifyContent: 'center',
        width: 20,
    },
    syncMarkPending: {
        backgroundColor: colors.amber,
    },
    syncMarkConflict: {
        backgroundColor: colors.warning,
    },
    syncMarkText: {
        color: colors.white,
        fontSize: 12,
        fontWeight: '900',
    },
    syncCopy: {
        flex: 1,
        gap: 1,
    },
    syncLabel: {
        color: colors.greenDark,
        fontSize: 13,
        fontWeight: '800',
    },
    syncMeta: {
        color: colors.secondary,
        fontSize: 12,
        lineHeight: 17,
    },
    headerCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 16,
        padding: 16,
    },
    assetCard: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
        padding: 14,
    },
    assetIcon: {
        alignItems: 'center',
        backgroundColor: colors.amberSoft,
        borderRadius: 24,
        height: 48,
        justifyContent: 'center',
        width: 48,
    },
    assetIconText: {
        color: colors.amberDark,
        fontSize: 12,
        fontWeight: '900',
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
    assetName: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '800',
    },
    assetDetail: {
        color: colors.secondary,
        fontSize: 13,
        lineHeight: 18,
    },
    requirementsCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 16,
        padding: 16,
    },
    requirementRow: {
        alignItems: 'flex-start',
        flexDirection: 'row',
        gap: 10,
        marginTop: 10,
    },
    requirementMark: {
        backgroundColor: colors.amber,
        borderRadius: 4,
        height: 8,
        marginTop: 6,
        width: 8,
    },
    requirementText: {
        color: colors.secondary,
        flex: 1,
        fontSize: 14,
        lineHeight: 20,
    },
    headerRow: {
        alignItems: 'flex-start',
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'space-between',
    },
    referenceBlock: {
        flex: 1,
        minWidth: 140,
    },
    reference: {
        color: colors.blueDark,
        flexShrink: 1,
        fontSize: 21,
        fontWeight: '800',
    },
    versionText: {
        color: colors.muted,
        fontSize: 12,
        fontWeight: '700',
        marginTop: 3,
    },
    badgeGroup: {
        alignItems: 'flex-end',
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        justifyContent: 'flex-end',
    },
    priorityBadge: {
        borderRadius: 999,
        fontSize: 11,
        fontWeight: '800',
        overflow: 'hidden',
        paddingHorizontal: 9,
        paddingVertical: 6,
        textTransform: 'uppercase',
    },
    emergencyPriority: {
        backgroundColor: colors.redSoft,
        color: colors.redDark,
    },
    priorityPriority: {
        backgroundColor: colors.warningSoft,
        color: colors.warningDark,
    },
    routinePriority: {
        backgroundColor: colors.surfaceMuted,
        color: colors.secondary,
    },
    statusBadge: {
        alignItems: 'center',
        backgroundColor: colors.blueSoft,
        borderRadius: 999,
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    statusMark: {
        backgroundColor: colors.blue,
        borderRadius: 4,
        height: 8,
        width: 8,
    },
    statusText: {
        color: colors.blueDark,
        fontSize: 12,
        fontWeight: '800',
    },
    title: {
        color: colors.text,
        fontSize: 17,
        fontWeight: '800',
        lineHeight: 23,
        marginTop: 12,
    },
    jobMeta: {
        borderTopColor: colors.border,
        borderTopWidth: 1,
        gap: 8,
        marginTop: 16,
        paddingTop: 14,
    },
    metaRow: {
        alignItems: 'flex-start',
        flexDirection: 'row',
        gap: 12,
    },
    metaLabel: {
        color: colors.muted,
        fontSize: 13,
        fontWeight: '700',
        width: 56,
    },
    metaValue: {
        color: colors.secondary,
        flex: 1,
        fontSize: 13,
        lineHeight: 19,
        fontVariant: ['tabular-nums'],
    },
    siteNotes: {
        backgroundColor: colors.surfaceMuted,
        borderRadius: 8,
        marginTop: 14,
        padding: 12,
    },
    siteNotesLabel: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '800',
    },
    siteNotesText: {
        color: colors.secondary,
        fontSize: 13,
        lineHeight: 19,
        marginTop: 4,
    },
    teamCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
    },
    sectionHeading: {
        color: colors.text,
        fontSize: 17,
        fontWeight: '800',
        marginBottom: 14,
    },
    label: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '800',
        marginBottom: 6,
    },
    personnelLabel: {
        marginTop: 16,
    },
    listItem: {
        color: colors.secondary,
        flex: 1,
        fontSize: 14,
        lineHeight: 20,
    },
    assignmentRow: {
        alignItems: 'flex-start',
        flexDirection: 'row',
        gap: 10,
        marginBottom: 6,
    },
    assignmentMark: {
        backgroundColor: colors.borderStrong,
        borderRadius: 4,
        height: 8,
        marginTop: 6,
        width: 8,
    },
    emptyText: {
        color: colors.muted,
        fontSize: 14,
    },
    pressed: {
        opacity: 0.78,
    },
});
