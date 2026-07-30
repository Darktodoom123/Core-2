import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
}) => {
    const jobConflicts = outboxCommands.filter(
        (command) => command.state === 'conflict' && command.jobId === job.id,
    );

    return (
        <ScrollView
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
                <Text style={sharedStyles.buttonText}>Back to assignments</Text>
            </Pressable>

            <CommandConflictBanner
                conflictedCommands={jobConflicts}
                onAcceptServerState={onAcceptServerState}
                onRetryNewVersion={onRetryNewVersion}
            />

            <View style={styles.headerCard}>
                <View style={styles.headerRow}>
                    <Text style={styles.reference}>{job.reference}</Text>
                    <Text style={styles.statusBadge}>
                        {job.status.label} · v{job.version}
                    </Text>
                </View>
                <Text style={styles.title}>
                    {job.title} — {job.client}
                </Text>
                <Text style={styles.site}>Site location: {job.site}</Text>
                {job.site_notes ? (
                    <Text style={styles.notes}>
                        Site notes: {job.site_notes}
                    </Text>
                ) : null}
                {job.scheduled_start ? (
                    <Text style={styles.notes}>
                        Scheduled start:{' '}
                        {new Date(job.scheduled_start).toLocaleString()}
                    </Text>
                ) : null}
            </View>

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
            />

            <View style={styles.teamCard}>
                <Text accessibilityRole="header" style={styles.sectionHeading}>
                    Team and asset assignments
                </Text>
                <Text style={styles.label}>Assigned assets</Text>
                {job.asset_assignments && job.asset_assignments.length > 0 ? (
                    job.asset_assignments.map((asset) => (
                        <Text key={asset.id} style={styles.listItem}>
                            • [{asset.asset_code}] {asset.asset_name} (
                            {asset.asset_kind})
                        </Text>
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
                        <Text key={person.id} style={styles.listItem}>
                            • {person.user_name} —{' '}
                            {person.response_status_label}
                        </Text>
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
        maxWidth: 1040,
        padding: 16,
        paddingBottom: 32,
        width: '100%',
    },
    backButton: {
        alignSelf: 'flex-start',
        backgroundColor: colors.surfaceMuted,
        marginBottom: 16,
    },
    headerCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 10,
        borderWidth: 1,
        marginBottom: 16,
        padding: 18,
    },
    headerRow: {
        alignItems: 'flex-start',
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'space-between',
    },
    reference: {
        color: colors.blue,
        flexShrink: 1,
        fontSize: 21,
        fontWeight: '800',
    },
    statusBadge: {
        backgroundColor: colors.blueSoft,
        borderRadius: 14,
        color: colors.blue,
        fontSize: 12,
        fontWeight: '800',
        overflow: 'hidden',
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    title: {
        color: colors.text,
        fontSize: 17,
        fontWeight: '800',
        lineHeight: 23,
        marginTop: 12,
    },
    site: {
        color: colors.text,
        fontSize: 14,
        lineHeight: 20,
        marginTop: 10,
    },
    notes: {
        color: colors.secondary,
        fontSize: 13,
        fontStyle: 'italic',
        lineHeight: 19,
        marginTop: 6,
    },
    teamCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 10,
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
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 4,
    },
    emptyText: {
        color: colors.muted,
        fontSize: 14,
    },
    pressed: {
        opacity: 0.78,
    },
});
