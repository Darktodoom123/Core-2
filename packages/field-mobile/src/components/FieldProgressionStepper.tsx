import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DispatchJob, DispatchStatus } from '../types/index';
import { colors, sharedStyles } from './nativeStyles';

export interface FieldProgressionStepperProps {
    job: DispatchJob;
    onTransitionStatus: (
        jobId: number,
        nextStatus: DispatchStatus,
        version: number,
    ) => void;
}

export const FieldProgressionStepper: React.FC<
    FieldProgressionStepperProps
> = ({ job, onTransitionStatus }) => {
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

    return (
        <View style={styles.card} testID="field-progression-stepper">
            <Text accessibilityRole="header" style={styles.heading}>
                Job progress
            </Text>

            {nextStep ? (
                <View style={styles.nextCard} testID="next-step-card">
                    <Text style={styles.nextEyebrow}>YOUR NEXT ACTION</Text>
                    <Text style={styles.nextTitle}>
                        {nextStep.confirmation_title}
                    </Text>
                    <Text style={styles.nextActionLabel}>
                        Server will record: {nextStep.status.label}
                    </Text>
                    <Text style={styles.nextMessage}>
                        {nextStep.confirmation_message}
                    </Text>
                    <Pressable
                        accessibilityLabel={`${nextStep.action_label}, version ${job.version}`}
                        accessibilityRole="button"
                        onPress={() =>
                            onTransitionStatus(
                                job.id,
                                nextStep.status.value,
                                job.version,
                            )
                        }
                        style={({ pressed }) => [
                            sharedStyles.button,
                            styles.advanceButton,
                            pressed && styles.pressed,
                        ]}
                        testID="advance-status-btn"
                    >
                        <Text style={sharedStyles.buttonText}>
                            {nextStep.action_label}
                        </Text>
                    </Pressable>
                </View>
            ) : null}

            <Text style={styles.progressLabel}>Progress history</Text>
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
                                <Text
                                    style={[
                                        styles.stepNumber,
                                        (isComplete || isCurrent) &&
                                            styles.activeStepNumber,
                                    ]}
                                >
                                    {index + 1}
                                </Text>
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
                                        ? 'Complete'
                                        : isCurrent
                                          ? 'Current step'
                                          : 'Upcoming'}
                                </Text>
                            </View>
                        </View>
                    );
                })}
            </View>

            {!nextStep ? (
                <Text style={styles.completeMessage}>
                    Completed — {progression.message}
                </Text>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    inactiveCard: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 10,
        borderWidth: 1,
        marginBottom: 16,
        padding: 14,
    },
    inactiveText: {
        color: colors.secondary,
        fontSize: 14,
        lineHeight: 20,
    },
    card: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 16,
        padding: 16,
    },
    heading: {
        color: colors.text,
        fontSize: 17,
        fontWeight: '800',
        marginBottom: 14,
    },
    steps: {
        gap: 6,
    },
    progressLabel: {
        color: colors.muted,
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.4,
        marginBottom: 6,
        textTransform: 'uppercase',
    },
    stepRow: {
        alignItems: 'center',
        borderRadius: 8,
        flexDirection: 'row',
        gap: 12,
        minHeight: 56,
        paddingHorizontal: 8,
        paddingVertical: 8,
    },
    currentStepRow: {
        backgroundColor: colors.amberLight,
    },
    stepMark: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 18,
        borderWidth: 1,
        height: 36,
        justifyContent: 'center',
        width: 36,
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
        color: colors.secondary,
        fontSize: 13,
        fontWeight: '800',
        fontVariant: ['tabular-nums'],
    },
    activeStepNumber: {
        color: colors.white,
    },
    stepCopy: {
        flex: 1,
    },
    stepText: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '700',
    },
    completeText: {
        color: colors.greenDark,
    },
    currentText: {
        color: colors.amberDark,
        fontWeight: '800',
    },
    stepState: {
        color: colors.muted,
        fontSize: 12,
        marginTop: 2,
    },
    nextCard: {
        backgroundColor: colors.amberLight,
        borderColor: colors.amberBorder,
        borderRadius: 10,
        borderWidth: 1,
        marginBottom: 16,
        padding: 14,
    },
    nextEyebrow: {
        color: colors.amberDark,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.8,
        marginBottom: 5,
    },
    nextActionLabel: {
        color: colors.amberDark,
        fontSize: 14,
        fontWeight: '800',
        marginTop: 5,
    },
    nextTitle: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '800',
    },
    nextMessage: {
        color: colors.secondary,
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 12,
        marginTop: 4,
    },
    advanceButton: {
        backgroundColor: colors.amber,
    },
    completeMessage: {
        color: colors.green,
        fontSize: 14,
        fontWeight: '800',
        marginTop: 16,
    },
    pressed: {
        opacity: 0.78,
    },
});
