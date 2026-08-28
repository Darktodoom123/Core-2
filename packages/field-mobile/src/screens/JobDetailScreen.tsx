import React, { useEffect, useState } from 'react';
import {
    AppState,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import type { AppStateStatus } from 'react-native';
import { AssignmentResponseCard } from '../components/cards/AssignmentResponseCard';
import { ConstructionWorkingCard } from '../components/cards/ConstructionWorkingCard';
import { CraneSetupSafetyCard } from '../components/cards/CraneSetupSafetyCard';
import { HeavyCraneDriveModeModal } from '../components/cards/HeavyCraneDriveModeModal';
import { HeavyCraneRouteCard } from '../components/cards/HeavyCraneRouteCard';
import { LocationSharingCard } from '../components/cards/LocationSharingCard';
import { ParkedSecuredCard } from '../components/cards/ParkedSecuredCard';
import { TowerCraneWeatherCard } from '../components/cards/TowerCraneWeatherCard';
import { Icon } from '../components/common/Icon';
import { FieldProgressionStepper } from '../components/layout/FieldProgressionStepper';
import { colors, shadows } from '../components/nativeStyles';
import { CommandConflictBanner } from '../components/panels/CommandConflictBanner';
import { DigitalSignatureModal } from '../components/signature/DigitalSignatureModal';
import type { DigitalSignatureData } from '../components/signature/DigitalSignatureModal';
import {
    startBackgroundLocationUpdates,
    stopBackgroundLocationUpdates,
} from '../native/backgroundLocationBridge';
import type {
    LocationCoordinates,
    LocationSharingService,
} from '../services/locationService';
import type {
    CraneHazardItem,
    CraneSetupSafetyChecklist,
    CraneSetupState,
    DispatchJob,
    DispatchStatus,
    OutboxCommand,
    ParkedSecuredChecklist,
    ParkedSecuredState,
    User,
} from '../types/index';

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
        signatureData?: DigitalSignatureData,
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
    const [driveModeOpen, setDriveModeOpen] = useState(false);
    const [signatureModalOpen, setSignatureModalOpen] = useState(false);
    const [parkedSecuredState, setParkedSecuredState] =
        useState<ParkedSecuredState | null>(null);
    const [craneSetupState, setCraneSetupState] =
        useState<CraneSetupState | null>(null);

    const handleProgressionTransition = (
        jobId: number,
        nextStatus: DispatchStatus,
        version: number,
    ) => {
        if (nextStatus === 'completed') {
            setSignatureModalOpen(true);

            return;
        }

        onTransitionStatus(jobId, nextStatus, version);
    };

    const handleConfirmSignature = (data: DigitalSignatureData) => {
        setSignatureModalOpen(false);
        onTransitionStatus(job.id, 'completed', job.version, data);
    };

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
    const isProcessingTransition = jobPendingCommands.some(
        (command) => command.type === 'transition_status',
    );

    const primaryAsset = job.asset_assignments?.[0] ?? null;
    const isTowerCrane =
        job.asset_assignments?.some(
            (a) =>
                a.asset_kind === 'tower_crane' ||
                a.asset_name.toLowerCase().includes('tower') ||
                a.asset_code.toLowerCase().startsWith('twr'),
        ) ?? false;
    const isMovingCrane =
        (primaryAsset?.asset_kind === 'crane' ||
            primaryAsset?.asset_kind === 'mobile_crane' ||
            primaryAsset?.asset_kind === 'truck') &&
        !isTowerCrane;
    const isCrane = isTowerCrane || isMovingCrane;
    const isResponsePending = job.my_assignment?.response_status === 'pending';
    const isArrived =
        job.status.value === 'arrived' ||
        job.status.value === 'working' ||
        job.status.value === 'completed';

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

    const handleConfirmParkedSecured = (checklist: ParkedSecuredChecklist) => {
        setParkedSecuredState({
            isConfirmed: true,
            confirmedAt: new Date().toISOString(),
            confirmedBy: user.name,
            checklist,
        });
    };

    const handleVerifyCraneSetup = (
        checklist: CraneSetupSafetyChecklist,
        hazards: CraneHazardItem[],
    ) => {
        setCraneSetupState({
            isSetupComplete: true,
            verifiedAt: new Date().toISOString(),
            verifiedBy: user.name,
            exclusionRadiusMetres: 15.0,
            checklist,
            hazards,
        });
    };

    return (
        <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={styles.content}
            accessibilityLabel={`Assignment ${job.reference}`}
        >
            {/* Screen Header */}
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
                    <Icon name="back" size={20} color={colors.text} />
                    <Text style={styles.backButtonText}>Back</Text>
                </Pressable>
                <Text accessibilityRole="header" style={styles.screenTitle}>
                    {isResponsePending ? 'Respond to Job' : 'Job Details'}
                </Text>
                <View style={styles.headerSpacer} />
            </View>

            {/* Conflict Resolution Banner */}
            <CommandConflictBanner
                conflictedCommands={jobConflicts}
                onAcceptServerState={onAcceptServerState}
                onRetryNewVersion={onRetryNewVersion}
            />

            {/* Sync State Banner */}
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
                    <Icon
                        name={
                            jobConflicts.length > 0
                                ? 'alert'
                                : jobPendingCommands.length > 0
                                  ? 'sync'
                                  : 'check'
                        }
                        size={12}
                        color={colors.white}
                    />
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

            {/* Job Header Card */}
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
                        <Icon name="location" size={16} color={colors.muted} />
                        <Text selectable style={styles.metaValue}>
                            {job.site}
                        </Text>
                    </View>
                    {job.scheduled_start ? (
                        <View style={styles.metaRow}>
                            <Icon name="clock" size={16} color={colors.muted} />
                            <Text selectable style={styles.metaValue}>
                                {new Date(job.scheduled_start).toLocaleString()}
                            </Text>
                        </View>
                    ) : null}
                </View>
                {job.site_notes ? (
                    <View style={styles.siteNotes}>
                        <Text style={styles.siteNotesLabel}>Site Notes</Text>
                        <Text selectable style={styles.siteNotesText}>
                            {job.site_notes}
                        </Text>
                    </View>
                ) : null}
            </View>

            {/* Assigned Crane Card */}
            {primaryAsset ? (
                <View style={styles.assetCard} testID="assigned-asset-card">
                    <View style={styles.assetIcon}>
                        <Icon
                            name={isCrane ? 'crane' : 'truck'}
                            size={24}
                            color={colors.amberDark}
                        />
                    </View>
                    <View style={styles.assetCopy}>
                        <Text style={styles.assetLabel}>
                            {primaryAsset.asset_kind === 'crane' ||
                            primaryAsset.asset_kind === 'mobile_crane'
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

            {/* Job Requirements */}
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

            {/* 1. Assignment Offer Response Card */}
            <AssignmentResponseCard
                job={job}
                onAccept={onAcceptAssignment}
                onReject={onRejectAssignment}
            />

            {/* 2. Forward-Only Progression Stepper */}
            <FieldProgressionStepper
                isCraneSetupComplete={craneSetupState?.isSetupComplete ?? false}
                isParkedAndSecured={parkedSecuredState?.isConfirmed ?? false}
                isProcessing={isProcessingTransition}
                job={job}
                onTransitionStatus={handleProgressionTransition}
            />

            {/* 3a. Tower Crane Live Masthead Weather & Wind Monitoring HUD */}
            {isTowerCrane ? (
                <TowerCraneWeatherCard
                    jobId={job.id}
                    siteName={job.site}
                    testID="tower-crane-weather-card"
                />
            ) : null}

            {/* 3b. Heavy Crane Route Preview & Drive Mode (For Moving Assets) */}
            {isMovingCrane && primaryAsset ? (
                <HeavyCraneRouteCard
                    assetLabel={`${primaryAsset.asset_code} · ${primaryAsset.asset_name}`}
                    destinationLabel={job.site}
                    onOpenDriveMode={() => setDriveModeOpen(true)}
                    status="available"
                />
            ) : null}

            {/* 4. Parked & Secured Confirmation Gate (Upon Arrival) */}
            {isMovingCrane ? (
                <ParkedSecuredCard
                    isArrived={isArrived}
                    onConfirm={handleConfirmParkedSecured}
                    state={parkedSecuredState}
                />
            ) : null}

            {/* 5. Crane Setup Safety Mode Card (Outriggers for Mobile Cranes) */}
            {isMovingCrane ? (
                <CraneSetupSafetyCard
                    isCraneAsset={isCrane}
                    isParkedAndSecured={
                        parkedSecuredState?.isConfirmed ?? false
                    }
                    onVerifySetup={handleVerifyCraneSetup}
                    state={craneSetupState}
                />
            ) : null}

            {/* 5b. Construction Working Shift Execution Card */}
            {job.status.value === 'working' ? (
                <ConstructionWorkingCard
                    jobReference={job.reference}
                    siteName={job.site}
                />
            ) : null}

            {/* 6. Location Sharing Card */}
            <LocationSharingCard
                getCurrentLocation={getCurrentLocation}
                job={job}
                locationService={locationService}
                onLocationQueued={onLocationQueued}
                user={user}
            />

            {/* Team & Personnel */}
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

            {/* Heavy-Crane Drive Mode Modal */}
            <HeavyCraneDriveModeModal
                assetLabel={
                    primaryAsset
                        ? `${primaryAsset.asset_code} · ${primaryAsset.asset_name}`
                        : 'Crane'
                }
                destination={job.site}
                jobReference={job.reference}
                onArrived={() => {
                    setDriveModeOpen(false);

                    if (job.status.value === 'en_route') {
                        onTransitionStatus(job.id, 'arrived', job.version);
                    }
                }}
                onClose={() => setDriveModeOpen(false)}
                visible={driveModeOpen}
            />

            {/* Client Digital Signature Sign-Off Modal */}
            <DigitalSignatureModal
                clientName={job.client}
                jobReference={job.reference}
                onClose={() => setSignatureModalOpen(false)}
                onConfirmSignature={handleConfirmSignature}
                visible={signatureModalOpen}
            />
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    content: {
        alignSelf: 'center',
        maxWidth: 720,
        padding: 16,
        paddingBottom: 36,
        width: '100%',
    },
    screenHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 14,
        minHeight: 48,
    },
    backButton: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6,
        minHeight: 44,
        minWidth: 72,
        paddingHorizontal: 6,
    },
    backButtonText: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '700',
    },
    screenTitle: {
        color: colors.text,
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: -0.2,
    },
    headerSpacer: {
        minWidth: 72,
    },
    syncBanner: {
        alignItems: 'center',
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 10,
        marginBottom: 14,
        paddingHorizontal: 14,
        paddingVertical: 10,
        ...shadows.sm,
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
        borderRadius: 12,
        height: 24,
        justifyContent: 'center',
        width: 24,
    },
    syncMarkPending: {
        backgroundColor: colors.amber,
    },
    syncMarkConflict: {
        backgroundColor: colors.warning,
    },
    syncCopy: {
        flex: 1,
        gap: 1,
    },
    syncLabel: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '700',
    },
    syncMeta: {
        color: colors.secondary,
        fontSize: 12,
        lineHeight: 17,
    },
    headerCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 16,
        padding: 18,
        ...shadows.md,
    },
    assetCard: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 16,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 14,
        marginBottom: 16,
        padding: 16,
        ...shadows.md,
    },
    assetIcon: {
        alignItems: 'center',
        backgroundColor: colors.amberSoft,
        borderRadius: 14,
        height: 48,
        justifyContent: 'center',
        width: 48,
    },
    assetCopy: {
        flex: 1,
        gap: 2,
    },
    assetLabel: {
        color: colors.muted,
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    assetName: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: -0.2,
    },
    assetDetail: {
        color: colors.secondary,
        fontSize: 13,
        lineHeight: 18,
    },
    requirementsCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 16,
        padding: 18,
        ...shadows.md,
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
        fontSize: 20,
        fontWeight: '700',
        letterSpacing: -0.3,
    },
    versionText: {
        color: colors.muted,
        fontSize: 12,
        fontWeight: '600',
        marginTop: 2,
    },
    badgeGroup: {
        alignItems: 'flex-end',
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        justifyContent: 'flex-end',
    },
    priorityBadge: {
        borderRadius: 8,
        fontSize: 11,
        fontWeight: '700',
        overflow: 'hidden',
        paddingHorizontal: 8,
        paddingVertical: 4,
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
        borderRadius: 8,
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    statusMark: {
        backgroundColor: colors.blue,
        borderRadius: 4,
        height: 6,
        width: 6,
    },
    statusText: {
        color: colors.blueDark,
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    title: {
        color: colors.text,
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: -0.3,
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
        alignItems: 'center',
        flexDirection: 'row',
        gap: 10,
    },
    metaValue: {
        color: colors.secondary,
        flex: 1,
        fontSize: 13,
        lineHeight: 19,
    },
    siteNotes: {
        backgroundColor: colors.surfaceMuted,
        borderRadius: 10,
        marginTop: 14,
        padding: 12,
    },
    siteNotesLabel: {
        color: colors.text,
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
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
        borderRadius: 16,
        borderWidth: 1,
        padding: 18,
        ...shadows.md,
    },
    sectionHeading: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: -0.2,
        marginBottom: 14,
    },
    label: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '700',
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
        height: 6,
        marginTop: 7,
        width: 6,
    },
    emptyText: {
        color: colors.muted,
        fontSize: 14,
    },
    pressed: {
        opacity: 0.78,
        transform: [{ scale: 0.985 }],
    },
});
