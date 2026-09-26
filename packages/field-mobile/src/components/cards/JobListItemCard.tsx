import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    Pressable,
    StyleSheet,
    Text,
    Vibration,
    View,
} from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import type {
    DispatchJob,
    DispatchStatus,
    OutboxCommand,
} from '../../types/index';
import { formatPHT } from '../../utils/formatters';
import { Icon } from '../common/Icon';
import { colors, shadows } from '../nativeStyles';
import { CommandConflictBanner } from '../panels/CommandConflictBanner';
import { DigitalSignatureModal } from '../signature/DigitalSignatureModal';
import type { DigitalSignatureData } from '../signature/DigitalSignatureModal';

export interface JobListItemCardProps {
    job: DispatchJob;
    conflictedCommands?: OutboxCommand[];
    queuedDelayCommand?: OutboxCommand;
    hideAssignmentActions?: boolean;
    onAcceptServerState?: (commandId: string) => void;
    onRetryNewVersion?: (commandId: string, newVersion: number) => void;
    onSelectJob?: (jobId: number) => void;
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
    onTransitionStatus?: (
        jobId: number,
        nextStatus: DispatchStatus,
        version: number,
        signatureData?: DigitalSignatureData,
    ) => void;
    onOpenDriveRoutes?: () => void;
    onReportDelay?: (job: DispatchJob) => void;
}

export interface HoldToConfirmTransitButtonProps {
    label: string;
    icon: any;
    accessibilityLabel: string;
    testID: string;
    progressTestID?: string;
    onConfirm: () => void;
    baseStyle: StyleProp<ViewStyle>;
    progressColor?: string;
    holdDurationMs?: number;
}

export const HoldToConfirmTransitButton: React.FC<
    HoldToConfirmTransitButtonProps
> = ({
    label,
    icon,
    accessibilityLabel,
    testID,
    progressTestID,
    onConfirm,
    baseStyle,
    progressColor = 'rgba(255, 255, 255, 0.45)',
    holdDurationMs = 500,
}) => {
    const [progress, setProgress] = useState(0);
    const [isHolding, setIsHolding] = useState(false);
    const [progressAnim] = useState(() => new Animated.Value(0));
    const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isTouchActiveRef = useRef(false);
    const touchReleasedEarlyRef = useRef(false);
    const completedRef = useRef(false);
    const startTimeRef = useRef(0);

    const cleanupTimers = useCallback(() => {
        if (holdTimerRef.current) {
            clearTimeout(holdTimerRef.current);
            holdTimerRef.current = null;
        }

        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        progressAnim.stopAnimation();
    }, [progressAnim]);

    const handlePressIn = useCallback(() => {
        isTouchActiveRef.current = true;
        touchReleasedEarlyRef.current = false;
        completedRef.current = false;
        startTimeRef.current = Date.now();
        setIsHolding(true);
        setProgress(0);
        progressAnim.setValue(0);

        Animated.timing(progressAnim, {
            toValue: 1,
            duration: holdDurationMs,
            useNativeDriver: false,
        }).start();

        intervalRef.current = setInterval(() => {
            const elapsed = Date.now() - startTimeRef.current;
            const frac = Math.min(1, elapsed / holdDurationMs);
            setProgress(frac);
        }, 50);

        holdTimerRef.current = setTimeout(() => {
            completedRef.current = true;
            touchReleasedEarlyRef.current = false;
            cleanupTimers();
            setIsHolding(false);
            setProgress(1);

            try {
                Vibration.vibrate(60);
            } catch {
                // Ignore vibration error in mock or test environment
            }

            onConfirm();
        }, holdDurationMs);
    }, [cleanupTimers, holdDurationMs, onConfirm, progressAnim]);

    const handlePressOut = useCallback(() => {
        isTouchActiveRef.current = false;
        cleanupTimers();
        setIsHolding(false);

        if (!completedRef.current) {
            touchReleasedEarlyRef.current = true;
            Animated.timing(progressAnim, {
                toValue: 0,
                duration: 150,
                useNativeDriver: false,
            }).start(() => setProgress(0));
        }
    }, [cleanupTimers, progressAnim]);

    const handlePress = useCallback(() => {
        // Accidental brief glove tap (< 500ms): touch sequence was active but released early. Prevent transition!
        if (touchReleasedEarlyRef.current) {
            touchReleasedEarlyRef.current = false;

            try {
                Vibration.vibrate(30);
            } catch {
                // Ignore
            }

            return;
        }

        // Direct press activation for screen readers (WCAG 2.2 AA) and unit testing (fireEvent.press without pressIn)
        if (!isTouchActiveRef.current && !completedRef.current) {
            try {
                Vibration.vibrate(40);
            } catch {
                // Ignore
            }

            onConfirm();

            return;
        }

        // Hold completed successfully; reset state for subsequent interactions
        if (completedRef.current) {
            completedRef.current = false;
            setProgress(0);
            progressAnim.setValue(0);
        }
    }, [onConfirm, progressAnim]);

    useEffect(() => {
        return () => cleanupTimers();
    }, [cleanupTimers]);

    const progressWidth = useMemo(
        () =>
            progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
            }),
        [progressAnim],
    );

    return (
        <Pressable
            accessibilityHint="Hold for 0.5s to confirm dispatch status transition"
            accessibilityLabel={accessibilityLabel}
            accessibilityRole="button"
            onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={({ pressed }) => [
                styles.btnProgression,
                baseStyle,
                pressed && styles.btnPressed,
                styles.holdBtnContainer,
            ]}
            testID={testID}
        >
            <Animated.View
                style={[
                    styles.holdProgressBar,
                    {
                        backgroundColor: progressColor,
                        width: progressWidth,
                    },
                ]}
                testID={progressTestID || `${testID}-progress`}
            />
            <View pointerEvents="none" style={styles.holdButtonContent}>
                <Icon color="#FFFFFF" name={icon} size={15} />
                <Text style={styles.btnProgressionText}>
                    {isHolding && progress > 0.1
                        ? `${label} (Holding ${Math.round(progress * 100)}%)`
                        : label}
                </Text>
            </View>
        </Pressable>
    );
};

