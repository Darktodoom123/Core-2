import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/common/Icon';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';

export interface DvirHistoryLoadErrorProps {
    hasLocalRecords: boolean;
    onRetry?: () => void;
}

/** Server history is unavailable: say so, and never imply there is none. */
export const DvirHistoryLoadError: React.FC<DvirHistoryLoadErrorProps> = ({
    hasLocalRecords,
    onRetry,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);

    return (
        <View
            accessibilityRole="alert"
            style={styles.card}
            testID="dvir-history-error"
        >
            <View style={styles.row}>
                <Icon color={theme.warningOrangeText} name="alert" size={18} />
                <Text style={styles.title}>DVIR history didn't load</Text>
            </View>
            <Text style={styles.body}>
                {hasLocalRecords
                    ? 'Only inspections saved on this phone are shown below.'
                    : 'Inspections from the server can’t be shown right now.'}
            </Text>
            {onRetry ? (
                <Pressable
                    accessibilityRole="button"
                    onPress={onRetry}
                    style={({ pressed }) => [
                        styles.retry,
                        pressed && styles.pressed,
                    ]}
                    testID="dvir-history-retry"
                >
                    <Icon color={theme.textPrimary} name="sync" size={16} />
                    <Text style={styles.retryText}>Try again</Text>
                </Pressable>
            ) : null}
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        card: {
            backgroundColor: theme.warningOrangeLight,
            borderColor: theme.warningOrange,
            borderRadius: 14,
            borderWidth: 1,
            gap: 8,
            marginBottom: 12,
            padding: 14,
        },
        row: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: 8,
        },
        title: {
            color: theme.warningOrangeText,
            flex: 1,
            fontSize: 15,
            fontWeight: '700',
        },
        body: {
            color: theme.textPrimary,
            fontSize: 14,
            lineHeight: 20,
        },
        retry: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.borderStrong,
            borderRadius: 12,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 8,
            justifyContent: 'center',
            minHeight: 48,
        },
        retryText: {
            color: theme.textPrimary,
            fontSize: 14,
            fontWeight: '700',
        },
        pressed: {
            transform: [{ scale: 0.985 }],
        },
    });
