import React, { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import type {
    DispatchJob,
    DispatchStatus,
    OutboxCommand,
} from '../../types/index';
import { CommandConflictBanner } from '../panels/CommandConflictBanner';
import { DigitalSignatureModal } from '../signature/DigitalSignatureModal';
import type { DigitalSignatureData } from '../signature/DigitalSignatureModal';
import {
    JobCardProgressActions,
    JobCardResponseActions,
} from './job-card/job-card-actions';
import { JobCardDetails } from './job-card/job-card-details';
import { JobCardHeader } from './job-card/job-card-header';

export { HoldToConfirmTransitButton } from './job-card/hold-to-confirm-button';
export type { HoldToConfirmTransitButtonProps } from './job-card/hold-to-confirm-button';

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
    onReportDelay?: (job: DispatchJob) => void;
}

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
    const styles = useThemedStyles(createStyles);
    const [showCompletionSignature, setShowCompletionSignature] =
        useState(false);
    const isPendingResponse = job.my_assignment?.response_status === 'pending';

    return (
        <Pressable
            accessibilityLabel={`Dispatch assignment ${job.reference}, ${job.title}`}
            accessibilityRole="button"
            onPress={() => onSelectJob?.(job.id)}
            style={styles.cardRoot}
            testID={`job-card-${job.id}`}
        >
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

            <JobCardHeader
                isPendingResponse={isPendingResponse}
                job={job}
                onSelectJob={onSelectJob}
            />

            <JobCardDetails job={job} />

            {isPendingResponse && !hideAssignmentActions ? (
                <JobCardResponseActions
                    job={job}
                    onAcceptAssignment={onAcceptAssignment}
                    onRejectAssignment={onRejectAssignment}
                />
            ) : (
                <JobCardProgressActions
                    job={job}
                    onReportDelay={onReportDelay}
                    onRequestCompletion={() => setShowCompletionSignature(true)}
                    onTransitionStatus={onTransitionStatus}
                    queuedDelayCommand={queuedDelayCommand}
                />
            )}

            {showCompletionSignature ? (
                <DigitalSignatureModal
                    clientName={job.client}
                    jobReference={job.reference}
                    onClose={() => setShowCompletionSignature(false)}
                    requireWorkSummary
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

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        // Resting card: border only, no shadow.
        cardRoot: {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: 16,
            borderWidth: 1,
            marginBottom: 14,
            overflow: 'hidden',
            padding: 16,
        },
    });
