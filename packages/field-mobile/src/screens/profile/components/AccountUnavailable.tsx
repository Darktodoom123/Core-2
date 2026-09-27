import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../../components/common/Icon';
import { useTheme, useThemedStyles } from '../../../theme';
import type { ThemeColors } from '../../../theme';

export interface AccountUnavailableProps {
    isOnline?: boolean | null;
    onRetry: () => void;
}

/**
 * Shown instead of account details the server has not sent. Nothing is
 * filled in from guesses: an operator never sees an email or setting that
 * is not really theirs.
 */
export const AccountUnavailable: React.FC<AccountUnavailableProps> = ({
    isOnline,
    onRetry,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const offline = isOnline === false;

    return (
        <View
            accessibilityLiveRegion="polite"
            style={styles.card}
            testID="profile-account-unavailable"
        >
            <View style={styles.titleRow}>
                <Icon
                    color={theme.textSecondary}
                    name={offline ? 'cloud' : 'alert'}
                    size={20}
                />
                <Text style={styles.title}>
                    Couldn&apos;t load your account
                </Text>
            </View>
            <Text style={styles.body}>
                {offline
                    ? 'You are offline. Your account details, security settings and sign-in history load when you are back online. Settings still work.'
                    : 'Your account details did not load. Try again; Settings still work meanwhile.'}
            </Text>
            <Pressable
                accessibilityLabel="Try loading your account again"
                accessibilityRole="button"
                onPress={onRetry}
                style={({ pressed }) => [
                    styles.retry,
                    pressed && styles.pressed,
                ]}
                testID="profile-account-retry"
            >
                <Icon color={theme.textPrimary} name="sync" size={18} />
                <Text style={styles.retryText}>Try again</Text>
            </Pressable>
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        // Resting panel: border only, no shadow.
        card: {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: 16,
            borderWidth: 1,
            gap: 12,
            padding: 16,
        },
        titleRow: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: 8,
        },
        title: {
            color: theme.textPrimary,
            fontSize: 17,
            fontWeight: '700',
        },
        body: {
            color: theme.textSecondary,
            fontSize: 14,
            lineHeight: 20,
        },
        retry: {
            alignItems: 'center',
            alignSelf: 'flex-start',
            backgroundColor: theme.surface,
            borderColor: theme.borderStrong,
            borderRadius: 12,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 8,
            minHeight: 48,
            paddingHorizontal: 16,
        },
        retryText: {
            color: theme.textPrimary,
            fontSize: 15,
            fontWeight: '600',
        },
        pressed: {
            opacity: 0.7,
        },
    });
