import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
                Forward-only field progression
            </Text>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.steps}
            >
                {progression.steps.map((step) => {
                    const isComplete = step.state === 'complete';
                    const isCurrent = step.state === 'current';

                    return (
                        <View
                            key={step.status.value}
                            accessibilityLabel={`${step.status.label}: ${step.state}`}
                            style={[
                                styles.stepPill,
                                isComplete && styles.completePill,
                                isCurrent && styles.currentPill,
                            ]}
                            testID={`step-pill-${step.status.value}`}
                        >
                            <Text
                                style={[
                                    styles.stepText,
                                    isComplete && styles.completeText,
                                    isCurrent && styles.currentText,
                                ]}
                            >
                                {isComplete ? '✓ ' : ''}
                                {step.status.label}
                            </Text>
                        </View>
                    );
                })}
            </ScrollView>

            {nextStep ? (
                <View style={styles.nextCard} testID="next-step-card">
                    <Text style={styles.nextTitle}>
                        Next milestone: {nextStep.confirmation_title}
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
                            {nextStep.action_label} (v{job.version})
                        </Text>
                    </Pressable>
                </View>
            ) : (
                <Text style={styles.completeMessage}>
                    ✓ {progression.message}
                </Text>
            )}
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
        borderRadius: 10,
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
        gap: 8,
        paddingBottom: 4,
    },
    stepPill: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 18,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    completePill: {
        backgroundColor: colors.greenSoft,
        borderColor: colors.greenBorder,
    },
    currentPill: {
        backgroundColor: colors.blueSoft,
        borderColor: colors.blueBorder,
    },
    stepText: {
        color: colors.secondary,
        fontSize: 12,
    },
    completeText: {
        color: colors.green,
        fontWeight: '700',
    },
    currentText: {
        color: colors.blue,
        fontWeight: '800',
    },
    nextCard: {
        backgroundColor: colors.surfaceMuted,
        borderLeftColor: colors.blue,
        borderLeftWidth: 4,
        borderRadius: 6,
        marginTop: 16,
        padding: 14,
    },
    nextTitle: {
        color: colors.blue,
        fontSize: 15,
        fontWeight: '800',
    },
    nextMessage: {
        color: colors.secondary,
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 12,
        marginTop: 6,
    },
    advanceButton: {
        backgroundColor: colors.blue,
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
