import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View, Vibration } from 'react-native';
import { useTheme } from '../../theme';
import { colors } from '../nativeStyles';

export interface EmergencySosButtonProps {
    onPress?: () => void;
    onHoldComplete?: () => void;
    disabled?: boolean;
}

export const EmergencySosButton: React.FC<EmergencySosButtonProps> = ({
    onPress,
    onHoldComplete,
    disabled = false,
}) => {
    const { isDarkHud } = useTheme();

    const handlePress = useCallback(() => {
        if (disabled) {
            return;
        }

        try {
            Vibration.vibrate(50);
        } catch {
            // Ignore vibration errors in test or web environments
        }

        if (onPress) {
            onPress();
        } else if (onHoldComplete) {
            onHoldComplete();
        }
    }, [disabled, onHoldComplete, onPress]);

    return (
        <Pressable
            accessibilityHint="Tap to open the Emergency SOS screen."
            accessibilityLabel="Activate Emergency SOS"
            accessibilityRole="button"
            accessibilityState={{
                disabled,
            }}
            disabled={disabled}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={handlePress}
            pressRetentionOffset={{ top: 30, bottom: 30, left: 30, right: 30 }}
            style={({ pressed }) => [
                styles.button,
                isDarkHud && styles.darkButton,
                disabled && styles.disabled,
                pressed && !disabled && styles.pressed,
            ]}
            testID="open-emergency-sos"
        >
            <View pointerEvents="none" style={styles.contentWrap}>
                <Text style={[styles.label, styles.boldSosLabel]}>SOS</Text>
            </View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    button: {
        alignItems: 'center',
        backgroundColor: '#DC2626',
        borderColor: '#FFFFFF',
        borderRadius: 28,
        borderWidth: 3.5,
        elevation: 8,
        height: 56,
        justifyContent: 'center',
        marginTop: -18,
        overflow: 'hidden',
        shadowColor: '#DC2626',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        width: 56,
    },
    darkButton: {
        backgroundColor: '#DC2626',
        borderColor: '#1E293B',
        shadowColor: '#DC2626',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 10,
        elevation: 10,
    },
    darkLabel: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    boldSosLabel: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    contentWrap: {
        alignItems: 'center',
        gap: 1,
        justifyContent: 'center',
    },
    disabled: {
        opacity: 0.55,
    },
    label: {
        color: colors.white,
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.6,
        lineHeight: 12,
    },
    pressed: {
        opacity: 0.82,
        transform: [{ scale: 0.96 }],
    },
});
