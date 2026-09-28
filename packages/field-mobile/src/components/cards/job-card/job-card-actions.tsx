import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, useThemedStyles } from '../../../theme';
import type { ThemeColors } from '../../../theme';
import type {
    DispatchJob,
    DispatchStatus,
    OutboxCommand,
} from '../../../types/index';
import { Icon } from '../../common/Icon';
import type { IconName } from '../../common/Icon';
import { DeclineReasonSheet } from '../../sheets/DeclineReasonSheet';
import { HoldToConfirmTransitButton } from './hold-to-confirm-button';
import { JobCardDelayBanner } from './job-card-delay-banner';
import { JobDirectionsButton } from './job-directions-button';

export interface JobCardResponseActionsProps {
    job: DispatchJob;
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
}

/** Accept / decline for a job still awaiting the operator's response. */
export const JobCardResponseActions: React.FC<JobCardResponseActionsProps> = ({
    job,
    onAcceptAssignment,
    onRejectAssignment,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const assignmentId = job.my_assignment?.id;
    const [declining, setDeclining] = useState(false);

    return (
        <View style={styles.pendingActionBlock}>
            <DeclineReasonSheet
                jobReference={job.reference}
                onCancel={() => setDeclining(false)}
                onConfirm={(reason) => {
                    setDeclining(false);

                    if (assignmentId) {
                        onRejectAssignment?.(
                            job.id,
                            assignmentId,
                            reason,
                            job.version,
                        );
                    }
                }}
                visible={declining}
            />
            <View
                style={styles.pendingBanner}
                testID={`job-pending-banner-${job.id}`}
            >
                <Icon
                    color={theme.warningOrangeText}
                    name="alert-circle"
                    size={15}
                />
                <Text style={styles.pendingBannerText}>
                    Operator assignment requires confirmation
                </Text>
            </View>
            <View style={styles.twoButtonRow}>
                <Pressable
                    accessibilityLabel={`Accept dispatch ${job.reference}`}
                    accessibilityRole="button"
                    onPress={() => {
                        if (assignmentId) {
                            onAcceptAssignment?.(
                                job.id,
                                assignmentId,
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
                    <Icon color={theme.surfaceDark} name="check" size={16} />
                    <Text style={styles.btnAcceptText}>Accept Dispatch</Text>
                </Pressable>

                <Pressable
                    accessibilityLabel={`Decline dispatch ${job.reference}`}
                    accessibilityRole="button"
                    onPress={() => {
                        if (assignmentId) {
                            setDeclining(true);
                        }
                    }}
                    style={({ pressed }) => [
                        styles.btnDecline,
                        pressed && styles.btnPressed,
                    ]}
                    testID={`decline-assignment-btn-${job.id}`}
                >
                    <Icon color={theme.hazardRedText} name="close" size={16} />
                    <Text style={styles.btnDeclineText}>Decline</Text>
                </Pressable>
            </View>
        </View>
    );
};

export interface JobCardProgressActionsProps {
    job: DispatchJob;
    queuedDelayCommand?: OutboxCommand;
    onTransitionStatus?: (
        jobId: number,
        nextStatus: DispatchStatus,
        version: number,
    ) => void;
    onRequestCompletion: () => void;
    onReportDelay?: (job: DispatchJob) => void;
}

interface HoldStep {
    next: DispatchStatus;
    label: string;
    icon: IconName;
    testID: string;
    progressTestID: string;
    a11y: string;
}

const HEADING_TO_SITE: DispatchStatus[] = [
    'accepted',
    'dispatched',
    'en_route',
];

function holdStepFor(job: DispatchJob): HoldStep | null {
    const status = job.status?.value || 'scheduled';

    if (status === 'accepted' || status === 'dispatched') {
        return {
            next: 'en_route',
            label: 'Start Transit',
            icon: 'route',
            testID: `action-en-route-btn-${job.id}`,
            progressTestID: `transit-hold-progress-${job.id}`,
            a11y: `Start transit for ${job.reference}`,
        };
    }

    if (status === 'en_route') {
        return {
            next: 'arrived',
            label: 'Arrived On Site',
            icon: 'pin',
            testID: `action-arrive-btn-${job.id}`,
            progressTestID: `arrive-hold-progress-${job.id}`,
            a11y: `Arrived on site for ${job.reference}`,
        };
    }

    return null;
}

/**
 * The card's one gold primary action for the next lifecycle step, then any
 * delay state and the secondary Report Delay action.
 */
export const JobCardProgressActions: React.FC<JobCardProgressActionsProps> = ({
    job,
    queuedDelayCommand,
    onTransitionStatus,
    onRequestCompletion,
    onReportDelay,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const status = job.status?.value || 'scheduled';
    const canProgress =
        onTransitionStatus && job.capabilities?.can_update_status !== false;
    const holdStep = holdStepFor(job);

    const renderStep = () => {
        if (!canProgress) {
            return null;
        }

        if (holdStep) {
            return (
                <HoldToConfirmTransitButton
                    accessibilityLabel={holdStep.a11y}
                    icon={holdStep.icon}
                    label={holdStep.label}
                    onConfirm={() =>
                        onTransitionStatus(job.id, holdStep.next, job.version)
                    }
                    progressTestID={holdStep.progressTestID}
                    testID={holdStep.testID}
                />
            );
        }

        if (status === 'arrived' || status === 'working') {
            const isWorking = status === 'working';

            return (
                <Pressable
                    accessibilityLabel={
                        isWorking
                            ? `Complete job for ${job.reference}`
                            : `Begin work for ${job.reference}`
                    }
                    accessibilityRole="button"
                    onPress={() =>
                        isWorking
                            ? onRequestCompletion()
                            : onTransitionStatus(job.id, 'working', job.version)
                    }
                    style={({ pressed }) => [
                        styles.btnPrimary,
                        pressed && styles.btnPressed,
                    ]}
                    testID={
                        isWorking
                            ? `action-complete-btn-${job.id}`
                            : `action-start-work-btn-${job.id}`
                    }
                >
                    <Icon
                        color={theme.surfaceDark}
                        name={isWorking ? 'check' : 'crane'}
                        size={16}
                    />
                    <Text style={styles.btnPrimaryText}>
                        {isWorking ? 'Complete Job' : 'Begin Work'}
                    </Text>
                </Pressable>
            );
        }

        return null;
    };

    const step = renderStep();

    return (
        <View style={styles.nonPendingActionsContainer}>
            {step ? (
                <View style={styles.progressionActionRow}>{step}</View>
            ) : null}

            {HEADING_TO_SITE.includes(status) ? (
                <JobDirectionsButton job={job} />
            ) : null}

            <JobCardDelayBanner
                job={job}
                queuedDelayCommand={queuedDelayCommand}
            />

            {onReportDelay ? (
                <Pressable
                    accessibilityLabel={`Report delay for ${job.reference}`}
                    accessibilityRole="button"
                    onPress={() => onReportDelay(job)}
                    style={({ pressed }) => [
                        styles.btnReportDelay,
                        pressed && styles.btnPressed,
                    ]}
                    testID={`report-delay-btn-${job.id}`}
                >
                    <Icon color={theme.textPrimary} name="clock" size={16} />
                    <Text style={styles.btnReportDelayText}>Report Delay</Text>
                </Pressable>
            ) : null}
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        pendingActionBlock: {
            gap: 8,
            marginTop: 2,
        },
        pendingBanner: {
            alignItems: 'center',
            backgroundColor: theme.warningOrangeLight,
            borderColor: theme.warningOrange,
            borderRadius: 10,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 6,
            paddingHorizontal: 10,
            paddingVertical: 8,
        },
        pendingBannerText: {
            color: theme.warningOrangeText,
            flexShrink: 1,
            fontSize: 13,
            fontWeight: '500',
        },
        twoButtonRow: {
            flexDirection: 'row',
            gap: 10,
        },
        btnAccept: {
            alignItems: 'center',
            backgroundColor: theme.brandAmber,
            borderRadius: 12,
            flex: 1,
            flexDirection: 'row',
            gap: 6,
            justifyContent: 'center',
            minHeight: 52,
            paddingHorizontal: 12,
        },
        btnAcceptText: {
            color: theme.surfaceDark,
            fontSize: 15,
            fontWeight: '700',
        },
        btnDecline: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.hazardRed,
            borderRadius: 12,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 6,
            justifyContent: 'center',
            minHeight: 52,
            paddingHorizontal: 16,
        },
        btnDeclineText: {
            color: theme.hazardRedText,
            fontSize: 15,
            fontWeight: '700',
        },
        btnPressed: {
            transform: [{ scale: 0.985 }],
        },
        nonPendingActionsContainer: {
            gap: 8,
            marginTop: 10,
        },
        progressionActionRow: {
            marginBottom: 4,
        },
        btnPrimary: {
            alignItems: 'center',
            backgroundColor: theme.brandAmber,
            borderRadius: 12,
            flexDirection: 'row',
            gap: 8,
            justifyContent: 'center',
            minHeight: 52,
            paddingHorizontal: 16,
        },
        btnPrimaryText: {
            color: theme.surfaceDark,
            fontSize: 15,
            fontWeight: '700',
        },
        btnReportDelay: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.borderStrong,
            borderRadius: 12,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 8,
            justifyContent: 'center',
            minHeight: 48,
            paddingHorizontal: 14,
        },
        btnReportDelayText: {
            color: theme.textPrimary,
            fontSize: 14,
            fontWeight: '700',
        },
    });
