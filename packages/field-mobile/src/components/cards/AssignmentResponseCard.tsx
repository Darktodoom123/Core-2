import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import type { DispatchJob } from '../../types/index';

export interface AssignmentResponseCardProps {
    job: DispatchJob;
    onAccept: (jobId: number, assignmentId: number, version: number) => void;
    onReject: (
        jobId: number,
        assignmentId: number,
        reason: string,
        version: number,
    ) => void;
}

export const AssignmentResponseCard: React.FC<AssignmentResponseCardProps> = ({
    job,
    onAccept,
    onReject,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const myAssignment = job.my_assignment;
    const [showRejectInput, setShowRejectInput] = useState(false);
    const [reason, setReason] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    if (!myAssignment || myAssignment.response_status !== 'pending') {
        return null;
    }

    const handleRejectSubmit = () => {
        const trimmed = reason.trim();

        if (!trimmed) {
            setErrorMsg('A rejection reason is required.');

            return;
        }

        setErrorMsg('');
        onReject(job.id, myAssignment.id, trimmed, job.version);
        setShowRejectInput(false);
    };

    return (
        <View style={styles.card} testID="assignment-response-card">
            <Text accessibilityRole="header" style={styles.heading}>
                Assignment response required
            </Text>
            <Text style={styles.description}>
                You have been assigned to {job.reference} ({job.title}). Please
                accept or reject this assignment.
            </Text>
            <Text style={styles.consequenceText}>
                Accepting starts your field workflow. Rejecting requires a
                reason so dispatch can review the assignment.
            </Text>

            {!showRejectInput ? (
                <View style={styles.actions}>
                    <Pressable
                        accessibilityLabel="Accept assignment"
                        accessibilityRole="button"
                        onPress={() =>
                            onAccept(job.id, myAssignment.id, job.version)
                        }
                        style={({ pressed }) => [
                            styles.button,
                            styles.acceptButton,
                            pressed && styles.pressed,
                        ]}
                        testID="accept-assignment-btn"
                    >
                        <Text style={styles.acceptButtonText}>
                            Accept assignment
                        </Text>
                    </Pressable>
                    <Pressable
                        accessibilityLabel="Reject assignment"
                        accessibilityRole="button"
                        onPress={() => setShowRejectInput(true)}
                        style={({ pressed }) => [
                            styles.button,
                            styles.rejectButton,
                            pressed && styles.pressed,
                        ]}
                        testID="reject-assignment-btn"
                    >
                        <Text style={styles.secondaryButtonText}>
                            Reject assignment
                        </Text>
                    </Pressable>
                </View>
            ) : (
                <View style={styles.rejectForm}>
                    <Text
                        nativeID="rejection-reason-label"
                        style={styles.label}
                    >
                        Rejection reason (required)
                    </Text>
                    <TextInput
                        accessibilityLabel="Rejection reason"
                        accessibilityHint="Explain why you cannot accept this assignment"
                        autoCapitalize="sentences"
                        autoCorrect
                        blurOnSubmit={false}
                        onChangeText={(value) => {
                            setReason(value);

                            if (errorMsg) {
                                setErrorMsg('');
                            }
                        }}
                        onSubmitEditing={handleRejectSubmit}
                        placeholder="e.g. Rest cycle or equipment conflict"
                        placeholderTextColor={theme.textMuted}
                        returnKeyType="done"
                        style={[styles.input, errorMsg && styles.inputError]}
                        testID="rejection-reason-input"
                        value={reason}
                    />
                    {errorMsg ? (
                        <Text
                            accessibilityLiveRegion="assertive"
                            accessibilityRole="alert"
                            style={styles.errorText}
                        >
                            {errorMsg}
                        </Text>
                    ) : null}
                    <View style={styles.actions}>
                        <Pressable
                            accessibilityLabel="Confirm rejection"
                            accessibilityRole="button"
                            onPress={handleRejectSubmit}
                            style={({ pressed }) => [
                                styles.button,
                                styles.confirmRejectButton,
                                pressed && styles.pressed,
                            ]}
                            testID="submit-rejection-btn"
                        >
                            <Text style={styles.confirmRejectButtonText}>
                                Confirm rejection
                            </Text>
                        </Pressable>
                        <Pressable
                            accessibilityLabel="Cancel rejection"
                            accessibilityRole="button"
                            onPress={() => {
                                setShowRejectInput(false);
                                setErrorMsg('');
                            }}
                            style={({ pressed }) => [
                                styles.button,
                                styles.cancelButton,
                                pressed && styles.pressed,
                            ]}
                            testID="cancel-rejection-btn"
                        >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </Pressable>
                    </View>
                </View>
            )}
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        // A pending assignment needs the operator's attention: warning family.
        card: {
            backgroundColor: theme.warningOrangeLight,
            borderColor: theme.warningOrange,
            borderRadius: 12,
            borderWidth: 1,
            marginBottom: 16,
            padding: 16,
        },
        heading: {
            color: theme.warningOrangeText,
            fontSize: 17,
            fontWeight: '700',
        },
        description: {
            color: theme.textPrimary,
            fontSize: 14,
            lineHeight: 21,
            marginTop: 8,
        },
        consequenceText: {
            color: theme.textSecondary,
            fontSize: 13,
            lineHeight: 19,
            marginBottom: 14,
            marginTop: 8,
        },
        actions: {
            alignItems: 'stretch',
            flexDirection: 'column',
            gap: 10,
        },
        button: {
            alignItems: 'center',
            borderRadius: 12,
            justifyContent: 'center',
            minHeight: 48,
            paddingHorizontal: 18,
            width: '100%',
        },
        acceptButton: {
            backgroundColor: theme.brandAmber,
            minHeight: 52,
        },
        acceptButtonText: {
            color: theme.surfaceDark,
            fontSize: 15,
            fontWeight: '700',
            textAlign: 'center',
        },
        rejectButton: {
            backgroundColor: theme.surface,
            borderColor: theme.borderStrong,
            borderWidth: 1,
        },
        confirmRejectButton: {
            backgroundColor: theme.hazardRed,
        },
        confirmRejectButtonText: {
            color: theme.textInverse,
            fontSize: 15,
            fontWeight: '700',
            textAlign: 'center',
        },
        secondaryButtonText: {
            color: theme.textPrimary,
            fontSize: 15,
            fontWeight: '700',
            textAlign: 'center',
        },
        cancelButton: {
            backgroundColor: theme.surfaceHighlight,
            borderColor: theme.border,
            borderWidth: 1,
        },
        cancelButtonText: {
            color: theme.textPrimary,
            fontSize: 14,
            fontWeight: '700',
            textAlign: 'center',
        },
        rejectForm: {
            gap: 8,
        },
        label: {
            color: theme.textPrimary,
            fontSize: 13,
            fontWeight: '700',
        },
        input: {
            backgroundColor: theme.surface,
            borderColor: theme.borderStrong,
            borderRadius: 8,
            borderWidth: 1,
            color: theme.textPrimary,
            fontSize: 16,
            minHeight: 48,
            paddingHorizontal: 12,
            paddingVertical: 10,
        },
        inputError: {
            borderColor: theme.hazardRed,
        },
        errorText: {
            color: theme.hazardRedText,
            fontSize: 13,
        },
        pressed: {
            opacity: 0.78,
        },
    });
