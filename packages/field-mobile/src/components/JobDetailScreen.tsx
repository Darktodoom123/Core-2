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
import { AssignmentResponseCard } from './AssignmentResponseCard';
import { CommandConflictBanner } from './CommandConflictBanner';
import { FieldProgressionStepper } from './FieldProgressionStepper';
import { LocationSharingCard } from './LocationSharingCard';
import { colors, sharedStyles } from './nativeStyles';

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
    const requirements = Array.isArray(job.requirements)
        ? job.requirements.filter(
              (requirement): requirement is string =>
                  typeof requirement === 'string' &&
                  requirement.trim().length > 0,
          )
        : [];

    return (
        <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={styles.content}
            accessibilityLabel={`Assignment ${job.reference}`}
        >
            <Pressable
                accessibilityLabel="Back to assigned jobs"
                accessibilityRole="button"
                onPress={onBackToList}
                style={({ pressed }) => [
                    sharedStyles.button,
                    styles.backButton,
                    pressed && styles.pressed,
                ]}
            >
                <Text style={styles.backButtonText}>Back to assignments</Text>
            </Pressable>

            <CommandConflictBanner
                conflictedCommands={jobConflicts}
                onAcceptServerState={onAcceptServerState}
                onRetryNewVersion={onRetryNewVersion}
            />

            <View style={styles.headerCard}>
                <View style={styles.headerRow}>
                    <Text selectable style={styles.reference}>
                        {job.reference}
                    </Text>
                    <View style={styles.statusBadge}>
                        <View style={styles.statusMark} />
                        <Text style={styles.statusText}>
                            {job.status.label}
                        </Text>
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
                    <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Version</Text>
                        <Text selectable style={styles.metaValue}>
                            {job.version}
                        </Text>
                    </View>
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
    backButton: {
        alignSelf: 'flex-start',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 8,
        minHeight: 48,
        marginBottom: 16,
    },
    backButtonText: {
        color: colors.amberDark,
        fontSize: 14,
        fontWeight: '700',
    },
    headerCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 16,
        padding: 16,
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
        gap: 8,
        justifyContent: 'space-between',
    },
    reference: {
        color: colors.blueDark,
        flexShrink: 1,
        fontSize: 21,
        fontWeight: '800',
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
