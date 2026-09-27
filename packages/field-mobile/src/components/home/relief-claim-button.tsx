import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import { Icon } from '../common/Icon';

export interface ReliefClaimButtonProps {
    onPress: () => void;
    assetCode?: string;
}

/**
 * Secondary action for a relief operator taking over a unit that is already
 * running under another operator. It is occasional, so it is outlined and
 * never competes with the card's gold primary action.
 */
export const ReliefClaimButton: React.FC<ReliefClaimButtonProps> = ({
    onPress,
    assetCode,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);

    return (
        <Pressable
            accessibilityHint="Opens the relief handover to take over a running unit"
            accessibilityLabel={
                assetCode
                    ? `Claim equipment handover for ${assetCode}`
                    : 'Claim equipment handover for relief'
            }
            accessibilityRole="button"
            onPress={onPress}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            testID="incoming-handover-claim-btn"
        >
            <Icon color={theme.textPrimary} name="sync" size={16} />
            <Text style={styles.label}>Relief handover — claim a unit</Text>
        </Pressable>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        button: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.borderStrong,
            borderRadius: 12,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 8,
            justifyContent: 'center',
            minHeight: 48,
            paddingHorizontal: 16,
        },
        pressed: {
            transform: [{ scale: 0.985 }],
        },
        label: {
            color: theme.textPrimary,
            fontSize: 15,
            fontWeight: '700',
        },
    });
