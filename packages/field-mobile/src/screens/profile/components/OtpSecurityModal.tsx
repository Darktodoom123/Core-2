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

export interface OtpSecurityModalProps {
    visible: boolean;
    action: 'enable' | 'disable';
    apiClient: FieldApiClient;
    onClose: () => void;
    onSuccess: (newStatus: boolean) => void;
}

export const OtpSecurityModal: React.FC<OtpSecurityModalProps> = ({
    visible,
    action,
    apiClient,
    onClose,
    onSuccess,
}) => {
    const { isDarkHud, theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const [step, setStep] = useState<'password' | 'code'>('password');
    const [currentPassword, setCurrentPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [challengeId, setChallengeId] = useState('');
    const [code, setCode] = useState('');
    const [cooldown, setCooldown] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
        setStep('password');
        setCurrentPassword('');
        setChallengeId('');
        setCode('');
        setCooldown(0);
        setErrorMessage(null);
        setIsLoading(false);
        onClose();
    };

    const handleRequestOtp = async () => {
        if (!currentPassword.trim()) {
            setErrorMessage('Current password is required');

            return;
        }

        setIsLoading(true);
        setErrorMessage(null);

        try {
            const res =
                action === 'enable'
                    ? await apiClient.requestEnableOtp({
                          currentPassword: currentPassword.trim(),
                      })
                    : await apiClient.requestDisableOtp({
                          currentPassword: currentPassword.trim(),
                      });
            setChallengeId(res.challenge_id);
            setCooldown(res.cooldown_seconds ?? 45);
            setStep('code');
        } catch (err: any) {
            setErrorMessage(
                err.message ||
                    `Failed to request ${action === 'enable' ? 'enabling' : 'disabling'} 2FA`,
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendOtp = async () => {
        if (cooldown > 0 || !challengeId) {
            return;
        }

        setIsLoading(true);
        setErrorMessage(null);

        try {
            const res = await apiClient.resendSecurityOtp({
                challengeId,
                purpose:
                    action === 'enable'
                        ? 'enable_email_otp'
                        : 'disable_email_otp',
            });
            setChallengeId(res.challenge_id);
            setCooldown(res.cooldown_seconds ?? 45);
        } catch (err: any) {
            setErrorMessage(err.message || 'Failed to resend code');
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirmOtp = async () => {
        if (code.trim().length !== 6) {
            setErrorMessage('Please enter the 6-digit code');

            return;
        }

        setIsLoading(true);
        setErrorMessage(null);

        try {
            const res =
                action === 'enable'
                    ? await apiClient.confirmEnableOtp({
                          challengeId,
                          code: code.trim(),
                      })
                    : await apiClient.confirmDisableOtp({
                          challengeId,
                          code: code.trim(),
                      });
            onSuccess(res.email_otp_enabled);
            handleResetAndClose();
        } catch (err: any) {
            setErrorMessage(
                err.message || 'Verification failed. Please check the code.',
            );
        } finally {
            setIsLoading(false);
        }
    };

    const title =
        action === 'enable'
            ? 'Enable Two-Factor Authentication'
            : 'Disable Two-Factor Authentication';

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
                testID="otp-security-modal"
            >
                <Pressable
                    accessibilityLabel="Close modal"
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
                                name="shield"
                                size={22}
                            />
                        </View>
                        <View style={styles.headerTitles}>
                            <Text
                                accessibilityRole="header"
                                style={[styles.title]}
                            >
                                {title}
                            </Text>
                            <Text style={[styles.stepLabel]}>
                                {step === 'password'
                                    ? 'Step 1 of 2 · Re-authenticate'
                                    : 'Step 2 of 2 · Verify Email Code'}
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

                    {step === 'password' ? (
                        <View style={styles.formBody}>
                            <Text style={[styles.description]}>
                                {action === 'enable'
                                    ? 'A verification code will be sent to your verified email address to confirm enabling two-factor authentication.'
                                    : 'A verification code will be sent to confirm disabling two-factor authentication for your account.'}
                            </Text>

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
                                        accessibilityLabel="Current password input"
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        onChangeText={setCurrentPassword}
                                        placeholder="Enter current password"
                                        placeholderTextColor={theme.textMuted}
                                        secureTextEntry={!showPassword}
                                        style={[styles.input]}
                                        testID="otp-modal-password-input"
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
                                    testID="otp-modal-cancel-btn"
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
                                    accessibilityLabel="Send confirmation code"
                                    disabled={
                                        isLoading || !currentPassword.trim()
                                    }
                                    onPress={handleRequestOtp}
                                    style={({ pressed }) => [
                                        styles.primaryBtn,
                                        isDarkHud
                                            ? styles.darkPrimaryBtn
                                            : styles.lightPrimaryBtn,
                                        (isLoading ||
                                            !currentPassword.trim()) &&
                                            styles.disabledBtn,
                                        pressed && styles.pressed,
                                    ]}
                                    testID="otp-modal-request-btn"
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
                            <Text style={[styles.description]}>
                                Please enter the 6-digit code sent to your email
                                to confirm this change.
                            </Text>

                            <View style={styles.fieldGroup}>
                                <Text
                                    style={[
                                        styles.fieldLabel,
                                        isDarkHud && styles.darkFieldLabel,
                                    ]}
                                >
                                    Verification Code
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
                                    testID="otp-modal-code-input"
                                    value={code}
                                />
                            </View>

                            <View style={styles.resendRow}>
                                <Pressable
                                    accessibilityLabel="Resend code"
                                    disabled={cooldown > 0 || isLoading}
                                    onPress={handleResendOtp}
                                    style={({ pressed }) => [
                                        styles.resendBtn,
                                        pressed && styles.pressed,
                                    ]}
                                    testID="otp-modal-resend-btn"
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
                                    onPress={() => setStep('password')}
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
                                    accessibilityLabel="Confirm"
                                    disabled={
                                        isLoading || code.trim().length !== 6
                                    }
                                    onPress={handleConfirmOtp}
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
                                    testID="otp-modal-confirm-btn"
                                >
                                    {isLoading ? (
                                        <ActivityIndicator
                                            color={theme.surfaceDark}
                                            size="small"
                                        />
                                    ) : (
                                        <Text style={styles.primaryBtnText}>
                                            Confirm
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
            fontSize: 17,
            fontWeight: '700',
            color: theme.textPrimary,
        },
        stepLabel: {
            fontSize: 12,
            color: theme.textSecondary,
            marginTop: 2,
        },
        description: {
            fontSize: 14,
            color: theme.textSecondary,
            lineHeight: 20,
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
