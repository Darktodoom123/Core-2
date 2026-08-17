import React from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import type { DispatchJob, DispatchStatus } from '../../types/index';
import { Icon } from '../common/Icon';
import { colors, shadows } from '../nativeStyles';

export interface FieldProgressionStepperProps {
    job: DispatchJob;
    isProcessing?: boolean;
    isParkedAndSecured?: boolean;
    isCraneSetupComplete?: boolean;
    onTransitionStatus: (
        jobId: number,
        nextStatus: DispatchStatus,
        version: number,
    ) => void;
}

export const FieldProgressionStepper: React.FC<
    FieldProgressionStepperProps
> = ({
    job,
    isProcessing = false,
    isParkedAndSecured = false,
    isCraneSetupComplete = false,
    onTransitionStatus,
}) => {
    const progression = job.progression;

    if (!progression || !job.capabilities.can_update_status) {
        return (
            <View style={styles.inactiveCard}>
                <Text style={styles.inactiveText}>
                    Status progression is not active for this dispatch.
                </Text>
            </View>
        );
    }

    const nextStep = progression.next;
    const isCrane = job.asset_assignments?.some(
        (a) => a.asset_kind === 'crane' || a.asset_kind === 'mobile_crane',
    );

    // Safety Gating Logic
    let isGated = false;
    let gateReason: string | null = null;

    if (
        job.status.value === 'arrived' &&
        nextStep?.status.value === 'working'
    ) {
        if (!isParkedAndSecured) {
            isGated = true;
            gateReason =
                'Parked & Secured verification is required before initiating crane setup or operation.';
        } else if (isCrane && !isCraneSetupComplete) {
            isGated = true;
            gateReason =
                'Crane Setup Safety Checklist & Exclusion Zone checks must be verified before starting work.';
        }
    }

    const isDisabled = isProcessing || isGated;

    return (
        <View style={styles.card} testID="field-progression-stepper">
            <Text accessibilityRole="header" style={styles.heading}>
                Job Progress & Workflow
            </Text>

            {nextStep ? (
                <View style={styles.nextCard} testID="next-step-card">
                    <View style={styles.nextHeaderRow}>
                        <View style={styles.nextActionPill}>
                            <Text style={styles.nextEyebrow}>
                                YOUR NEXT ACTION
                            </Text>
                        </View>
                        <Text style={styles.nextActionLabel}>
                            Server will record: {nextStep.status.label}
                        </Text>
                    </View>

                    <Text style={styles.nextTitle}>
                        {nextStep.confirmation_title}
                    </Text>
                    <Text style={styles.nextMessage}>
                        {nextStep.confirmation_message}
                    </Text>

                    {gateReason ? (
                        <View
                            style={styles.gatedBanner}
                            testID="progression-gate-banner"
                        >
                            <Icon
                                name="alert"
                                size={18}
                                color={colors.warningDark}
                            />
                            <Text style={styles.gatedText}>{gateReason}</Text>
                        </View>
                    ) : null}

                    <Pressable
                        accessibilityLabel={`${nextStep.action_label}, version ${job.version}`}
                        accessibilityRole="button"
                        accessibilityState={{
                            busy: isProcessing,
                            disabled: isDisabled,
                        }}
                        disabled={isDisabled}
                        onPress={() =>
                            onTransitionStatus(
                                job.id,
                                nextStep.status.value,
                                job.version,
                            )
                        }
                        style={({ pressed }) => [
                            styles.advanceButton,
                            isDisabled && styles.advanceButtonDisabled,
                            pressed && !isDisabled && styles.pressed,
                        ]}
                        testID="advance-status-btn"
                    >
                        {isProcessing ? (
                            <View style={styles.processingRow}>
                                <ActivityIndicator
                                    color={colors.text}
                                    size="small"
                                />
                                <Text style={styles.processingText}>
                                    Updating status…
                                </Text>
                            </View>
                        ) : (
                            <Text
                                style={[
                                    styles.advanceButtonText,
                                    isDisabled &&
                                        styles.advanceButtonTextDisabled,
                                ]}
                            >
                                {nextStep.action_label}
                            </Text>
                        )}
                    </Pressable>
                </View>
            ) : null}

            <Text style={styles.progressLabel}>Workflow Stages</Text>
            <View style={styles.steps}>
                {progression.steps.map((step, index) => {
                    const isComplete = step.state === 'complete';
                    const isCurrent = step.state === 'current';

                    return (
                        <View
                            key={step.status.value}
                            accessibilityLabel={`${step.status.label}: ${step.state}`}
                            style={[
                                styles.stepRow,
                                isCurrent && styles.currentStepRow,
                            ]}
                            testID={`step-pill-${step.status.value}`}
                        >
                            <View
                                style={[
                                    styles.stepMark,
                                    isComplete && styles.completeMark,
                                    isCurrent && styles.currentMark,
                                ]}
                            >
                                {isComplete ? (
                                    <Icon
                                        name="check"
                                        size={14}
                                        color={colors.white}
                                    />
                                ) : (
                                    <Text
                                        style={[
                                            styles.stepNumber,
                                            isCurrent &&
                                                styles.activeStepNumber,
                                        ]}
                                    >
                                        {index + 1}
                                    </Text>
                                )}
                            </View>
                            <View style={styles.stepCopy}>
                                <Text
                                    style={[
                                        styles.stepText,
                                        isComplete && styles.completeText,
                                        isCurrent && styles.currentText,
                                    ]}
                                >
                                    {step.status.label}
                                </Text>
                                <Text style={styles.stepState}>
                                    {isComplete
                                        ? 'Completed'
                                        : isCurrent
                                          ? 'Active stage'
                                          : 'Upcoming'}
                                </Text>
                            </View>
                        </View>
                    );
                })}
            </View>

            {!nextStep ? (
                <View style={styles.completeBanner}>
                    <Icon
                        name="check-circle"
                        size={20}
                        color={colors.greenDark}
                    />
                    <Text style={styles.completeMessage}>
                        {progression.message || 'Job completed successfully'}
                    </Text>
                </View>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    inactiveCard: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 16,
        padding: 16,
    },
    inactiveText: {
        color: colors.secondary,
        fontSize: 14,
        lineHeight: 20,
    },
    card: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 16,
        padding: 16,
        ...shadows.md,
    },
    heading: {
        color: colors.text,
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: -0.2,
        marginBottom: 14,
    },
    nextCard: {
        backgroundColor: colors.amberLight,
        borderColor: colors.amberBorder,
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 18,
        padding: 16,
        ...shadows.sm,
    },
    nextHeaderRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    nextActionPill: {
        backgroundColor: colors.amberSoft,
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    nextEyebrow: {
        color: colors.amberDark,
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    nextActionLabel: {
        color: colors.secondary,
        fontSize: 12,
        fontWeight: '500',
    },
    nextTitle: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: -0.2,
        marginBottom: 4,
    },
    nextMessage: {
        color: colors.secondary,
        fontSize: 13,
        lineHeight: 19,
        marginBottom: 14,
    },
    gatedBanner: {
        alignItems: 'center',
        backgroundColor: colors.warningSoft,
        borderColor: colors.warningBorder,
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 8,
        marginBottom: 14,
        padding: 10,
    },
    gatedText: {
        color: colors.warningDark,
        flex: 1,
        fontSize: 12,
        fontWeight: '600',
        lineHeight: 17,
    },
    advanceButton: {
        alignItems: 'center',
        backgroundColor: colors.amber,
        borderRadius: 12,
        justifyContent: 'center',
        minHeight: 48,
        paddingHorizontal: 16,
        ...shadows.sm,
    },
    advanceButtonDisabled: {
        backgroundColor: colors.border,
        opacity: 0.6,
    },
    advanceButtonText: {
        color: '#0f172a',
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: -0.1,
    },
    advanceButtonTextDisabled: {
        color: colors.muted,
    },
    processingRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    processingText: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '600',
    },
    progressLabel: {
        color: colors.muted,
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.3,
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    steps: {
        gap: 4,
    },
    stepRow: {
        alignItems: 'center',
        borderRadius: 10,
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 8,
        paddingVertical: 10,
    },
    currentStepRow: {
        backgroundColor: colors.surfaceMuted,
    },
    stepMark: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 16,
        borderWidth: 1,
        height: 32,
        justifyContent: 'center',
        width: 32,
    },
    completeMark: {
        backgroundColor: colors.green,
        borderColor: colors.green,
    },
    currentMark: {
        backgroundColor: colors.amber,
        borderColor: colors.amber,
    },
    stepNumber: {
        color: colors.muted,
        fontSize: 12,
        fontWeight: '700',
    },
    activeStepNumber: {
        color: colors.white,
    },
    stepCopy: {
        flex: 1,
    },
    stepText: {
        color: colors.secondary,
        fontSize: 14,
        fontWeight: '600',
    },
    completeText: {
        color: colors.text,
    },
    currentText: {
        color: colors.text,
        fontWeight: '700',
    },
    stepState: {
        color: colors.muted,
        fontSize: 11,
        marginTop: 1,
    },
    completeBanner: {
        alignItems: 'center',
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 8,
        marginTop: 14,
        padding: 12,
    },
    completeMessage: {
        color: colors.greenDark,
        flex: 1,
        fontSize: 13,
        fontWeight: '600',
    },
    pressed: {
        opacity: 0.78,
    },
});