export const JobListItemCard: React.FC<JobListItemCardProps> = ({
    job,
    conflictedCommands,
    queuedDelayCommand,
    hideAssignmentActions = false,
    onAcceptServerState,
    onRetryNewVersion,
    onSelectJob,
    onAcceptAssignment,
    onRejectAssignment,
    onTransitionStatus,
    onReportDelay,
}) => {
    const { isDarkHud } = useTheme();
    const [showCompletionSignature, setShowCompletionSignature] =
        useState(false);

    const isPendingAssignment =
        job.my_assignment?.response_status === 'pending';
    const assetSummary =
        job.asset_assignments && job.asset_assignments.length > 0
            ? job.asset_assignments
                  .map(
                      (assignment) =>
                          `${assignment.asset_code} · ${assignment.asset_name}`,
                  )
                  .join('\n')
            : null;
    const currentStatus = job.status?.value || 'scheduled';
    const statusLabel = job.status?.label || currentStatus.toUpperCase();
    const priorityLabel = job.priority?.label || 'ROUTINE';
    const priorityValue = job.priority?.value || 'routine';

    const getStatusTheme = (
        status: DispatchStatus,
        isPending: boolean,
    ): { bg: string; text: string; dot: string } => {
        if (isPending) {
            return {
                bg: isDarkHud ? 'rgba(255, 191, 0, 0.18)' : '#FFF3C4',
                text: isDarkHud ? '#FFBF00' : '#806000',
                dot: '#FFBF00',
            };
        }

        switch (status) {
            case 'dispatched':
            case 'scheduled':
                return {
                    bg: isDarkHud ? 'rgba(59, 130, 246, 0.18)' : '#DBEAFE',
                    text: isDarkHud ? '#93C5FD' : '#1D4ED8',
                    dot: '#3B82F6',
                };
            case 'accepted':
                return {
                    bg: isDarkHud ? 'rgba(124, 58, 237, 0.18)' : '#EDE9FE',
                    text: isDarkHud ? '#C4B5FD' : '#6D28D9',
                    dot: '#8B5CF6',
                };
            case 'en_route':
                return {
                    bg: isDarkHud ? 'rgba(2, 132, 199, 0.18)' : '#E0F2FE',
                    text: isDarkHud ? '#7DD3FC' : '#0369A1',
                    dot: '#0284C7',
                };
            case 'arrived':
                return {
                    bg: isDarkHud ? 'rgba(13, 148, 136, 0.18)' : '#CCFBF1',
                    text: isDarkHud ? '#5EEAD4' : '#0F766E',
                    dot: '#0D9488',
                };
            case 'working':
                return {
                    bg: isDarkHud ? 'rgba(255, 191, 0, 0.18)' : '#FFF3C4',
                    text: isDarkHud ? '#FFBF00' : '#806000',
                    dot: '#FFBF00',
                };
            case 'completed':
                return {
                    bg: isDarkHud ? 'rgba(16, 185, 129, 0.18)' : '#D1FAE5',
                    text: isDarkHud ? '#6EE7B7' : '#047857',
                    dot: '#10B981',
                };
            default:
                return {
                    bg: isDarkHud ? 'rgba(100, 116, 139, 0.18)' : '#F1F5F9',
                    text: isDarkHud ? '#CBD5E1' : '#475569',
                    dot: '#64748B',
                };
        }
    };

    const statusTheme = getStatusTheme(currentStatus, isPendingAssignment);

    // Format scope requirements
    const formatRequirements = (): string | null => {
        if (!job.requirements) {
            return null;
        }

        if (Array.isArray(job.requirements)) {
            return job.requirements.join(' · ');
        }

        if (typeof job.requirements === 'object') {
            return Object.values(job.requirements).filter(Boolean).join(' · ');
        }

        return String(job.requirements);
    };

    const requirementsText = formatRequirements();

    return (
        <Pressable
            accessibilityLabel={`Dispatch assignment ${job.reference}, ${job.title}`}
            accessibilityRole="button"
            onPress={() => onSelectJob?.(job.id)}
            style={[styles.cardRoot, isDarkHud && styles.darkCardRoot]}
            testID={`job-card-${job.id}`}
        >
            {/* Conflict Resolution Banner (when outbox commands have version conflicts) */}
            {conflictedCommands &&
            conflictedCommands.length > 0 &&
            onAcceptServerState &&
            onRetryNewVersion ? (
                <CommandConflictBanner
                    conflictedCommands={conflictedCommands}
                    onAcceptServerState={onAcceptServerState}
                    onRetryNewVersion={onRetryNewVersion}
                />
            ) : null}

            {/* 1. Header Bar: Ref, Priority, Status */}
            <Pressable
                accessibilityHint="Toggles or selects job"
                accessibilityLabel={`View details for ${job.reference}`}
                accessibilityRole="button"
                onPress={() => onSelectJob?.(job.id)}
                style={({ pressed }) => [
                    styles.headerPressable,
                    pressed && styles.headerPressed,
                ]}
            >
                <View style={styles.headerRow}>
                    <View style={styles.headerLeftGroup}>
                        <View
                            style={[
                                styles.refPill,
                                isDarkHud && styles.darkRefPill,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.refText,
                                    isDarkHud && styles.darkRefText,
                                ]}
                            >
                                {job.reference}
                            </Text>
                        </View>
                        {priorityValue !== 'routine' && (
                            <View
                                style={[
                                    styles.priorityPill,
                                    priorityValue === 'emergency'
                                        ? styles.priorityEmergency
                                        : styles.priorityHigh,
                                ]}
                            >
                                <Text style={styles.priorityText}>
                                    {priorityLabel}
                                </Text>
                            </View>
                        )}
                    </View>

                    <View
                        style={[
                            styles.statusBadge,
                            { backgroundColor: statusTheme.bg },
                        ]}
                    >
                        <View
                            style={[
                                styles.statusDot,
                                { backgroundColor: statusTheme.dot },
                            ]}
                        />
                        <Text
                            style={[
                                styles.statusText,
                                { color: statusTheme.text },
                            ]}
                        >
                            {isPendingAssignment ? 'ACTION REQ' : statusLabel}
                        </Text>
                    </View>
                </View>

                {/* 2. Job Title & Client */}
                <View style={styles.titleSection}>
                    <Text
                        style={[
                            styles.jobTitle,
                            isDarkHud && styles.darkJobTitle,
                        ]}
                    >
                        {job.title}
                    </Text>
                    <Text
                        style={[
                            styles.clientName,
                            isDarkHud && styles.darkClientName,
                        ]}
                    >
                        {job.client}
                    </Text>
                </View>
            </Pressable>

            {/* 3. Operational Metadata Grid */}
            <View
                style={[
                    styles.detailsContainer,
                    isDarkHud && styles.darkDetailsContainer,
                ]}
            >
                {/* Site Location */}
                <View style={styles.detailRow}>
                    <View style={styles.iconCol}>
                        <Icon
                            color={isDarkHud ? '#38BDF8' : '#0284C7'}
                            name="pin"
                            size={16}
                        />
                    </View>
                    <View style={styles.detailTextCol}>
                        <Text
                            style={[
                                styles.detailLabel,
                                isDarkHud && styles.darkDetailLabel,
                            ]}
                        >
                            Jobsite Location
                        </Text>
                        <Text
                            numberOfLines={2}
                            style={[
                                styles.detailValue,
                                isDarkHud && styles.darkDetailValue,
                            ]}
                        >
                            {job.site}
                        </Text>
                        {job.site_notes ? (
                            <Text
                                numberOfLines={1}
                                style={[
                                    styles.detailSubNotes,
                                    isDarkHud && styles.darkDetailSubNotes,
                                ]}
                            >
                                {job.site_notes}
                            </Text>
                        ) : null}
                    </View>
                </View>

                {/* Assigned Crane / Machine */}
                <View style={styles.detailRow}>
                    <View style={styles.iconCol}>
                        <Icon
                            color={isDarkHud ? '#FFBF00' : '#806000'}
                            name="crane"
                            size={16}
                        />
                    </View>
                    <View style={styles.detailTextCol}>
                        <Text
                            style={[
                                styles.detailLabel,
                                isDarkHud && styles.darkDetailLabel,
                            ]}
                        >
                            Assigned Equipment
                        </Text>
                        <Text
                            style={[
                                styles.detailValue,
                                isDarkHud && styles.darkDetailValue,
                            ]}
                        >
                            {assetSummary ?? 'No equipment assigned'}
                        </Text>
                    </View>
                </View>

                {/* Report Time / Schedule */}
                {job.scheduled_start ? (
                    <View style={styles.detailRow}>
                        <View style={styles.iconCol}>
                            <Icon
                                color={isDarkHud ? '#94A3B8' : '#64748B'}
                                name="clock"
                                size={16}
                            />
                        </View>
                        <View style={styles.detailTextCol}>
                            <Text
                                style={[
                                    styles.detailLabel,
                                    isDarkHud && styles.darkDetailLabel,
                                ]}
                            >
                                Report Time / Schedule
                            </Text>
                            <Text
                                style={[
                                    styles.detailValue,
                                    isDarkHud && styles.darkDetailValue,
                                ]}
                            >
                                {formatPHT(job.scheduled_start, 'datetime')}
                            </Text>
                        </View>
                    </View>
                ) : null}

                {/* Scope & Requirements */}
                {requirementsText ? (
                    <View style={styles.detailRowLast}>
                        <View style={styles.iconCol}>
                            <Icon
                                color={isDarkHud ? '#A78BFA' : '#7C3AED'}
                                name="file-text"
                                size={16}
                            />
                        </View>
                        <View style={styles.detailTextCol}>
                            <Text
                                style={[
                                    styles.detailLabel,
                                    isDarkHud && styles.darkDetailLabel,
                                ]}
                            >
                                Lift Scope & Specifications
                            </Text>
                            {Array.isArray(job.requirements) ? (
                                job.requirements.map((req, idx) => (
                                    <Text
                                        key={idx}
                                        style={[
                                            styles.detailValue,
                                            isDarkHud && styles.darkDetailValue,
                                        ]}
                                    >
                                        {req}
                                    </Text>
                                ))
                            ) : (
                                <Text
                                    numberOfLines={2}
                                    style={[
                                        styles.detailValue,
                                        isDarkHud && styles.darkDetailValue,
                                    ]}
                                >
                                    {requirementsText}
                                </Text>
                            )}
                        </View>
                    </View>
                ) : null}
            </View>

            {/* 4. Initial Assignment Response Actions (Accept / Decline) */}
            {isPendingAssignment && !hideAssignmentActions ? (
                <View style={styles.actionsContainer}>
                    <View style={styles.pendingActionBlock}>
                        <View
                            style={[
                                styles.pendingBanner,
                                isDarkHud && styles.darkPendingBanner,
                            ]}
                        >
                            <Icon
                                color={isDarkHud ? '#FFBF00' : '#806000'}
                                name="alert-circle"
                                size={15}
                            />
                            <Text
                                style={[
                                    styles.pendingBannerText,
                                    isDarkHud && styles.darkPendingBannerText,
                                ]}
                            >
                                Operator assignment requires confirmation
                            </Text>
                        </View>
                        <View style={styles.twoButtonRow}>
                            <Pressable
                                accessibilityLabel={`Accept dispatch ${job.reference}`}
                                accessibilityRole="button"
                                onPress={() => {
                                    if (job.my_assignment?.id) {
                                        onAcceptAssignment?.(
                                            job.id,
                                            job.my_assignment.id,
                                            job.version,
                                        );
                                    }
                                }}
                                style={({ pressed }) => [
                                    styles.btnAccept,
                                    pressed && styles.btnPressed,
                                ]}
                                testID={`accept-assignment-btn-${job.id}`}
                            >
                                <Icon color="#FFFFFF" name="check" size={16} />
                                <Text style={styles.btnAcceptText}>
                                    Accept Dispatch
                                </Text>
                            </Pressable>

                            <Pressable
                                accessibilityLabel={`Decline dispatch ${job.reference}`}
                                accessibilityRole="button"
                                onPress={() => {
                                    if (job.my_assignment?.id) {
                                        onRejectAssignment?.(
                                            job.id,
                                            job.my_assignment.id,
                                            'Declined by mobile operator',
                                            job.version,
                                        );
                                    }
                                }}
                                style={({ pressed }) => [
                                    styles.btnDecline,
                                    isDarkHud && styles.darkBtnDecline,
                                    pressed && styles.btnPressed,
                                ]}
                                testID={`decline-assignment-btn-${job.id}`}
                            >
                                <Icon
                                    color={isDarkHud ? '#F87171' : '#DC2626'}
                                    name="close"
                                    size={16}
                                />
                                <Text
                                    style={[
                                        styles.btnDeclineText,
                                        isDarkHud && styles.darkBtnDeclineText,
                                    ]}
                                >
                                    Decline
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            ) : (
                <View style={styles.nonPendingActionsContainer}>
                    {/* Status progression button when active */}
                    {onTransitionStatus &&
                    job.capabilities?.can_update_status !== false ? (
                        <View style={styles.progressionActionRow}>
                            {currentStatus === 'accepted' ||
                            currentStatus === 'dispatched' ? (
                                <HoldToConfirmTransitButton
                                    accessibilityLabel={`Start transit for ${job.reference}`}
                                    baseStyle={[
                                        styles.btnEnRoute,
                                        isDarkHud && styles.darkBtnEnRoute,
                                    ]}
                                    icon="route"
                                    label="Start Transit"
                                    onConfirm={() =>
                                        onTransitionStatus(
                                            job.id,
                                            'en_route',
                                            job.version,
                                        )
                                    }
                                    progressColor="rgba(255, 255, 255, 0.4)"
                                    progressTestID={`transit-hold-progress-${job.id}`}
                                    testID={`action-en-route-btn-${job.id}`}
                                />
                            ) : currentStatus === 'en_route' ? (
                                <HoldToConfirmTransitButton
                                    accessibilityLabel={`Arrived on site for ${job.reference}`}
                                    baseStyle={[
                                        styles.btnArrive,
                                        isDarkHud && styles.darkBtnArrive,
                                    ]}
                                    icon="pin"
                                    label="Arrived On Site"
                                    onConfirm={() =>
                                        onTransitionStatus(
                                            job.id,
                                            'arrived',
                                            job.version,
                                        )
                                    }
                                    progressColor="rgba(255, 255, 255, 0.4)"
                                    progressTestID={`arrive-hold-progress-${job.id}`}
                                    testID={`action-arrive-btn-${job.id}`}
                                />
                            ) : currentStatus === 'arrived' ? (
                                <Pressable
                                    accessibilityLabel={`Begin work for ${job.reference}`}
                                    accessibilityRole="button"
                                    onPress={() =>
                                        onTransitionStatus(
                                            job.id,
                                            'working',
                                            job.version,
                                        )
                                    }
                                    style={({ pressed }) => [
                                        styles.btnProgression,
                                        styles.btnStartWork,
                                        isDarkHud && styles.darkBtnStartWork,
                                        pressed && styles.btnPressed,
                                    ]}
                                    testID={`action-start-work-btn-${job.id}`}
                                >
                                    <Icon
                                        color="#FFFFFF"
                                        name="crane"
                                        size={15}
                                    />
                                    <Text style={styles.btnProgressionText}>
                                        Begin Work
                                    </Text>
                                </Pressable>
                            ) : currentStatus === 'working' ? (
                                <Pressable
                                    accessibilityLabel={`Complete job for ${job.reference}`}
                                    accessibilityRole="button"
                                    onPress={() =>
                                        setShowCompletionSignature(true)
                                    }
                                    style={({ pressed }) => [
                                        styles.btnProgression,
                                        styles.btnComplete,
                                        isDarkHud && styles.darkBtnComplete,
                                        pressed && styles.btnPressed,
                                    ]}
                                    testID={`action-complete-btn-${job.id}`}
                                >
                                    <Icon
                                        color="#FFFFFF"
                                        name="check"
                                        size={15}
                                    />
                                    <Text style={styles.btnProgressionText}>
                                        Complete Job
                                    </Text>
                                </Pressable>
                            ) : null}
                        </View>
                    ) : null}

                    {queuedDelayCommand ? (
                        <View
                            style={[
                                styles.reportedDelayBanner,
                                isDarkHud && styles.darkReportedDelayBanner,
                                { opacity: 0.8 },
                            ]}
                            testID={`queued-delay-banner-${job.id}`}
                        >
                            <View style={styles.reportedDelayHeader}>
                                <Icon color="#94A3B8" name="clock" size={14} />
                                <Text
                                    style={[
                                        styles.reportedDelayTitle,
                                        isDarkHud &&
                                            styles.darkReportedDelayTitle,
                                        {
                                            color: isDarkHud
                                                ? '#94A3B8'
                                                : '#475569',
                                        },
                                    ]}
                                >
                                    Queued Delay:{' '}
                                    {(queuedDelayCommand.payload as any)
                                        .reason_label ||
                                        (queuedDelayCommand.payload as any)
                                            .reason}
                                    {(queuedDelayCommand.payload as any)
                                        .estimated_minutes
                                        ? ` (+${(queuedDelayCommand.payload as any).estimated_minutes}m)`
                                        : ''}
                                </Text>
                            </View>
                            {(queuedDelayCommand.payload as any).notes ? (
                                <Text
                                    numberOfLines={2}
                                    style={[
                                        styles.reportedDelayNotes,
                                        isDarkHud &&
                                            styles.darkReportedDelayNotes,
                                        {
                                            color: isDarkHud
                                                ? '#94A3B8'
                                                : '#475569',
                                        },
                                    ]}
                                >
                                    {(queuedDelayCommand.payload as any).notes}
                                </Text>
                            ) : null}
                        </View>
                    ) : job.latest_delay ? (
                        <View
                            style={[
                                styles.reportedDelayBanner,
                                isDarkHud && styles.darkReportedDelayBanner,
                            ]}
                            testID={`delay-status-banner-${job.id}`}
                        >
                            <View style={styles.reportedDelayHeader}>
                                <Icon color="#FFBF00" name="alert" size={14} />
                                <Text
                                    style={[
                                        styles.reportedDelayTitle,
                                        isDarkHud &&
                                            styles.darkReportedDelayTitle,
                                    ]}
                                >
                                    Delay Reported:{' '}
                                    {job.latest_delay.reason_label ||
                                        (job.latest_delay as any).reason}
                                    {job.latest_delay.estimated_minutes ||
                                    (job.latest_delay as any).estimated_minutes
                                        ? ` (+${job.latest_delay.estimated_minutes ?? (job.latest_delay as any).estimated_minutes}m)`
                                        : ''}
                                    {job.latest_delay.reported_at
                                        ? ` · ${formatPHT(job.latest_delay.reported_at, 'time')}`
                                        : ''}
                                </Text>
                            </View>
                            {job.latest_delay.notes ? (
                                <Text
                                    numberOfLines={2}
                                    style={[
                                        styles.reportedDelayNotes,
                                        isDarkHud &&
                                            styles.darkReportedDelayNotes,
                                    ]}
                                >
                                    {job.latest_delay.notes}
                                </Text>
                            ) : null}
                        </View>
                    ) : null}

                    {onReportDelay ? (
                        <Pressable
                            accessibilityLabel={`Report delay for ${job.reference}`}
                            accessibilityRole="button"
                            onPress={() => onReportDelay(job)}
                            style={({ pressed }) => [
                                styles.btnReportDelay,
                                isDarkHud && styles.darkBtnReportDelay,
                                pressed && styles.btnPressed,
                            ]}
                            testID={`report-delay-btn-${job.id}`}
                        >
                            <Icon
                                color={isDarkHud ? '#FFBF00' : '#806000'}
                                name="alert"
                                size={15}
                            />
                            <Text
                                style={[
                                    styles.btnReportDelayText,
                                    isDarkHud && styles.darkBtnReportDelayText,
                                ]}
                            >
                                Report Delay
                            </Text>
                        </Pressable>
                    ) : null}
                </View>
            )}

            {showCompletionSignature ? (
                <DigitalSignatureModal
                    clientName={job.client}
                    jobReference={job.reference}
                    onClose={() => setShowCompletionSignature(false)}
                    onConfirmSignature={(sigData) => {
                        setShowCompletionSignature(false);
                        onTransitionStatus?.(
                            job.id,
                            'completed',
                            job.version,
                            sigData,
                        );
                    }}
                    visible={showCompletionSignature}
                />
            ) : null}
        </Pressable>
    );
};

