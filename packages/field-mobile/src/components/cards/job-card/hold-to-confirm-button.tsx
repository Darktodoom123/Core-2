import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    Animated,
    Pressable,
    StyleSheet,
    Text,
    Vibration,
    View,
} from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useTheme, useThemedStyles } from '../../../theme';
import type { ThemeColors } from '../../../theme';
import { Icon } from '../../common/Icon';
import type { IconName } from '../../common/Icon';

export interface HoldToConfirmTransitButtonProps {
    label: string;
    icon: IconName;
    accessibilityLabel: string;
    testID: string;
    progressTestID?: string;
    onConfirm: () => void;
    baseStyle?: StyleProp<ViewStyle>;
    holdDurationMs?: number;
}

/**
 * Gold primary action that commits only after a sustained hold, so a brief
 * gloved tap cannot advance the dispatch lifecycle. Screen readers (which send
 * a plain press) still activate it directly.
 */
export const HoldToConfirmTransitButton: React.FC<
    HoldToConfirmTransitButtonProps
> = ({
    label,
    icon,
    accessibilityLabel,
    testID,
    progressTestID,
    onConfirm,
    baseStyle,
    holdDurationMs = 500,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const [progress, setProgress] = useState(0);
    const [isHolding, setIsHolding] = useState(false);
    const [progressAnim] = useState(() => new Animated.Value(0));
    const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isTouchActiveRef = useRef(false);
    const touchReleasedEarlyRef = useRef(false);
    const completedRef = useRef(false);
    const startTimeRef = useRef(0);

    const cleanupTimers = useCallback(() => {
        if (holdTimerRef.current) {
            clearTimeout(holdTimerRef.current);
            holdTimerRef.current = null;
        }

        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        progressAnim.stopAnimation();
    }, [progressAnim]);

    const handlePressIn = useCallback(() => {
        isTouchActiveRef.current = true;
        touchReleasedEarlyRef.current = false;
        completedRef.current = false;
        startTimeRef.current = Date.now();
        setIsHolding(true);
        setProgress(0);
        progressAnim.setValue(0);

        Animated.timing(progressAnim, {
            toValue: 1,
            duration: holdDurationMs,
            useNativeDriver: false,
        }).start();

        intervalRef.current = setInterval(() => {
            const elapsed = Date.now() - startTimeRef.current;
            const frac = Math.min(1, elapsed / holdDurationMs);
            setProgress(frac);
        }, 50);

        holdTimerRef.current = setTimeout(() => {
            completedRef.current = true;
            touchReleasedEarlyRef.current = false;
            cleanupTimers();
            setIsHolding(false);
            setProgress(1);

            try {
                Vibration.vibrate(60);
            } catch {
                // Ignore vibration error in mock or test environment
            }

            onConfirm();
        }, holdDurationMs);
    }, [cleanupTimers, holdDurationMs, onConfirm, progressAnim]);

    const handlePressOut = useCallback(() => {
        isTouchActiveRef.current = false;
        cleanupTimers();
        setIsHolding(false);

        if (!completedRef.current) {
            touchReleasedEarlyRef.current = true;
            Animated.timing(progressAnim, {
                toValue: 0,
                duration: 150,
                useNativeDriver: false,
            }).start(() => setProgress(0));
        }
    }, [cleanupTimers, progressAnim]);

    const handlePress = useCallback(() => {
        // Accidental brief glove tap (< 500ms): touch sequence was active but released early. Prevent transition!
        if (touchReleasedEarlyRef.current) {
            touchReleasedEarlyRef.current = false;

            try {
                Vibration.vibrate(30);
            } catch {
                // Ignore
            }

            return;
        }

        // Direct press activation for screen readers (WCAG 2.2 AA) and unit testing (fireEvent.press without pressIn)
        if (!isTouchActiveRef.current && !completedRef.current) {
            try {
                Vibration.vibrate(40);
            } catch {
                // Ignore
            }

            onConfirm();

            return;
        }

        // Hold completed successfully; reset state for subsequent interactions
        if (completedRef.current) {
            completedRef.current = false;
            setProgress(0);
            progressAnim.setValue(0);
        }
    }, [onConfirm, progressAnim]);

    useEffect(() => {
        return () => cleanupTimers();
    }, [cleanupTimers]);

    const progressWidth = useMemo(
        () =>
            progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
            }),
        [progressAnim],
    );

    return (
        <Pressable
            accessibilityHint="Hold for 0.5s to confirm dispatch status transition"
            accessibilityLabel={accessibilityLabel}
            accessibilityRole="button"
            onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={({ pressed }) => [
                styles.button,
                baseStyle,
                pressed && styles.pressed,
            ]}
            testID={testID}
        >
            <Animated.View
                style={[styles.progressFill, { width: progressWidth }]}
                testID={progressTestID || `${testID}-progress`}
            />
            <View pointerEvents="none" style={styles.content}>
                <Icon color={theme.surfaceDark} name={icon} size={16} />
                <Text style={styles.label}>
                    {isHolding && progress > 0.1
                        ? `${label} (Holding ${Math.round(progress * 100)}%)`
                        : label}
                </Text>
            </View>
        </Pressable>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        button: {
            alignItems: 'center',
            backgroundColor: theme.brandAmber,
            borderRadius: 12,
            flexDirection: 'row',
            justifyContent: 'center',
            minHeight: 52,
            overflow: 'hidden',
            paddingHorizontal: 16,
            position: 'relative',
        },
        pressed: {
            transform: [{ scale: 0.985 }],
        },
        // Darkens the gold as the hold fills, so progress reads on both themes.
        progressFill: {
            backgroundColor: theme.surfaceDark,
            bottom: 0,
            left: 0,
            opacity: 0.18,
            position: 'absolute',
            top: 0,
        },
        content: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: 8,
            justifyContent: 'center',
            zIndex: 2,
        },
        label: {
            color: theme.surfaceDark,
            fontSize: 15,
            fontWeight: '700',
        },
    });
