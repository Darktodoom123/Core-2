import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { OutboxCommand } from '../../types/index';
import { colors, sharedStyles } from '../nativeStyles';

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
                Update conflict needs review
            </Text>
            <Text style={styles.description}>
                This job changed on the server before your saved action could
                sync. Choose which result to keep.
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
                            Saved action: {command.type.replaceAll('_', ' ')}
                        </Text>
                        <Text style={styles.versionText}>
                            Submitted version: v{command.expectedVersion ?? '?'}
                            , current server version: v{currentVersion}
                        </Text>
                        {command.error?.serverSnapshot ? (
                            <Text style={styles.snapshotText}>
                                Server state:{' '}
                                {command.error.serverSnapshot.reference} —{' '}
                                {command.error.serverSnapshot.status.label}
                            </Text>
                        ) : null}
                        <View style={styles.actions}>
                            <Pressable
                                accessibilityLabel={`Discard this saved action and keep server version ${currentVersion}`}
                                accessibilityRole="button"
                                onPress={() => onAcceptServerState(command.id)}
                                style={({ pressed }) => [
                                    sharedStyles.button,
                                    styles.serverButton,
                                    pressed && styles.pressed,
                                ]}
                                testID={`accept-server-btn-${command.id}`}
                            >
                                <Text style={styles.serverButtonText}>
                                    Keep server update
                                </Text>
                            </Pressable>
                            <Pressable
                                accessibilityLabel={`Retry saved action against server version ${currentVersion}`}
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
                                    Retry my action
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
        backgroundColor: colors.warningSoft,
        borderColor: colors.warningBorder,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 16,
        padding: 16,
    },
    heading: {
        color: colors.warningDark,
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
        borderColor: colors.warningBorder,
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
    snapshotText: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '700',
        lineHeight: 19,
        marginBottom: 10,
    },
    actions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    serverButton: {
        backgroundColor: colors.surface,
        borderColor: colors.borderStrong,
        borderWidth: 1,
        flexGrow: 1,
    },
    serverButtonText: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '700',
        textAlign: 'center',
    },
    retryButton: {
        backgroundColor: colors.amber,
        flexGrow: 1,
    },
    pressed: {
        opacity: 0.78,
    },
});