const styles = StyleSheet.create({
    cardRoot: {
        backgroundColor: colors.surface,
        borderColor: colors.borderStrong,
        borderRadius: 16,
        borderWidth: 1.5,
        marginBottom: 14,
        overflow: 'hidden',
        padding: 16,
        ...shadows.sm,
    },
    darkCardRoot: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    headerPressable: {
        marginBottom: 12,
    },
    headerPressed: {
        opacity: 0.85,
    },
    headerRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    headerLeftGroup: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    refPill: {
        backgroundColor: '#F1F5F9',
        borderColor: '#CBD5E1',
        borderRadius: 6,
        borderWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    darkRefPill: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
    },
    refText: {
        color: '#0F172A',
        fontFamily: 'monospace',
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    darkRefText: {
        color: '#F8FAFC',
    },
    priorityPill: {
        borderRadius: 6,
        paddingHorizontal: 7,
        paddingVertical: 3,
    },
    priorityHigh: {
        backgroundColor: '#FFF3C4',
    },
    priorityEmergency: {
        backgroundColor: '#FEE2E2',
    },
    priorityText: {
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    statusBadge: {
        alignItems: 'center',
        borderRadius: 20,
        flexDirection: 'row',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    statusDot: {
        borderRadius: 3,
        height: 6,
        width: 6,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    titleSection: {
        marginTop: 2,
    },
    jobTitle: {
        color: colors.text,
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: -0.3,
        lineHeight: 24,
    },
    darkJobTitle: {
        color: '#F8FAFC',
    },
    clientName: {
        color: colors.secondary,
        fontSize: 13,
        fontWeight: '600',
        marginTop: 2,
    },
    darkClientName: {
        color: '#94A3B8',
    },
    detailsContainer: {
        backgroundColor: '#F8FAFC',
        borderColor: '#E2E8F0',
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 14,
        padding: 12,
    },
    darkDetailsContainer: {
        backgroundColor: '#0F172A',
        borderColor: '#1E293B',
    },
    detailRow: {
        alignItems: 'flex-start',
        borderBottomColor: '#E2E8F0',
        borderBottomWidth: 1,
        flexDirection: 'row',
        marginBottom: 8,
        paddingBottom: 8,
    },
    detailRowLast: {
        alignItems: 'flex-start',
        flexDirection: 'row',
    },
    iconCol: {
        alignItems: 'center',
        marginTop: 2,
        width: 24,
    },
    detailTextCol: {
        flex: 1,
    },
    detailLabel: {
        color: '#64748B',
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 1,
        textTransform: 'uppercase',
    },
    darkDetailLabel: {
        color: '#94A3B8',
    },
    detailValue: {
        color: '#1E293B',
        fontSize: 13,
        fontWeight: '700',
        lineHeight: 18,
    },
    darkDetailValue: {
        color: '#F1F5F9',
    },
    detailSubNotes: {
        color: '#64748B',
        fontSize: 12,
        fontWeight: '500',
        marginTop: 2,
    },
    darkDetailSubNotes: {
        color: '#94A3B8',
    },
    actionsContainer: {
        marginTop: 2,
    },
    pendingActionBlock: {
        gap: 8,
    },
    pendingBanner: {
        alignItems: 'center',
        backgroundColor: '#FFF3C4',
        borderRadius: 8,
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    darkPendingBanner: {
        backgroundColor: 'rgba(255, 191, 0, 0.15)',
    },
    pendingBannerText: {
        color: '#806000',
        fontSize: 12,
        fontWeight: '600',
    },
    darkPendingBannerText: {
        color: '#FFBF00',
    },
    twoButtonRow: {
        flexDirection: 'row',
        gap: 10,
    },
    btnAccept: {
        alignItems: 'center',
        backgroundColor: '#059669',
        borderRadius: 10,
        flex: 1,
        flexDirection: 'row',
        gap: 6,
        justifyContent: 'center',
        minHeight: 44,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    btnAcceptText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
    btnDecline: {
        alignItems: 'center',
        backgroundColor: 'transparent',
        borderColor: '#FCA5A5',
        borderRadius: 10,
        borderWidth: 1.5,
        flexDirection: 'row',
        gap: 6,
        justifyContent: 'center',
        minHeight: 44,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    darkBtnDecline: {
        borderColor: '#7F1D1D',
    },
    btnDeclineText: {
        color: '#DC2626',
        fontSize: 14,
        fontWeight: '700',
    },
    darkBtnDeclineText: {
        color: '#F87171',
    },
    btnPressed: {
        opacity: 0.85,
        transform: [{ scale: 0.985 }],
    },
    nonPendingActionsContainer: {
        marginTop: 10,
        gap: 8,
    },
    reportedDelayBanner: {
        backgroundColor: '#FFF3C4',
        borderColor: '#FFF3C4',
        borderRadius: 8,
        borderWidth: 1,
        padding: 10,
    },
    darkReportedDelayBanner: {
        backgroundColor: 'rgba(255, 191, 0, 0.12)',
        borderColor: 'rgba(255, 191, 0, 0.3)',
    },
    reportedDelayHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6,
    },
    reportedDelayTitle: {
        color: '#806000',
        fontSize: 12,
        fontWeight: '700',
        flexShrink: 1,
        flexWrap: 'wrap',
    },
    darkReportedDelayTitle: {
        color: '#FFBF00',
    },
    reportedDelayNotes: {
        color: '#806000',
        fontSize: 12,
        marginTop: 4,
    },
    darkReportedDelayNotes: {
        color: '#FFBF00',
    },
    btnReportDelay: {
        alignItems: 'center',
        backgroundColor: '#FFF3C4',
        borderColor: '#FFBF00',
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
        minHeight: 42,
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    darkBtnReportDelay: {
        backgroundColor: 'rgba(255, 191, 0, 0.1)',
        borderColor: '#FFBF00',
    },
    btnReportDelayText: {
        color: '#806000',
        fontSize: 13,
        fontWeight: '700',
    },
    darkBtnReportDelayText: {
        color: '#FFBF00',
    },
    progressionActionRow: {
        marginBottom: 8,
    },
    btnProgression: {
        alignItems: 'center',
        borderRadius: 10,
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
        minHeight: 44,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    btnProgressionText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
    btnEnRoute: {
        backgroundColor: '#0284C7',
    },
    darkBtnEnRoute: {
        backgroundColor: '#0369A1',
    },
    btnArrive: {
        backgroundColor: '#0D9488',
    },
    darkBtnArrive: {
        backgroundColor: '#0F766E',
    },
    btnStartWork: {
        backgroundColor: '#D97706',
    },
    darkBtnStartWork: {
        backgroundColor: '#B45309',
    },
    btnComplete: {
        backgroundColor: '#059669',
    },
    darkBtnComplete: {
        backgroundColor: '#047857',
    },
    holdBtnContainer: {
        overflow: 'hidden',
        position: 'relative',
    },
    holdProgressBar: {
        bottom: 0,
        left: 0,
        position: 'absolute',
        top: 0,
    },
    holdButtonContent: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
        zIndex: 2,
    },
});
