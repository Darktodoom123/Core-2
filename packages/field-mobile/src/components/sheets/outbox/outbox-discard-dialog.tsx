import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { OutboxItemDisplay } from '../../../services/outboxProjection';
import { useTheme, useThemedStyles } from '../../../theme';
import type { ThemeColors } from '../../../theme';

export interface OutboxDiscardDialogProps {
    item: OutboxItemDisplay;
    onCancel: () => void;
    onConfirm: () => void;
}

/** Confirms a permanent discard; the destructive choice is red. */
export const OutboxDiscardDialog: React.FC<OutboxDiscardDialogProps> = ({
    item,
    onCancel,
    onConfirm,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);

    return (
        <View
            style={[StyleSheet.absoluteFill, styles.backdrop]}
            testID="discard-confirm-dialog"
        >
            <View
                pointerEvents="none"
                style={[
                    StyleSheet.absoluteFill,
                    styles.scrim,
                    { backgroundColor: theme.surfaceDark },
                ]}
            />
            <View style={styles.card}>
                <Text accessibilityRole="header" style={styles.title}>
                    Discard Unsynced Action?
                </Text>
                <Text style={styles.message}>
                    {item.isUncertainOutcome
                        ? `The server outcome is uncertain: this action was sent, but the connection timed out before a reply. If dispatch already processed it, discarding it here will not undo it.\n\nPermanently discard "${item.title}"?`
                        : `Permanently discard "${item.title}"? The data saved on this phone will be lost and cannot be recovered.`}
                </Text>
                <View style={styles.actions}>
                    <Pressable
                        accessibilityLabel="Cancel discard"
                        accessibilityRole="button"
                        onPress={onCancel}
                        style={({ pressed }) => [
                            styles.button,
                            styles.cancel,
                            pressed && styles.pressed,
                        ]}
                        testID="cancel-discard-btn"
                    >
                        <Text style={styles.cancelText}>Keep Action</Text>
                    </Pressable>
                    <Pressable
                        accessibilityLabel="Confirm discard"
                        accessibilityRole="button"
                        onPress={onConfirm}
                        style={({ pressed }) => [
                            styles.button,
                            styles.confirm,
                            pressed && styles.pressed,
                        ]}
                        testID="confirm-discard-btn"
                    >
                        <Text style={styles.confirmText}>Discard</Text>
                    </Pressable>
                </View>
            </View>
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        backdrop: {
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
        },
        scrim: {
            opacity: 0.6,
        },
        card: {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: 16,
            borderWidth: 1,
            elevation: 16,
            gap: 12,
            maxWidth: 420,
            padding: 20,
            width: '100%',
        },
        title: {
            color: theme.textPrimary,
            fontSize: 18,
            fontWeight: '700',
        },
        message: {
            color: theme.textPrimary,
            fontSize: 14,
            lineHeight: 20,
        },
        actions: {
            flexDirection: 'row',
            gap: 10,
            marginTop: 4,
        },
        button: {
            alignItems: 'center',
            borderRadius: 12,
            flex: 1,
            justifyContent: 'center',
            minHeight: 52,
        },
        cancel: {
            backgroundColor: theme.surface,
            borderColor: theme.borderStrong,
            borderWidth: 1,
        },
        cancelText: {
            color: theme.textPrimary,
            fontSize: 15,
            fontWeight: '700',
        },
        confirm: {
            backgroundColor: theme.hazardRed,
        },
        confirmText: {
            color: theme.textInverse,
            fontSize: 15,
            fontWeight: '700',
        },
        pressed: {
            opacity: 0.85,
        },
    });
