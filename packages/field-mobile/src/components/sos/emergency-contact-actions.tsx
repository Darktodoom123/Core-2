import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import type { SosEmergencyAction } from '../../types/index';
import { Icon } from '../common/Icon';
import { colors } from '../nativeStyles';

function isAllowedEmergencyUri(action: SosEmergencyAction): boolean {
    const match = /^(tel|sms):((?:\+[1-9]\d{7,14})|(?:\d{3,6}))$/i.exec(
        action.uri,
    );

    if (!match) {
        return false;
    }

    return action.kind === 'call'
        ? match[1].toLowerCase() === 'tel'
        : action.kind === 'sms'
          ? match[1].toLowerCase() === 'sms'
          : true;
}

export const EmergencyContactActions: React.FC<{
    actions: SosEmergencyAction[];
}> = ({ actions }) => {
    const { isDarkHud } = useTheme();
    const [error, setError] = useState<string | null>(null);
    const visibleActions = actions.filter(isAllowedEmergencyUri);

    const openAction = async (action: SosEmergencyAction) => {
        setError(null);

        if (!isAllowedEmergencyUri(action)) {
            setError('This emergency action is not configured safely.');

            return;
        }

        try {
            const canOpen = await Linking.canOpenURL(action.uri);

            if (!canOpen) {
                setError(`${action.label} is not available on this device.`);

                return;
            }

            await Linking.openURL(action.uri);
        } catch {
            setError(
                `${action.label} could not be opened. Try the phone directly.`,
            );
        }
    };

    if (visibleActions.length === 0) {
        return null;
    }

    return (
        <View
            style={[styles.container, isDarkHud && styles.darkContainer]}
            testID="emergency-contact-actions"
        >
            <Text
                selectable
                style={[styles.title, isDarkHud && styles.darkTitle]}
            >
                Call or text now
            </Text>
            <Text
                selectable
                style={[styles.helper, isDarkHud && styles.darkHelper]}
            >
                These actions are deliberate. Core 2 will not call public
                emergency services automatically.
            </Text>
            {visibleActions.length > 0 ? (
                <View style={styles.actions}>
                    {visibleActions.map((action) => (
                        <Pressable
                            accessibilityHint={
                                action.hint ??
                                'Opens your phone or messaging app after confirmation.'
                            }
                            accessibilityLabel={action.label}
                            accessibilityRole="button"
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            key={`${action.kind}:${action.uri}`}
                            onPress={() => void openAction(action)}
                            style={({ pressed }) => [
                                styles.action,
                                action.kind === 'call'
                                    ? styles.callAction
                                    : styles.textAction,
                                pressed && styles.pressed,
                            ]}
                        >
                            <Icon
                                color={colors.white}
                                name={
                                    action.kind === 'call' ? 'phone' : 'message'
                                }
                                size={17}
                            />
                            <Text
                                pointerEvents="none"
                                style={styles.actionText}
                            >
                                {action.label}
                            </Text>
                        </Pressable>
                    ))}
                </View>
            ) : (
                <Text
                    selectable
                    style={[
                        styles.unavailable,
                        isDarkHud && styles.darkUnavailable,
                    ]}
                >
                    No configured emergency contact action is available.
                </Text>
            )}
            {error ? (
                <Text
                    accessibilityLiveRegion="assertive"
                    accessibilityRole="alert"
                    selectable
                    style={[styles.error, isDarkHud && styles.darkError]}
                >
                    {error}
                </Text>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.redLight,
        borderColor: colors.redBorder,
        borderRadius: 12,
        borderWidth: 1,
        gap: 8,
        padding: 12,
    },
    title: {
        color: colors.redDark,
        fontSize: 16,
        fontWeight: '800',
    },
    helper: {
        color: colors.secondary,
        fontSize: 13,
        lineHeight: 18,
    },
    actions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    action: {
        alignItems: 'center',
        borderRadius: 10,
        flexDirection: 'row',
        gap: 8,
        minHeight: 48,
        paddingHorizontal: 14,
    },
    callAction: {
        backgroundColor: colors.redDark,
    },
    textAction: {
        backgroundColor: colors.warningDark,
    },
    pressed: {
        opacity: 0.8,
    },
    actionText: {
        color: colors.white,
        fontSize: 14,
        fontWeight: '800',
    },
    unavailable: {
        color: colors.redDark,
        fontSize: 14,
        lineHeight: 20,
    },
    error: {
        color: colors.redDark,
        fontSize: 13,
        fontWeight: '600',
        lineHeight: 18,
    },
    darkContainer: {
        backgroundColor: 'rgba(220, 38, 38, 0.12)',
        borderColor: '#7F1D1D',
    },
    darkTitle: {
        color: '#F87171',
    },
    darkHelper: {
        color: '#94A3B8',
    },
    darkUnavailable: {
        color: '#FCA5A5',
    },
    darkError: {
        color: '#FCA5A5',
    },
});
