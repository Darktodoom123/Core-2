import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { OutboxCommand } from '../types/index';
import { colors, sharedStyles } from './nativeStyles';

export interface CommandConflictBannerProps {
    conflictedCommands: OutboxCommand[];
    onAcceptServerState: (commandId: string) => void;
    onRetryNewVersion: (commandId: string, newVersion: number) => void;
}

export const CommandConflictBanner: React.FC<CommandConflictBannerProps> = ({
    conflictedCommands,
    onAcceptServerState,
    onRetryNewVersion,
}) => {
    if (conflictedCommands.length === 0) {
        return null;
    }

    return (
        <View
            accessible
            accessibilityLiveRegion="assertive"
            accessibilityRole="alert"
            style={styles.banner}
            testID="conflict-banner-container"
        >
            <Text accessibilityRole="header" style={styles.heading}>
                Action required: version conflict
            </Text>
            <Text style={styles.description}>
                One or more actions could not be saved because this dispatch was
                updated on another device.
            </Text>

            {conflictedCommands.map((command) => {
                const currentVersion =
                    command.error?.currentVersion ??
                    (command.expectedVersion ? command.expectedVersion + 1 : 1);

                return (
                    <View
                        key={command.id}
                        style={styles.item}
                        testID={`conflict-item-${command.id}`}
                    >
                        <Text style={styles.actionName}>
                            Action: {command.type.replace('_', ' ')}
                        </Text>
                        <Text style={styles.versionText}>
                            Submitted version: v{command.expectedVersion ?? '?'}
                            , current server version: v{currentVersion}
                        </Text>
                        <View style={styles.actions}>
                            <Pressable
                                accessibilityLabel={`Accept server state at version ${currentVersion}`}
                                accessibilityRole="button"
                                onPress={() => onAcceptServerState(command.id)}
                                style={({ pressed }) => [
                                    sharedStyles.button,
                                    styles.serverButton,
                                    pressed && styles.pressed,
                                ]}
                                testID={`accept-server-btn-${command.id}`}
                            >
                                <Text style={sharedStyles.buttonText}>
                                    Accept server state
                                </Text>
                            </Pressable>
                            <Pressable
                                accessibilityLabel={`Retry command with version ${currentVersion}`}
                                accessibilityRole="button"
                                onPress={() =>
                                    onRetryNewVersion(
                                        command.id,
                                        currentVersion,
                                    )
                                }
                                style={({ pressed }) => [
                                    sharedStyles.button,
                                    styles.retryButton,
                                    pressed && styles.pressed,
                                ]}
                                testID={`retry-version-btn-${command.id}`}
                            >
                                <Text style={sharedStyles.buttonText}>
                                    Retry with v{currentVersion}
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    banner: {
        backgroundColor: colors.redSoft,
        borderColor: colors.redBorder,
        borderRadius: 10,
        borderWidth: 1,
        marginBottom: 16,
        padding: 16,
    },
    heading: {
        color: colors.red,
        fontSize: 17,
        fontWeight: '800',
    },
    description: {
        color: colors.secondary,
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 12,
        marginTop: 8,
    },
    item: {
        backgroundColor: colors.surface,
        borderColor: colors.amberBorder,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 8,
        padding: 12,
    },
    actionName: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '800',
    },
    versionText: {
        color: colors.secondary,
        fontSize: 13,
        lineHeight: 19,
        marginBottom: 10,
        marginTop: 4,
    },
    actions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    serverButton: {
        backgroundColor: colors.blue,
        flexGrow: 1,
    },
    retryButton: {
        backgroundColor: colors.green,
        flexGrow: 1,
    },
    pressed: {
        opacity: 0.78,
    },
});
