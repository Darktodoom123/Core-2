import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import { Icon } from '../common/Icon';

export interface TelemetryToggleButtonProps {
    sharing: boolean;
    onPress?: () => void;
    /** Fills the row on its own instead of sharing it with other actions. */
    wide?: boolean;
}

/**
 * Pause or resume location sharing for the linked unit. Shown whenever a
 * unit is linked, so a pause is never stuck on with no way back.
 */
export const TelemetryToggleButton: React.FC<TelemetryToggleButtonProps> = ({
    sharing,
    onPress,
    wide = false,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const label = sharing ? 'Pause Telemetry' : 'Resume Telemetry';

    return (
        <Pressable
            accessibilityLabel={label}
            accessibilityRole="button"
            onPress={onPress}
            style={({ pressed }) => [
                styles.button,
                wide ? styles.wide : styles.shared,
                pressed && styles.pressed,
            ]}
            testID="quick-action-pause-telemetry-btn"
        >
            <Icon
                color={sharing ? theme.brandAmberText : theme.successEmerald}
                name="location"
                size={14}
            />
            <Text style={styles.text}>{label}</Text>
        </Pressable>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        button: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: 8,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 6,
            justifyContent: 'center',
            minHeight: 48,
            paddingHorizontal: 12,
        },
        shared: {
            flex: 1,
        },
        wide: {
            alignSelf: 'stretch',
            marginTop: 10,
        },
        pressed: {
            opacity: 0.78,
        },
        text: {
            color: theme.textPrimary,
            fontSize: 12,
            fontWeight: '700',
        },
    });
