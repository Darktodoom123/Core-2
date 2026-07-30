import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { DispatchJob } from '../types/index';
import { colors, sharedStyles } from './nativeStyles';

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

            {!showRejectInput ? (
                <View style={styles.actions}>
                    <Pressable
                        accessibilityLabel="Accept assignment"
                        accessibilityRole="button"
                        onPress={() =>
                            onAccept(job.id, myAssignment.id, job.version)
                        }
                        style={({ pressed }) => [
                            sharedStyles.button,
                            styles.acceptButton,
                            pressed && styles.pressed,
                        ]}
                        testID="accept-assignment-btn"
                    >
                        <Text style={sharedStyles.buttonText}>
                            Accept assignment
                        </Text>
                    </Pressable>
                    <Pressable
                        accessibilityLabel="Reject assignment"
                        accessibilityRole="button"
                        onPress={() => setShowRejectInput(true)}
                        style={({ pressed }) => [
                            sharedStyles.button,
                            styles.rejectButton,
                            pressed && styles.pressed,
                        ]}
                        testID="reject-assignment-btn"
                    >
                        <Text style={sharedStyles.buttonText}>
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
                                sharedStyles.button,
                                styles.rejectButton,
                                pressed && styles.pressed,
                            ]}
                            testID="submit-rejection-btn"
                        >
                            <Text style={sharedStyles.buttonText}>
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
                                sharedStyles.button,
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

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.blueSoft,
        borderColor: colors.blueBorder,
        borderRadius: 10,
        borderWidth: 1,
        marginBottom: 16,
        padding: 16,
    },
    heading: {
        color: colors.blueDark,
        fontSize: 17,
        fontWeight: '800',
    },
    description: {
        color: colors.text,
        fontSize: 14,
        lineHeight: 21,
        marginBottom: 14,
        marginTop: 8,
    },
    actions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    acceptButton: {
        backgroundColor: colors.green,
        flexGrow: 1,
    },
    rejectButton: {
        backgroundColor: colors.red,
        flexGrow: 1,
    },
    cancelButton: {
        backgroundColor: colors.surfaceMuted,
        flexGrow: 1,
    },
    cancelButtonText: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '800',
        textAlign: 'center',
    },
    rejectForm: {
        gap: 8,
    },
    label: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '800',
    },
    input: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        color: colors.text,
        fontSize: 15,
        minHeight: 48,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    inputError: {
        borderColor: colors.red,
    },
    errorText: {
        color: colors.red,
        fontSize: 13,
    },
    pressed: {
        opacity: 0.78,
    },
});
