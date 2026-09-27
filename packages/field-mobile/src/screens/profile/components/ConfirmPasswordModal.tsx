import React, { useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { Icon } from '../../../components/common/Icon';
import { useTheme, useThemedStyles } from '../../../theme';
import type { ThemeColors } from '../../../theme';

export interface ConfirmPasswordModalProps {
    visible: boolean;
    title: string;
    description?: string;
    confirmLabel?: string;
    isDestructive?: boolean;
    isLoading?: boolean;
    errorMessage?: string | null;
    onClose: () => void;
    onConfirm: (password: string) => void;
}

export const ConfirmPasswordModal: React.FC<ConfirmPasswordModalProps> = ({
    visible,
    title,
    description,
    confirmLabel = 'Confirm',
    isDestructive = false,
    isLoading = false,
    errorMessage,
    onClose,
    onConfirm,
}) => {
    const { isDarkHud, theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const activeError = error || errorMessage;

    const handleConfirm = () => {
        if (!password.trim()) {
            setError('Password is required');

            return;
        }

        setError(null);
        onConfirm(password);
    };

    const handleClose = () => {
        setPassword('');
        setError(null);
        onClose();
    };

    return (
        <Modal
            animationType="fade"
            onRequestClose={handleClose}
            statusBarTranslucent
            transparent
            visible={visible}
        >
            <View
                accessibilityViewIsModal
                style={styles.overlay}
                testID="confirm-password-modal"
            >
                <Pressable
                    accessibilityLabel="Close confirmation modal"
                    onPress={handleClose}
                    style={styles.scrim}
                />
                <View style={[styles.dialog]}>
                    <View style={styles.header}>
                        <View
                            style={[
                                styles.iconWrap,
                                isDestructive
                                    ? styles.iconWrapDanger
                                    : isDarkHud
                                      ? styles.darkIconWrap
                                      : styles.lightIconWrap,
                            ]}
                        >
                            <Icon
                                color={
                                    isDestructive
                                        ? theme.hazardRed
                                        : theme.brandAmberText
                                }
                                name="lock"
                                size={22}
                            />
                        </View>
                        <Text accessibilityRole="header" style={[styles.title]}>
                            {title}
                        </Text>
                    </View>

                    {description ? (
                        <Text style={[styles.description]}>{description}</Text>
                    ) : null}

                    <View style={styles.inputContainer}>
                        <Text
                            style={[
                                styles.inputLabel,
                                isDarkHud && styles.darkInputLabel,
                            ]}
                        >
                            Current Password
                        </Text>
                        <View
                            style={[
                                styles.inputRow,
                                isDarkHud && styles.darkInputRow,
                                Boolean(activeError) && styles.inputRowError,
                            ]}
                        >
                            <TextInput
                                accessibilityLabel="Current password input"
                                autoCapitalize="none"
                                autoCorrect={false}
                                onChangeText={(text) => {
                                    setPassword(text);

                                    if (error) {
                                        setError(null);
                                    }
                                }}
                                placeholder="Enter password to confirm"
                                placeholderTextColor={theme.textMuted}
                                secureTextEntry={!showPassword}
                                style={[styles.input]}
                                testID="confirm-password-input"
                                value={password}
                            />
                            <Pressable
                                accessibilityLabel={
                                    showPassword
                                        ? 'Hide password'
                                        : 'Show password'
                                }
                                onPress={() => setShowPassword(!showPassword)}
                                style={styles.eyeBtn}
                            >
                                <Icon
                                    color={theme.textSecondary}
                                    name={showPassword ? 'eye-off' : 'eye'}
                                    size={18}
                                />
                            </Pressable>
                        </View>
                        {activeError ? (
                            <Text style={styles.errorText}>{activeError}</Text>
                        ) : null}
                    </View>

                    <View style={styles.actions}>
                        <Pressable
                            accessibilityLabel="Cancel"
                            accessibilityRole="button"
                            disabled={isLoading}
                            onPress={handleClose}
                            style={({ pressed }) => [
                                styles.cancelBtn,
                                isDarkHud && styles.darkCancelBtn,
                                pressed && styles.pressed,
                            ]}
                            testID="confirm-password-cancel"
                        >
                            <Text
                                style={[
                                    styles.cancelBtnText,
                                    isDarkHud && styles.darkCancelBtnText,
                                ]}
                            >
                                Cancel
                            </Text>
                        </Pressable>

                        <Pressable
                            accessibilityLabel={confirmLabel}
                            accessibilityRole="button"
                            disabled={isLoading || !password.trim()}
                            onPress={handleConfirm}
                            style={({ pressed }) => [
                                styles.submitBtn,
                                isDestructive
                                    ? styles.destructiveBtn
                                    : isDarkHud
                                      ? styles.darkSubmitBtn
                                      : styles.lightSubmitBtn,
                                (!password.trim() || isLoading) &&
                                    styles.disabledBtn,
                                pressed && styles.pressed,
                            ]}
                            testID="confirm-password-submit"
                        >
                            {isLoading ? (
                                <ActivityIndicator
                                    color={
                                        isDestructive
                                            ? theme.textOnDark
                                            : theme.surfaceDark
                                    }
                                    size="small"
                                />
                            ) : (
                                <Text
                                    style={[
                                        styles.submitBtnText,
                                        isDestructive &&
                                            styles.destructiveBtnText,
                                    ]}
                                >
                                    {confirmLabel}
                                </Text>
                            )}
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        overlay: {
            flex: 1,
            backgroundColor: `${theme.surfaceDark}B8`,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
        },
        scrim: {
            ...StyleSheet.absoluteFill,
        },
        dialog: {
            width: '100%',
            maxWidth: 440,
            backgroundColor: theme.surface,
            borderRadius: 24,
            padding: 24,
            borderWidth: 1,
            borderColor: theme.border,
            elevation: 8,
            shadowColor: theme.surfaceDark,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.25,
            shadowRadius: 16,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            marginBottom: 8,
        },
        iconWrap: {
            width: 44,
            height: 44,
            borderRadius: 12,
            justifyContent: 'center',
            alignItems: 'center',
        },
        lightIconWrap: {
            backgroundColor: theme.brandAmberLight,
        },
        darkIconWrap: {
            backgroundColor: theme.brandAmberLight,
        },
        iconWrapDanger: {
            backgroundColor: theme.hazardRedLight,
        },
        title: {
            fontSize: 18,
            fontWeight: '700',
            color: theme.textPrimary,
            flex: 1,
        },
        description: {
            fontSize: 14,
            color: theme.textSecondary,
            lineHeight: 20,
            marginBottom: 16,
        },
        inputContainer: {
            marginBottom: 20,
        },
        inputLabel: {
            fontSize: 13,
            fontWeight: '600',
            color: theme.textPrimary,
            marginBottom: 6,
        },
        darkInputLabel: {
            color: theme.textSecondary,
        },
        inputRow: {
            flexDirection: 'row',
            alignItems: 'center',
            minHeight: 48,
            backgroundColor: theme.surfaceHighlight,
            borderWidth: 1,
            borderColor: theme.borderStrong,
            borderRadius: 10,
            paddingHorizontal: 12,
        },
        darkInputRow: {
            backgroundColor: theme.textInverse,
            borderColor: theme.border,
        },
        inputRowError: {
            borderColor: theme.hazardRed,
        },
        input: {
            flex: 1,
            height: 48,
            fontSize: 15,
            color: theme.textPrimary,
        },
        eyeBtn: {
            minWidth: 48,
            minHeight: 48,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 8,
        },
        errorText: {
            marginTop: 4,
            fontSize: 12,
            color: theme.hazardRed,
        },
        actions: {
            flexDirection: 'row',
            gap: 12,
            justifyContent: 'flex-end',
        },
        cancelBtn: {
            minHeight: 48,
            paddingHorizontal: 16,
            borderRadius: 10,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: theme.canvas,
        },
        darkCancelBtn: {
            backgroundColor: theme.border,
        },
        cancelBtnText: {
            fontSize: 14,
            fontWeight: '600',
            color: theme.textSecondary,
        },
        darkCancelBtnText: {
            color: theme.textPrimary,
        },
        submitBtn: {
            minHeight: 48,
            paddingHorizontal: 20,
            borderRadius: 10,
            justifyContent: 'center',
            alignItems: 'center',
        },
        lightSubmitBtn: {
            backgroundColor: theme.brandAmber,
        },
        darkSubmitBtn: {
            backgroundColor: theme.brandAmber,
        },
        destructiveBtn: {
            backgroundColor: theme.hazardRed,
        },
        destructiveBtnText: {
            color: theme.textOnDark,
        },
        disabledBtn: {
            opacity: 0.5,
        },
        submitBtnText: {
            fontSize: 14,
            fontWeight: '700',
            color: theme.surfaceDark,
        },
        pressed: {
            opacity: 0.75,
        },
    });
