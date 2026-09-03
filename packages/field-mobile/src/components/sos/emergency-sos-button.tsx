import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, Vibration } from 'react-native';
import { Icon } from '../common/Icon';
import { colors } from '../nativeStyles';

export interface EmergencySosButtonProps {
    onHoldComplete: () => void;
    disabled?: boolean;
}

export const EmergencySosButton: React.FC<EmergencySosButtonProps> = ({
    onHoldComplete,
    disabled = false,
}) => {
    const [progress, setProgress] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const accessibilityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
        null,
    );
    const completedRef = useRef(false);

    const clearHold = useCallback(() => {
        if (timerRef.current !== null) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        if (accessibilityTimerRef.current !== null) {
            clearTimeout(accessibilityTimerRef.current);
            accessibilityTimerRef.current = null;
        }
    }, []);

    const completeHold = useCallback(() => {
        if (completedRef.current || disabled) {
            return;
        }

        completedRef.current = true;
        clearHold();
        setProgress(1);
        Vibration.vibrate(90);
        onHoldComplete();
    }, [clearHold, disabled, onHoldComplete]);

    const startHold = useCallback(() => {
        if (disabled || timerRef.current !== null) {
            return;
        }

        completedRef.current = false;
        setProgress(0);
        const startedAt = Date.now();
        timerRef.current = setInterval(() => {
            const nextProgress = Math.min(1, (Date.now() - startedAt) / 2_000);
            setProgress(nextProgress);

            if (nextProgress >= 1) {
                completeHold();
            }
        }, 50);
    }, [completeHold, disabled]);

    const endHold = useCallback(() => {
        clearHold();

        if (!completedRef.current) {
            setProgress(0);
        }
    }, [clearHold]);

    useEffect(() => clearHold, [clearHold]);

    const handleAccessibilityAction = useCallback(() => {
        startHold();
        accessibilityTimerRef.current = setTimeout(completeHold, 2_000);
    }, [completeHold, startHold]);

    return (
        <Pressable
            accessibilityHint="Keep this control pressed for two seconds to activate Emergency SOS. A normal tap does not activate it."
            accessibilityActions={[
                {
                    label: 'Hold for two seconds to activate Emergency SOS',
                    name: 'activate',
                },
            ]}
            accessibilityLabel="Activate Emergency SOS"
            accessibilityRole="button"
            accessibilityState={{
                disabled,
                busy: progress > 0 && progress < 1,
            }}
            accessibilityValue={{
                max: 100,
                min: 0,
                now: Math.round(progress * 100),
                text: `${Math.round(progress * 100)} percent held`,
            }}
            disabled={disabled}
            onAccessibilityAction={handleAccessibilityAction}
            onPressIn={startHold}
            onPressOut={endHold}
            style={({ pressed }) => [
                styles.button,
                disabled && styles.disabled,
                pressed && !disabled && styles.pressed,
            ]}
            testID="open-emergency-sos"
        >
            <View style={[styles.progress, { width: `${progress * 100}%` }]} />
            <View style={styles.iconWrap}>
                <Icon color={colors.white} name="alert" size={18} />
            </View>
            <Text selectable style={styles.label}>
                SOS
            </Text>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    button: {
        alignItems: 'center',
        backgroundColor: colors.redDark,
        borderColor: colors.red,
        borderRadius: 22,
        borderWidth: 1.5,
        flexDirection: 'row',
        gap: 6,
        height: 44,
        minWidth: 84,
        overflow: 'hidden',
        paddingHorizontal: 14,
        shadowColor: colors.redDark,
        shadowOpacity: 0.22,
        shadowRadius: 6,
        elevation: 4,
    },
    progress: {
        backgroundColor: colors.red,
        bottom: 0,
        left: 0,
        opacity: 0.9,
        position: 'absolute',
        top: 0,
    },
    disabled: {
        opacity: 0.55,
    },
    iconWrap: {
        alignItems: 'center',
        height: 20,
        justifyContent: 'center',
        width: 20,
    },
    label: {
        color: colors.white,
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    pressed: {
        opacity: 0.82,
        transform: [{ scale: 0.98 }],
    },
});
