import React, { useState } from 'react';
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import { DECLINE_REASONS, declineReasonText } from './decline-reason';
import type { DeclineReason } from './decline-reason';

export interface DeclineReasonSheetProps {
    visible: boolean;
    jobReference?: string;
    onCancel: () => void;
    onConfirm: (reason: string) => void;
}

/**
 * Asks why before declining a dispatch. Nothing is sent until a reason is
 * chosen, so dispatch never gets a made-up one.
 */
export const DeclineReasonSheet: React.FC<DeclineReasonSheetProps> = ({
    visible,
    jobReference,
    onCancel,
    onConfirm,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const [reason, setReason] = useState<DeclineReason | null>(null);
    const [note, setNote] = useState('');
    const text = declineReasonText(reason, note);

    const close = () => {
        setReason(null);
        setNote('');
        onCancel();
    };

    return (
        <Modal
            animationType="fade"
            onRequestClose={close}
            transparent
            visible={visible}
        >
            <View style={styles.overlay} testID="decline-reason-sheet">
                <View style={styles.dialog}>
                    <ScrollView keyboardShouldPersistTaps="handled">
                        <Text accessibilityRole="header" style={styles.title}>
                            Decline {jobReference ?? 'this dispatch'}?
                        </Text>
                        <Text style={styles.subtitle}>
                            Dispatch sees your reason and reassigns the job.
                        </Text>

                        <View
                            accessibilityRole="radiogroup"
                            style={styles.list}
                        >
                            {DECLINE_REASONS.map((option) => {
                                const selected = option === reason;

                                return (
                                    <Pressable
                                        accessibilityRole="radio"
                                        accessibilityState={{
                                            checked: selected,
                                        }}
                                        key={option}
                                        onPress={() => setReason(option)}
                                        style={({ pressed }) => [
                                            styles.option,
                                            selected && styles.optionSelected,
                                            pressed && styles.pressed,
                                        ]}
                                        testID={`decline-reason-${option}`}
                                    >
                                        <View
                                            style={[
                                                styles.radio,
                                                selected && styles.radioOn,
                                            ]}
                                        >
                                            {selected ? (
                                                <View style={styles.radioDot} />
                                            ) : null}
                                        </View>
                                        <Text style={styles.optionText}>
                                            {option}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        <Text style={styles.label}>
                            {reason === 'Other'
                                ? 'What is the reason? · required'
                                : 'Anything dispatch should know · optional'}
                        </Text>
                        <TextInput
                            accessibilityLabel="Decline details"
                            maxLength={500}
                            multiline
                            onChangeText={setNote}
                            placeholderTextColor={theme.textMuted}
                            style={styles.input}
                            testID="decline-reason-note"
                            value={note}
                        />

                        <View style={styles.actions}>
                            <Pressable
                                accessibilityRole="button"
                                onPress={close}
                                style={({ pressed }) => [
                                    styles.cancel,
                                    pressed && styles.pressed,
                                ]}
                                testID="decline-reason-cancel"
                            >
                                <Text style={styles.cancelText}>
                                    Keep dispatch
                                </Text>
                            </Pressable>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityState={{ disabled: !text }}
                                disabled={!text}
                                onPress={() => {
                                    if (text) {
                                        setReason(null);
                                        setNote('');
                                        onConfirm(text);
                                    }
                                }}
                                style={({ pressed }) => [
                                    styles.confirm,
                                    !text && styles.disabled,
                                    pressed && styles.pressed,
                                ]}
                                testID="decline-reason-confirm"
                            >
                                <Text style={styles.confirmText}>Decline</Text>
                            </Pressable>
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        overlay: {
            alignItems: 'center',
            backgroundColor: `${theme.surfaceDark}B8`,
            flex: 1,
            justifyContent: 'center',
            padding: 20,
        },
        dialog: {
            backgroundColor: theme.surfaceElevated,
            borderColor: theme.border,
            borderRadius: 16,
            borderWidth: 1,
            maxHeight: '90%',
            maxWidth: 480,
            padding: 20,
            width: '100%',
        },
        title: {
            color: theme.textPrimary,
            fontSize: 19,
            fontWeight: '700',
        },
        subtitle: {
            color: theme.textSecondary,
            fontSize: 14,
            lineHeight: 20,
            marginTop: 4,
        },
        list: {
            gap: 8,
            marginTop: 16,
        },
        option: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: 12,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 10,
            minHeight: 48,
            paddingHorizontal: 14,
        },
        optionSelected: {
            backgroundColor: theme.surfaceHighlight,
            borderColor: theme.borderStrong,
            borderWidth: 2,
        },
        radio: {
            alignItems: 'center',
            borderColor: theme.textMuted,
            borderRadius: 10,
            borderWidth: 2,
            height: 20,
            justifyContent: 'center',
            width: 20,
        },
        radioOn: {
            borderColor: theme.textPrimary,
        },
        radioDot: {
            backgroundColor: theme.textPrimary,
            borderRadius: 5,
            height: 10,
            width: 10,
        },
        optionText: {
            color: theme.textPrimary,
            fontSize: 15,
            fontWeight: '600',
        },
        label: {
            color: theme.textSecondary,
            fontSize: 13,
            fontWeight: '600',
            marginTop: 16,
        },
        input: {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: 12,
            borderWidth: 1,
            color: theme.textPrimary,
            fontSize: 15,
            marginTop: 6,
            minHeight: 72,
            padding: 12,
            textAlignVertical: 'top',
        },
        actions: {
            flexDirection: 'row',
            gap: 10,
            marginTop: 20,
        },
        cancel: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.borderStrong,
            borderRadius: 12,
            borderWidth: 1,
            flex: 1,
            justifyContent: 'center',
            minHeight: 52,
        },
        cancelText: {
            color: theme.textPrimary,
            fontSize: 15,
            fontWeight: '700',
        },
        // Declining is destructive for the assignment: the red role.
        confirm: {
            alignItems: 'center',
            backgroundColor: theme.hazardRed,
            borderRadius: 12,
            flex: 1,
            justifyContent: 'center',
            minHeight: 52,
        },
        confirmText: {
            color: theme.textOnDark,
            fontSize: 15,
            fontWeight: '700',
        },
        disabled: {
            opacity: 0.45,
        },
        pressed: {
            opacity: 0.78,
        },
    });
