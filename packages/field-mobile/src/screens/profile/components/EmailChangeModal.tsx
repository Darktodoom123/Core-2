import React, { useEffect, useState } from 'react';
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
import type { FieldApiClient } from '../../../services/apiClient';
import { useTheme, useThemedStyles } from '../../../theme';
import type { ThemeColors } from '../../../theme';

export interface EmailChangeModalProps {
    visible: boolean;
    currentEmail: string;
    apiClient: FieldApiClient;
    onClose: () => void;
    onSuccess: (newEmail: string) => void;
}

export const EmailChangeModal: React.FC<EmailChangeModalProps> = ({
    visible,
    currentEmail,
    apiClient,
    onClose,
    onSuccess,
}) => {
    const { isDarkHud, theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const [step, setStep] = useState<'request' | 'verify'>('request');
    const [currentPassword, setCurrentPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [challengeId, setChallengeId] = useState('');
    const [code, setCode] = useState('');
    const [cooldown, setCooldown] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Cooldown timer countdown
    useEffect(() => {
        if (cooldown <= 0) {
            return;
        }

        const timer = setInterval(() => {
            setCooldown((prev) => Math.max(0, prev - 1));
        }, 1000);

        return () => clearInterval(timer);
    }, [cooldown]);

    const handleResetAndClose = () => {
        setStep('request');
        setCurrentPassword('');
        setNewEmail('');
        setChallengeId('');
        setCode('');
        setCooldown(0);
        setErrorMessage(null);
        setIsLoading(false);
        onClose();
    };

    const handleRequestCode = async () => {
        if (!currentPassword.trim()) {
            setErrorMessage('Current password is required');

            return;
        }

        if (!newEmail.trim() || !newEmail.includes('@')) {
            setErrorMessage('A valid email address is required');

            return;
        }

        if (newEmail.trim().toLowerCase() === currentEmail.toLowerCase()) {
            setErrorMessage('New email must be different from current email');

            return;
        }

        setIsLoading(true);
        setErrorMessage(null);

        try {
            const res = await apiClient.requestEmailChange({
                currentPassword: currentPassword.trim(),
                newEmail: newEmail.trim().toLowerCase(),
            });
            setChallengeId(res.challenge_id);
            setCooldown(res.cooldown_seconds ?? 45);
            setStep('verify');
        } catch (err: any) {
            setErrorMessage(
                err.message || 'Failed to request email verification code',
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendCode = async () => {
        if (cooldown > 0 || !challengeId) {
            return;
        }

        setIsLoading(true);
        setErrorMessage(null);

        try {
            const res = await apiClient.resendSecurityOtp({
                challengeId,
                purpose: 'email_change',
            });
            setChallengeId(res.challenge_id);
            setCooldown(res.cooldown_seconds ?? 45);
        } catch (err: any) {
            setErrorMessage(
                err.message || 'Failed to resend verification code',
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyCode = async () => {
        if (code.trim().length !== 6) {
            setErrorMessage('Please enter the 6-digit verification code');

            return;
        }

        setIsLoading(true);
        setErrorMessage(null);

        try {
            await apiClient.verifyEmailChange({
                challengeId,
                code: code.trim(),
            });
            onSuccess(newEmail.trim().toLowerCase());
            handleResetAndClose();
        } catch (err: any) {
            setErrorMessage(
                err.message || 'Verification failed. Please check the code.',
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal
            animationType="fade"
            onRequestClose={handleResetAndClose}
            statusBarTranslucent
            transparent
            visible={visible}
        >
            <View
                accessibilityViewIsModal
                style={styles.overlay}
                testID="email-change-modal"
            >
                <Pressable
                    accessibilityLabel="Close email change modal"
                    onPress={handleResetAndClose}
                    style={styles.scrim}
                />
                <View style={[styles.dialog]}>
                    <View style={styles.header}>
                        <View
                            style={[
                                styles.iconWrap,
                                isDarkHud
                                    ? styles.darkIconWrap
                                    : styles.lightIconWrap,
                            ]}
                        >
                            <Icon
                                color={theme.brandAmberText}
                                name="mail"
                                size={22}
                            />
                        </View>
                        <View style={styles.headerTitles}>
                            <Text
                                accessibilityRole="header"
                                style={[styles.title]}
                            >
                                Change Email Address
                            </Text>
                            <Text style={[styles.stepLabel]}>
                                {step === 'request'
                                    ? 'Step 1 of 2 · Re-authenticate'
                                    : 'Step 2 of 2 · Verify Code'}
                            </Text>
                        </View>
                    </View>

                    {errorMessage ? (
                        <View style={styles.errorBanner}>
                            <Text style={styles.errorBannerText}>
                                {errorMessage}
                            </Text>
                        </View>
                    ) : null}

                    {step === 'request' ? (
                        <View style={styles.formBody}>
                            <View style={styles.fieldGroup}>
                                <Text
                                    style={[
                                        styles.fieldLabel,
                                        isDarkHud && styles.darkFieldLabel,
                                    ]}
                                >
                                    Current Password
                                </Text>
                                <View
                                    style={[
                                        styles.inputRow,
                                        isDarkHud && styles.darkInputRow,
                                    ]}
                                >
                                    <TextInput
                                        accessibilityLabel="Current password"
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        onChangeText={setCurrentPassword}
                                        placeholder="Enter your current password"
                                        placeholderTextColor={theme.textMuted}
                                        secureTextEntry={!showPassword}
                                        style={[styles.input]}
                                        testID="email-change-password-input"
                                        value={currentPassword}
                                    />
                                    <Pressable
                                        accessibilityLabel={
                                            showPassword
                                                ? 'Hide password'
                                                : 'Show password'
                                        }
                                        onPress={() =>
                                            setShowPassword(!showPassword)
                                        }
                                        style={styles.eyeBtn}
                                    >
                                        <Icon
                                            color={theme.textSecondary}
                                            name={
                                                showPassword ? 'eye-off' : 'eye'
                                            }
                                            size={18}
                                        />
                                    </Pressable>
                                </View>
                            </View>

                            <View style={styles.fieldGroup}>
                                <Text
                                    style={[
                                        styles.fieldLabel,
                                        isDarkHud && styles.darkFieldLabel,
                                    ]}
                                >
                                    New Email Address
                                </Text>
                                <TextInput
                                    accessibilityLabel="New email address"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    keyboardType="email-address"
                                    onChangeText={setNewEmail}
                                    placeholder="operator@company.com"
                                    placeholderTextColor={theme.textMuted}
                                    style={[
                                        styles.input,
                                        styles.inputSolo,
                                        isDarkHud && styles.darkInputRow,
                                    ]}
                                    testID="email-change-new-email-input"
                                    value={newEmail}
                                />
                            </View>

                            <View style={styles.actions}>
                                <Pressable
                                    accessibilityLabel="Cancel"
                                    disabled={isLoading}
                                    onPress={handleResetAndClose}
                                    style={({ pressed }) => [
                                        styles.cancelBtn,
                                        isDarkHud && styles.darkCancelBtn,
                                        pressed && styles.pressed,
                                    ]}
                                    testID="email-change-cancel-btn"
                                >
                                    <Text
                                        style={[
                                            styles.cancelBtnText,
                                            isDarkHud &&
                                                styles.darkCancelBtnText,
                                        ]}
                                    >
                                        Cancel
                                    </Text>
                                </Pressable>
                                <Pressable
                                    accessibilityLabel="Send Verification Code"
                                    disabled={
                                        isLoading ||
                                        !currentPassword.trim() ||
                                        !newEmail.trim()
                                    }
                                    onPress={handleRequestCode}
                                    style={({ pressed }) => [
                                        styles.primaryBtn,
                                        isDarkHud
                                            ? styles.darkPrimaryBtn
                                            : styles.lightPrimaryBtn,
                                        (isLoading ||
                                            !currentPassword.trim() ||
                                            !newEmail.trim()) &&
                                            styles.disabledBtn,
                                        pressed && styles.pressed,
                                    ]}
                                    testID="email-change-request-btn"
                                >
                                    {isLoading ? (
                                        <ActivityIndicator
                                            color={theme.surfaceDark}
                                            size="small"
                                        />
                                    ) : (
                                        <Text style={styles.primaryBtnText}>
                                            Send Code
                                        </Text>
                                    )}
                                </Pressable>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.formBody}>
                            <Text style={[styles.verifyNotice]}>
                                A 6-digit verification code was sent to{' '}
                                <Text style={styles.boldEmail}>{newEmail}</Text>
                                . Enter it below to complete your change.
                            </Text>

                            <View style={styles.fieldGroup}>
                                <Text
                                    style={[
                                        styles.fieldLabel,
                                        isDarkHud && styles.darkFieldLabel,
                                    ]}
                                >
                                    6-Digit Verification Code
                                </Text>
                                <TextInput
                                    accessibilityLabel="6-digit verification code"
                                    autoFocus
                                    keyboardType="number-pad"
                                    maxLength={6}
                                    onChangeText={setCode}
                                    placeholder="000000"
                                    placeholderTextColor={theme.textMuted}
                                    style={[
                                        styles.input,
                                        styles.inputSolo,
                                        styles.codeInput,
                                        isDarkHud && styles.darkInputRow,
                                    ]}
                                    testID="email-change-code-input"
                                    value={code}
                                />
                            </View>

                            <View style={styles.resendRow}>
                                <Pressable
                                    accessibilityLabel="Resend Code"
                                    disabled={cooldown > 0 || isLoading}
                                    onPress={handleResendCode}
                                    style={({ pressed }) => [
                                        styles.resendBtn,
                                        pressed && styles.pressed,
                                    ]}
                                    testID="email-change-resend-btn"
                                >
                                    <Text
                                        style={[
                                            styles.resendBtnText,
                                            cooldown > 0 &&
                                                styles.resendBtnDisabledText,
                                            isDarkHud &&
                                                cooldown === 0 &&
                                                styles.darkResendBtnText,
                                        ]}
                                    >
                                        {cooldown > 0
                                            ? `Resend code in ${cooldown}s`
                                            : 'Resend code'}
                                    </Text>
                                </Pressable>
                            </View>

                            <View style={styles.actions}>
                                <Pressable
                                    accessibilityLabel="Back"
                                    disabled={isLoading}
                                    onPress={() => setStep('request')}
                                    style={({ pressed }) => [
                                        styles.cancelBtn,
                                        isDarkHud && styles.darkCancelBtn,
                                        pressed && styles.pressed,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.cancelBtnText,
                                            isDarkHud &&
                                                styles.darkCancelBtnText,
                                        ]}
                                    >
                                        Back
                                    </Text>
                                </Pressable>
                                <Pressable
                                    accessibilityLabel="Verify and update email"
                                    disabled={
                                        isLoading || code.trim().length !== 6
                                    }
                                    onPress={handleVerifyCode}
                                    style={({ pressed }) => [
                                        styles.primaryBtn,
                                        isDarkHud
                                            ? styles.darkPrimaryBtn
                                            : styles.lightPrimaryBtn,
                                        (isLoading ||
                                            code.trim().length !== 6) &&
                                            styles.disabledBtn,
                                        pressed && styles.pressed,
                                    ]}
                                    testID="email-change-verify-btn"
                                >
                                    {isLoading ? (
                                        <ActivityIndicator
                                            color={theme.surfaceDark}
                                            size="small"
                                        />
                                    ) : (
                                        <Text style={styles.primaryBtnText}>
                                            Verify & Update
                                        </Text>
                                    )}
                                </Pressable>
                            </View>
                        </View>
                    )}
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
            marginBottom: 16,
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
        headerTitles: {
            flex: 1,
        },
        title: {
            fontSize: 18,
            fontWeight: '700',
            color: theme.textPrimary,
        },
        stepLabel: {
            fontSize: 12,
            color: theme.textSecondary,
            marginTop: 2,
        },
        errorBanner: {
            backgroundColor: theme.hazardRedLight,
            borderRadius: 8,
            padding: 10,
            marginBottom: 16,
        },
        errorBannerText: {
            color: theme.hazardRed,
            fontSize: 13,
            fontWeight: '500',
        },
        formBody: {
            gap: 16,
        },
        fieldGroup: {
            gap: 6,
        },
        fieldLabel: {
            fontSize: 13,
            fontWeight: '600',
            color: theme.textPrimary,
        },
        darkFieldLabel: {
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
        inputSolo: {
            borderWidth: 1,
            borderColor: theme.borderStrong,
            borderRadius: 10,
            backgroundColor: theme.surfaceHighlight,
            paddingHorizontal: 12,
        },
        input: {
            flex: 1,
            height: 48,
            fontSize: 15,
            color: theme.textPrimary,
        },
        codeInput: {
            textAlign: 'center',
            fontSize: 22,
            letterSpacing: 8,
            fontWeight: '700',
        },
        eyeBtn: {
            minWidth: 48,
            minHeight: 48,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 8,
        },
        verifyNotice: {
            fontSize: 14,
            color: theme.textSecondary,
            lineHeight: 20,
        },
        boldEmail: {
            fontWeight: '700',
            color: theme.brandAmber,
        },
        resendRow: {
            alignItems: 'flex-start',
        },
        resendBtn: {
            minHeight: 48,
            justifyContent: 'center',
            paddingVertical: 6,
        },
        resendBtnText: {
            fontSize: 13,
            fontWeight: '600',
            color: theme.brandAmber,
        },
        darkResendBtnText: {
            color: theme.brandAmberText,
        },
        resendBtnDisabledText: {
            color: theme.textMuted,
        },
        actions: {
            flexDirection: 'row',
            gap: 12,
            justifyContent: 'flex-end',
            marginTop: 8,
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
        primaryBtn: {
            minHeight: 48,
            paddingHorizontal: 20,
            borderRadius: 10,
            justifyContent: 'center',
            alignItems: 'center',
        },
        lightPrimaryBtn: {
            backgroundColor: theme.brandAmber,
        },
        darkPrimaryBtn: {
            backgroundColor: theme.brandAmber,
        },
        disabledBtn: {
            opacity: 0.5,
        },
        primaryBtnText: {
            fontSize: 14,
            fontWeight: '700',
            color: theme.surfaceDark,
        },
        pressed: {
            opacity: 0.75,
        },
    });
