import React, { useState } from 'react';
import {
    KeyboardAvoidingView,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useTheme, useThemedStyles } from '../../../theme';
import type { ThemeColors } from '../../../theme';
import { Icon } from '../../common/Icon';

export interface ReplacementRequestSheetProps {
    visible: boolean;
    /** The unit the operator is assigned to now. */
    assetCode?: string;
    /** False when there is no job to attach the request to. */
    canSend: boolean;
    onSend: (note: string) => void;
    onClose: () => void;
}

/**
 * Asks dispatch for a replacement unit. Only dispatch assigns units, so the
 * operator stays on their unit until the job is reassigned.
 */
export const ReplacementRequestSheet: React.FC<ReplacementRequestSheetProps> = (
    props,
) => (props.visible ? <ReplacementRequestBody {...props} /> : null);

const ReplacementRequestBody: React.FC<ReplacementRequestSheetProps> = ({
    assetCode,
    canSend,
    onSend,
    onClose,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const [note, setNote] = useState('');
    const isReady = canSend && note.trim().length > 0;

    return (
        <Modal
            animationType="slide"
            onRequestClose={onClose}
            transparent
            visible
        >
            <KeyboardAvoidingView behavior="height" style={styles.overlay}>
                <Pressable
                    accessibilityLabel="Close"
                    onPress={onClose}
                    style={[StyleSheet.absoluteFill, styles.scrim]}
                />
                <View style={styles.sheet} testID="replacement-request-sheet">
                    <View style={styles.header}>
                        <Text accessibilityRole="header" style={styles.title}>
                            Ask dispatch for a replacement
                        </Text>
                        <Pressable
                            accessibilityLabel="Close"
                            accessibilityRole="button"
                            hitSlop={8}
                            onPress={onClose}
                            style={styles.close}
                            testID="replacement-request-close"
                        >
                            <Icon
                                color={theme.textPrimary}
                                name="close"
                                size={20}
                            />
                        </Pressable>
                    </View>

                    {assetCode ? (
                        <Text
                            style={styles.unit}
                        >{`Your unit: ${assetCode}`}</Text>
                    ) : null}

                    <View style={styles.note}>
                        <Icon
                            color={theme.textSecondary}
                            name="alert-circle"
                            size={16}
                        />
                        <Text style={styles.noteText}>
                            Only dispatch can assign another unit. You stay on
                            this one until they do, and your job updates when
                            they reassign it.
                        </Text>
                    </View>

                    {canSend ? (
                        <>
                            <Text style={styles.label}>
                                What’s wrong with this unit?
                            </Text>
                            <TextInput
                                accessibilityLabel="What’s wrong with this unit"
                                multiline
                                onChangeText={setNote}
                                placeholder="e.g. Hoist brake slipping under load"
                                placeholderTextColor={theme.textSecondary}
                                style={styles.input}
                                testID="replacement-request-note"
                                value={note}
                            />
                        </>
                    ) : (
                        <View
                            style={styles.noJob}
                            testID="replacement-request-no-job"
                        >
                            <Icon
                                color={theme.warningOrangeText}
                                name="alert"
                                size={16}
                            />
                            <Text style={styles.noJobText}>
                                You have no job to send this with. Your
                                inspection already told dispatch the unit is
                                locked; go on standby and call dispatch.
                            </Text>
                        </View>
                    )}

                    {canSend ? (
                        <Pressable
                            accessibilityRole="button"
                            accessibilityState={{ disabled: !isReady }}
                            disabled={!isReady}
                            onPress={() => {
                                onSend(note.trim());
                                onClose();
                            }}
                            style={[
                                styles.send,
                                isReady ? null : styles.sendDisabled,
                            ]}
                            testID="replacement-request-send"
                        >
                            <Icon
                                color={
                                    isReady
                                        ? theme.surfaceDark
                                        : theme.textSecondary
                                }
                                name="message"
                                size={18}
                            />
                            <Text
                                style={[
                                    styles.sendText,
                                    isReady ? null : styles.sendTextDisabled,
                                ]}
                            >
                                Send to dispatch
                            </Text>
                        </Pressable>
                    ) : null}
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        overlay: {
            flex: 1,
            justifyContent: 'flex-end',
        },
        scrim: {
            backgroundColor: theme.surfaceDark,
            opacity: 0.6,
        },
        sheet: {
            backgroundColor: theme.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            gap: 12,
            padding: 20,
            paddingBottom: 28,
        },
        header: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: 12,
        },
        title: {
            color: theme.textPrimary,
            flex: 1,
            fontSize: 18,
            fontWeight: '700',
        },
        close: {
            alignItems: 'center',
            borderColor: theme.border,
            borderRadius: 12,
            borderWidth: 1,
            height: 48,
            justifyContent: 'center',
            width: 48,
        },
        unit: {
            color: theme.textSecondary,
            fontSize: 14,
            fontWeight: '600',
        },
        note: {
            alignItems: 'flex-start',
            backgroundColor: theme.surfaceHighlight,
            borderRadius: 12,
            flexDirection: 'row',
            gap: 8,
            padding: 12,
        },
        noteText: {
            color: theme.textPrimary,
            flex: 1,
            fontSize: 14,
            lineHeight: 20,
        },
        label: {
            color: theme.textPrimary,
            fontSize: 14,
            fontWeight: '600',
        },
        input: {
            backgroundColor: theme.canvas,
            borderColor: theme.borderStrong,
            borderRadius: 12,
            borderWidth: 1,
            color: theme.textPrimary,
            fontSize: 16,
            minHeight: 96,
            padding: 12,
            textAlignVertical: 'top',
        },
        noJob: {
            alignItems: 'flex-start',
            backgroundColor: theme.warningOrangeLight,
            borderRadius: 12,
            flexDirection: 'row',
            gap: 8,
            padding: 12,
        },
        noJobText: {
            color: theme.warningOrangeText,
            flex: 1,
            fontSize: 14,
            lineHeight: 20,
        },
        send: {
            alignItems: 'center',
            backgroundColor: theme.brandAmber,
            borderRadius: 12,
            flexDirection: 'row',
            gap: 8,
            justifyContent: 'center',
            minHeight: 52,
        },
        sendDisabled: {
            backgroundColor: theme.surfaceHighlight,
        },
        sendText: {
            color: theme.surfaceDark,
            fontSize: 16,
            fontWeight: '700',
        },
        sendTextDisabled: {
            color: theme.textSecondary,
        },
    });
