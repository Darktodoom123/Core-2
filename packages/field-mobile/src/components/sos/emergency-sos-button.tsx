import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../common/Icon';
import { colors } from '../nativeStyles';

export interface EmergencySosButtonProps {
    onPress: () => void;
    disabled?: boolean;
}

export const EmergencySosButton: React.FC<EmergencySosButtonProps> = ({
    onPress,
    disabled = false,
}) => (
    <Pressable
        accessibilityHint="Opens the emergency SOS sheet. Activation requires a deliberate two-second hold."
        accessibilityLabel="Open Emergency SOS"
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
            styles.button,
            disabled && styles.disabled,
            pressed && !disabled && styles.pressed,
        ]}
        testID="open-emergency-sos"
    >
        <View style={styles.iconWrap}>
            <Icon color={colors.white} name="alert" size={18} />
        </View>
        <Text selectable style={styles.label}>
            SOS
        </Text>
    </Pressable>
);

const styles = StyleSheet.create({
    button: {
        alignItems: 'center',
        backgroundColor: colors.redDark,
        borderColor: colors.red,
        borderRadius: 14,
        borderWidth: 2,
        flexDirection: 'row',
        gap: 8,
        minHeight: 56,
        minWidth: 92,
        paddingHorizontal: 16,
        shadowColor: colors.redDark,
        shadowOpacity: 0.18,
        shadowRadius: 8,
    },
    disabled: {
        opacity: 0.55,
    },
    iconWrap: {
        alignItems: 'center',
        height: 24,
        justifyContent: 'center',
        width: 24,
    },
    label: {
        color: colors.white,
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 0.6,
    },
    pressed: {
        opacity: 0.82,
        transform: [{ scale: 0.98 }],
    },
});
