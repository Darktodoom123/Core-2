import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { OutboxCommand } from '../../types/index';
import { colors, sharedStyles } from '../nativeStyles';

export interface FailedCommandsListProps {
    failedCommands: OutboxCommand[];
    onRetryCommand?: (commandId: string) => void;
    onDiscardCommand?: (commandId: string) => void;
}

export const FailedCommandsList: React.FC<FailedCommandsListProps> = ({
    failedCommands,
    onRetryCommand,
    onDiscardCommand,
}) => {
    if (failedCommands.length === 0) {
        return null;
    }

    return (
        <View style={styles.container}>
            {failedCommands.map((command) => (
                <View
                    accessible
                    accessibilityRole="alert"
                    key={command.id}
                    style={styles.failedCommand}
                    testID={`failed-command-${command.id}`}
                >
                    <Text style={styles.failedTitle}>
                        Action needs review: {command.type.replaceAll('_', ' ')}
                    </Text>
                    <Text style={styles.failedMessage}>
                        {command.error?.message ||
                            'This command could not be synced.'}
                    </Text>
                    <Text style={styles.failedMeta}>
                        Attempts: {command.attempts}
                    </Text>
                    <View style={styles.failedActions}>
                        {command.error?.retryable && onRetryCommand ? (
                            <Pressable
                                accessibilityLabel="Retry failed command"
                                accessibilityRole="button"
                                onPress={() => onRetryCommand(command.id)}
                                style={({ pressed }) => [
                                    sharedStyles.button,
                                    styles.retryButton,
                                    pressed && styles.pressed,
                                ]}
                            >
                                <Text style={sharedStyles.buttonText}>
                                    Retry
                                </Text>
                            </Pressable>
                        ) : null}
                        {onDiscardCommand ? (
                            <Pressable
                                accessibilityLabel="Discard failed command"
                                accessibilityHint="Permanently removes this unsynced action from this device"
                                accessibilityRole="button"
                                onPress={() => onDiscardCommand(command.id)}
                                style={({ pressed }) => [
                                    sharedStyles.button,
                                    styles.discardButton,
                                    pressed && styles.pressed,
                                ]}
                            >
                                <Text style={sharedStyles.buttonText}>
                                    Discard
                                </Text>
                            </Pressable>
                        ) : null}
                    </View>
                </View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 12,
    },
    failedCommand: {
        backgroundColor: colors.redSoft,
        borderColor: colors.redBorder,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 12,
        padding: 12,
    },
    failedTitle: {
        color: colors.red,
        fontSize: 14,
        fontWeight: '800',
        textTransform: 'capitalize',
    },
    failedMessage: {
        color: colors.secondary,
        fontSize: 13,
        lineHeight: 19,
        marginTop: 4,
    },
    failedMeta: {
        color: colors.muted,
        fontSize: 12,
        marginTop: 4,
    },
    failedActions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 10,
    },
    retryButton: {
        backgroundColor: colors.amber,
        flexGrow: 1,
        minHeight: 48,
    },
    discardButton: {
        backgroundColor: colors.red,
        flexGrow: 1,
        minHeight: 48,
    },
    pressed: {
        opacity: 0.78,
    },
});
