import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { Icon } from '../../../components/common/Icon';
import type { IconName } from '../../../components/common/Icon';
import type { FieldApiClient } from '../../../services/apiClient';
import { useTheme, useThemedStyles } from '../../../theme';
import type { ThemeColors } from '../../../theme';
import type {
    SecuritySettingsData,
    TrustedDeviceItem,
} from '../../../types/account';

const MIN_PASSWORD_LENGTH = 12;

export interface SecurityTabProps {
    security: SecuritySettingsData;
    trustedDevices: TrustedDeviceItem[];
    role?: string | null;
    userEmail?: string;
    apiClient: FieldApiClient;
    onSecurityUpdated: () => void;
    onOpenOtpModal: (action: 'enable' | 'disable') => void;
}

const getPlatformIcon = (platform: string): IconName => {
    const p = (platform || '').toLowerCase();

    if (p.includes('android')) {
        return 'logo-android';
    }

    if (
        p.includes('ios') ||
        p.includes('apple') ||
        p.includes('mac') ||
        p.includes('iphone') ||
        p.includes('ipad')
    ) {
        return 'logo-apple';
    }

    if (p.includes('windows')) {
        return 'logo-windows';
    }

    if (p.includes('tablet')) {
        return 'tablet';
    }

    return 'laptop';
};

export const SecurityTab: React.FC<SecurityTabProps> = ({
    security,
    trustedDevices,
    role,
    userEmail,
    apiClient,
    onSecurityUpdated,
    onOpenOtpModal,
}) => {
    const { isDarkHud, theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const isSystemAdmin = role === 'system_administrator';

    // Password form state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
    const [passwordFeedback, setPasswordFeedback] = useState<{
        type: 'success' | 'error';
        message: string;
    } | null>(null);

    // Device actions state
    const [processingDeviceId, setProcessingDeviceId] = useState<string | null>(
        null,
    );
    const [isRevokingAllDevices, setIsRevokingAllDevices] = useState(false);
    const [deviceFeedback, setDeviceFeedback] = useState<string | null>(null);

    // Real-time password complexity checklist
    // Matches the server's production rule (Password::min(12)).
    const hasMinLength = newPassword.length >= MIN_PASSWORD_LENGTH;
    const hasUppercase = /[A-Z]/.test(newPassword);
    const hasLowercase = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSymbol = /[^A-Za-z0-9]/.test(newPassword);
    const passwordsMatch = Boolean(
        newPassword && newPassword === confirmPassword,
    );
    const isPasswordValid =
        hasMinLength &&
        hasUppercase &&
        hasLowercase &&
        hasNumber &&
        hasSymbol &&
        passwordsMatch;

    const complexityScore =
        (hasMinLength ? 1 : 0) +
        (hasUppercase ? 1 : 0) +
        (hasLowercase ? 1 : 0) +
        (hasNumber ? 1 : 0) +
        (hasSymbol ? 1 : 0) +
        (passwordsMatch ? 1 : 0);

    const getStrengthDetails = () => {
        if (!newPassword) {
            return {
                label: 'None',
                color: theme.textMuted,
                percent: 0,
            };
        }

        if (complexityScore <= 2) {
            return {
                label: 'Weak',
                color: theme.hazardRed,
                percent: Math.max(16, (complexityScore / 6) * 100),
            };
        }

        if (complexityScore <= 4) {
            return {
                label: 'Fair',
                // A caution, so the warning family, never brand gold.
                color: theme.warningOrange,
                percent: (complexityScore / 6) * 100,
            };
        }

        if (complexityScore === 5) {
            return {
                label: 'Strong',
                color: theme.successEmerald,
                percent: (complexityScore / 6) * 100,
            };
        }

        return {
            label: 'Excellent',
            color: theme.successEmeraldText,
            percent: 100,
        };
    };
    const strength = getStrengthDetails();

    const handlePasswordSubmit = async () => {
        if (!currentPassword.trim()) {
            setPasswordFeedback({
                type: 'error',
                message: 'Current password is required',
            });

            return;
        }

        if (!isPasswordValid) {
            setPasswordFeedback({
                type: 'error',
                message: 'Please satisfy all password complexity rules',
            });

            return;
        }

        setIsUpdatingPassword(true);
        setPasswordFeedback(null);

        try {
            const res = await apiClient.updatePassword({
                currentPassword: currentPassword.trim(),
                newPassword: newPassword.trim(),
                confirmation: confirmPassword.trim(),
            });

            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setPasswordFeedback({
                type: 'success',
                message:
                    res.message ||
                    'Password updated successfully. Other web sessions and device trust have been revoked.',
            });
            onSecurityUpdated();
        } catch (err: any) {
            setPasswordFeedback({
                type: 'error',
                message: err.message || 'Failed to update password',
            });
        } finally {
            setIsUpdatingPassword(false);
        }
    };

    const executeRevokeDevice = async (deviceId: string) => {
        setProcessingDeviceId(deviceId);
        setDeviceFeedback(null);

        try {
            await apiClient.revokeTrustedDevice(deviceId);
            setDeviceFeedback('Trusted device revoked successfully.');
            setTimeout(() => setDeviceFeedback(null), 3000);
            onSecurityUpdated();
        } catch (err: any) {
            setDeviceFeedback(err.message || 'Failed to revoke device.');
        } finally {
            setProcessingDeviceId(null);
        }
    };

    const handleRevokeDevice = (deviceId: string, deviceLabel?: string) => {
        Alert.alert(
            'Revoke Trusted Device',
            `Are you sure you want to revoke trust for ${deviceLabel || 'this device'}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Revoke',
                    style: 'destructive',
                    onPress: () => void executeRevokeDevice(deviceId),
                },
            ],
        );
    };

    const executeReportLostDevice = async (deviceId: string) => {
        setProcessingDeviceId(deviceId);
        setDeviceFeedback(null);

        try {
            await apiClient.markDeviceLost(deviceId);
            setDeviceFeedback('Device reported lost and all access revoked.');
            setTimeout(() => setDeviceFeedback(null), 3000);
            onSecurityUpdated();
        } catch (err: any) {
            setDeviceFeedback(err.message || 'Failed to report device lost.');
        } finally {
            setProcessingDeviceId(null);
        }
    };

    const handleReportLostDevice = (deviceId: string, deviceLabel?: string) => {
        Alert.alert(
            'Report Device Lost',
            `Reporting ${deviceLabel || 'this device'} lost will immediately terminate its active sessions and revoke device trust. Continue?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Report Lost',
                    style: 'destructive',
                    onPress: () => void executeReportLostDevice(deviceId),
                },
            ],
        );
    };

    const executeRevokeAllDevices = async () => {
        setIsRevokingAllDevices(true);
        setDeviceFeedback(null);

        try {
            await apiClient.revokeAllTrustedDevices();
            setDeviceFeedback('All trusted devices have been revoked.');
            setTimeout(() => setDeviceFeedback(null), 3000);
            onSecurityUpdated();
        } catch (err: any) {
            setDeviceFeedback(err.message || 'Failed to revoke all devices.');
        } finally {
            setIsRevokingAllDevices(false);
        }
    };

    const handleRevokeAllDevices = () => {
        Alert.alert(
            'Revoke All Trusted Devices',
            'Are you sure you want to revoke trust for all registered devices? Any device without an active session will require re-verification.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Revoke All',
                    style: 'destructive',
                    onPress: () => void executeRevokeAllDevices(),
                },
            ],
        );
    };

    return (
        <View style={styles.container} testID="security-tab">
            {/* Two-Factor Authentication Card */}
            <View style={[styles.card]}>
                <View style={styles.otpHeaderRow}>
                    <View style={styles.otpIconTitle}>
                        <View
                            style={[
                                styles.iconWrap,
                                security.email_otp_enabled
                                    ? isDarkHud
                                        ? styles.darkIconWrapSuccess
                                        : styles.lightIconWrapSuccess
                                    : isDarkHud
                                      ? styles.darkIconWrap
                                      : styles.lightIconWrap,
                            ]}
                        >
                            <Icon
                                color={
                                    security.email_otp_enabled
                                        ? theme.successEmerald
                                        : theme.brandAmber
                                }
                                name={
                                    security.email_otp_enabled
                                        ? 'shield-check'
                                        : 'shield'
                                }
                                size={20}
                            />
                        </View>
                        <View style={styles.otpTitleBlock}>
                            <Text style={[styles.cardTitle]}>
                                Two-Factor Authentication
                            </Text>
                            <Text style={[styles.cardSubtitle]}>
                                Secure your account with email verification
                                codes
                            </Text>
                        </View>
                    </View>

                    <View
                        style={[
                            styles.statusPill,
                            security.email_otp_enabled
                                ? styles.statusPillActive
                                : styles.statusPillInactive,
                        ]}
                    >
                        <Text
                            style={[
                                styles.statusPillText,
                                security.email_otp_enabled
                                    ? styles.statusPillTextActive
                                    : styles.statusPillTextInactive,
                            ]}
                        >
                            {security.email_otp_enabled ? 'Active' : 'Inactive'}
                        </Text>
                    </View>
                </View>

                <Text style={[styles.otpDescription]}>
                    When enabled, sign-ins from unrecognized browsers or devices
                    require entering a 6-digit one-time code sent to your
                    verified email address.
                </Text>

                {security.has_verified_email ? (
                    <View style={[styles.verifiedEmailBadgeRow]}>
                        <Icon
                            color={theme.successEmerald}
                            name="check-circle"
                            size={14}
                        />
                        <Text style={[styles.verifiedEmailText]}>
                            {userEmail
                                ? `Codes routed to ${userEmail} (Verified)`
                                : 'Codes routed to primary verified email'}
                        </Text>
                    </View>
                ) : null}

                <View style={styles.otpActionRow}>
                    <Pressable
                        accessibilityLabel={
                            isSystemAdmin && security.email_otp_enabled
                                ? 'Two-Factor Authentication is enforced for System Administrators'
                                : security.email_otp_enabled
                                  ? 'Disable Two-Factor Authentication'
                                  : 'Enable Two-Factor Authentication'
                        }
                        accessibilityRole="button"
                        disabled={isSystemAdmin && security.email_otp_enabled}
                        onPress={() => {
                            if (isSystemAdmin && security.email_otp_enabled) {
                                return;
                            }

                            onOpenOtpModal(
                                security.email_otp_enabled
                                    ? 'disable'
                                    : 'enable',
                            );
                        }}
                        style={({ pressed }) => [
                            styles.otpToggleBtn,
                            security.email_otp_enabled
                                ? isDarkHud
                                    ? styles.darkOtpDisableBtn
                                    : styles.otpDisableBtn
                                : isDarkHud
                                  ? styles.darkOtpEnableBtn
                                  : styles.lightOtpEnableBtn,
                            isSystemAdmin &&
                                security.email_otp_enabled &&
                                styles.disabledBtn,
                            pressed &&
                                !(
                                    isSystemAdmin && security.email_otp_enabled
                                ) &&
                                styles.pressed,
                        ]}
                        testID="btn-toggle-2fa"
                    >
                        <Text
                            style={[
                                styles.otpToggleBtnText,
                                security.email_otp_enabled &&
                                    (isDarkHud
                                        ? styles.darkOtpDisableBtnText
                                        : styles.otpDisableBtnText),
                            ]}
                        >
                            {isSystemAdmin && security.email_otp_enabled
                                ? 'Enforced'
                                : security.email_otp_enabled
                                  ? 'Disable 2FA'
                                  : 'Enable 2FA'}
                        </Text>
                    </Pressable>
                    {isSystemAdmin && security.email_otp_enabled ? (
                        <Text
                            style={[styles.adminPolicyText]}
                            testID="admin-2fa-policy-notice"
                        >
                            Mandatory for System Administrators by
                            organizational policy.
                        </Text>
                    ) : null}
                </View>
            </View>

            {/* Change Password Card */}
            <View style={[styles.card]}>
                <Text style={[styles.cardTitle]}>Change Password</Text>
                <Text style={[styles.cardSubtitle]}>
                    Ensure your account is using a long, random password
                </Text>

                {passwordFeedback ? (
                    <View
                        style={[
                            styles.feedbackBanner,
                            passwordFeedback.type === 'success'
                                ? styles.feedbackSuccess
                                : styles.feedbackError,
                        ]}
                    >
                        <Text
                            style={[
                                styles.feedbackText,
                                passwordFeedback.type === 'success'
                                    ? styles.feedbackSuccessText
                                    : styles.feedbackErrorText,
                            ]}
                        >
                            {passwordFeedback.message}
                        </Text>
                    </View>
                ) : null}

                <View style={styles.formFields}>
                    {/* Apple HIG Grouped Inset Stacked Password Form */}
                    <View
                        style={[
                            styles.groupedInputContainer,
                            isDarkHud && styles.darkGroupedInputContainer,
                        ]}
                    >
                        {/* Current Password Stacked Row */}
                        <View style={styles.stackedInputCell}>
                            <Text style={[styles.stackedInputLabel]}>
                                Current Password
                            </Text>
                            <View style={styles.stackedInputRow}>
                                <TextInput
                                    accessibilityLabel="Current password"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    onChangeText={setCurrentPassword}
                                    placeholder="Enter current password"
                                    placeholderTextColor={theme.textMuted}
                                    secureTextEntry={!showCurrentPassword}
                                    style={[styles.textInput]}
                                    testID="input-current-password"
                                    value={currentPassword}
                                />
                                <Pressable
                                    accessibilityLabel={
                                        showCurrentPassword
                                            ? 'Hide password'
                                            : 'Show password'
                                    }
                                    onPress={() =>
                                        setShowCurrentPassword(
                                            !showCurrentPassword,
                                        )
                                    }
                                    style={styles.eyeBtn}
                                >
                                    <Icon
                                        color={theme.textSecondary}
                                        name={
                                            showCurrentPassword
                                                ? 'eye-off'
                                                : 'eye'
                                        }
                                        size={18}
                                    />
                                </Pressable>
                            </View>
                        </View>

                        <View
                            style={[
                                styles.stackedHairlineDivider,
                                isDarkHud && styles.darkStackedHairlineDivider,
                            ]}
                        />

                        {/* New Password Stacked Row */}
                        <View style={styles.stackedInputCell}>
                            <Text style={[styles.stackedInputLabel]}>
                                New Password
                            </Text>
                            <View style={styles.stackedInputRow}>
                                <TextInput
                                    accessibilityLabel="New password"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    onChangeText={setNewPassword}
                                    placeholder="Enter new password"
                                    placeholderTextColor={theme.textMuted}
                                    secureTextEntry={!showNewPassword}
                                    style={[styles.textInput]}
                                    testID="input-new-password"
                                    value={newPassword}
                                />
                                <Pressable
                                    accessibilityLabel={
                                        showNewPassword
                                            ? 'Hide password'
                                            : 'Show password'
                                    }
                                    onPress={() =>
                                        setShowNewPassword(!showNewPassword)
                                    }
                                    style={styles.eyeBtn}
                                >
                                    <Icon
                                        color={theme.textSecondary}
                                        name={
                                            showNewPassword ? 'eye-off' : 'eye'
                                        }
                                        size={18}
                                    />
                                </Pressable>
                            </View>
                        </View>

                        <View
                            style={[
                                styles.stackedHairlineDivider,
                                isDarkHud && styles.darkStackedHairlineDivider,
                            ]}
                        />

                        {/* Confirm Password Stacked Row */}
                        <View style={styles.stackedInputCell}>
                            <Text style={[styles.stackedInputLabel]}>
                                Confirm Password
                            </Text>
                            <View style={styles.stackedInputRow}>
                                <TextInput
                                    accessibilityLabel="Confirm new password"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    onChangeText={setConfirmPassword}
                                    placeholder="Re-enter new password"
                                    placeholderTextColor={theme.textMuted}
                                    secureTextEntry={!showConfirmPassword}
                                    style={[styles.textInput]}
                                    testID="input-confirm-password"
                                    value={confirmPassword}
                                />
                                <Pressable
                                    accessibilityLabel={
                                        showConfirmPassword
                                            ? 'Hide password'
                                            : 'Show password'
                                    }
                                    onPress={() =>
                                        setShowConfirmPassword(
                                            !showConfirmPassword,
                                        )
                                    }
                                    style={styles.eyeBtn}
                                >
                                    <Icon
                                        color={theme.textSecondary}
                                        name={
                                            showConfirmPassword
                                                ? 'eye-off'
                                                : 'eye'
                                        }
                                        size={18}
                                    />
                                </Pressable>
                            </View>
                        </View>
                    </View>

                    {/* Dynamic Real-time Password Strength Meter */}
                    {newPassword ? (
                        <View style={styles.strengthContainer}>
                            <View style={styles.strengthHeader}>
                                <Text style={[styles.strengthLabel]}>
                                    Password Strength
                                </Text>
                                <Text
                                    style={[
                                        styles.strengthValue,
                                        { color: strength.color },
                                    ]}
                                >
                                    {strength.label}
                                </Text>
                            </View>
                            <View style={[styles.strengthTrack]}>
                                <View
                                    style={[
                                        styles.strengthFill,
                                        {
                                            width: `${strength.percent}%`,
                                            backgroundColor: strength.color,
                                        },
                                    ]}
                                />
                            </View>
                        </View>
                    ) : null}

                    {/* Password Complexity Checklist */}
                    <View
                        style={[
                            styles.checklistCard,
                            isDarkHud && styles.darkChecklistCard,
                        ]}
                    >
                        <Text style={[styles.checklistTitle]}>
                            Password Requirements
                        </Text>
                        <View style={styles.checklistGrid}>
                            <View style={styles.checklistItem}>
                                <Text
                                    style={[
                                        styles.checkIcon,
                                        hasMinLength
                                            ? styles.checkSuccess
                                            : styles.checkPending,
                                    ]}
                                >
                                    {hasMinLength ? '✓' : '○'}
                                </Text>
                                <Text
                                    style={[
                                        styles.checkText,
                                        hasMinLength && styles.checkTextDone,
                                    ]}
                                >
                                    At least {MIN_PASSWORD_LENGTH} characters
                                </Text>
                            </View>

                            <View style={styles.checklistItem}>
                                <Text
                                    style={[
                                        styles.checkIcon,
                                        hasUppercase
                                            ? styles.checkSuccess
                                            : styles.checkPending,
                                    ]}
                                >
                                    {hasUppercase ? '✓' : '○'}
                                </Text>
                                <Text
                                    style={[
                                        styles.checkText,
                                        hasUppercase && styles.checkTextDone,
                                    ]}
                                >
                                    Uppercase letter
                                </Text>
                            </View>

                            <View style={styles.checklistItem}>
                                <Text
                                    style={[
                                        styles.checkIcon,
                                        hasLowercase
                                            ? styles.checkSuccess
                                            : styles.checkPending,
                                    ]}
                                >
                                    {hasLowercase ? '✓' : '○'}
                                </Text>
                                <Text
                                    style={[
                                        styles.checkText,
                                        hasLowercase && styles.checkTextDone,
                                    ]}
                                >
                                    Lowercase letter
                                </Text>
                            </View>

                            <View style={styles.checklistItem}>
                                <Text
                                    style={[
                                        styles.checkIcon,
                                        hasNumber
                                            ? styles.checkSuccess
                                            : styles.checkPending,
                                    ]}
                                >
                                    {hasNumber ? '✓' : '○'}
                                </Text>
                                <Text
                                    style={[
                                        styles.checkText,
                                        hasNumber && styles.checkTextDone,
                                    ]}
                                >
                                    Number (0-9)
                                </Text>
                            </View>

                            <View style={styles.checklistItem}>
                                <Text
                                    style={[
                                        styles.checkIcon,
                                        hasSymbol
                                            ? styles.checkSuccess
                                            : styles.checkPending,
                                    ]}
                                >
                                    {hasSymbol ? '✓' : '○'}
                                </Text>
                                <Text
                                    style={[
                                        styles.checkText,
                                        hasSymbol && styles.checkTextDone,
                                    ]}
                                >
                                    Special symbol (!@#$)
                                </Text>
                            </View>

                            <View style={styles.checklistItem}>
                                <Text
                                    style={[
                                        styles.checkIcon,
                                        passwordsMatch
                                            ? styles.checkSuccess
                                            : styles.checkPending,
                                    ]}
                                >
                                    {passwordsMatch ? '✓' : '○'}
                                </Text>
                                <Text
                                    style={[
                                        styles.checkText,
                                        passwordsMatch && styles.checkTextDone,
                                    ]}
                                >
                                    Passwords match
                                </Text>
                            </View>
                        </View>
                    </View>

                    <Pressable
                        accessibilityLabel="Save new password"
                        accessibilityRole="button"
                        disabled={
                            isUpdatingPassword ||
                            !isPasswordValid ||
                            !currentPassword.trim()
                        }
                        onPress={handlePasswordSubmit}
                        style={({ pressed }) => [
                            styles.savePasswordBtn,
                            isDarkHud
                                ? styles.darkSavePasswordBtn
                                : styles.lightSavePasswordBtn,
                            (!isPasswordValid ||
                                !currentPassword.trim() ||
                                isUpdatingPassword) &&
                                styles.disabledBtn,
                            pressed && styles.pressed,
                        ]}
                        testID="btn-update-password"
                    >
                        {isUpdatingPassword ? (
                            <ActivityIndicator
                                color={theme.surfaceDark}
                                size="small"
                            />
                        ) : (
                            <Text style={styles.savePasswordBtnText}>
                                Update Password
                            </Text>
                        )}
                    </Pressable>
                </View>
            </View>

            {/* Trusted Devices Management Card */}
            <View style={[styles.card]}>
                <View style={styles.trustedHeaderRow}>
                    <View>
                        <Text style={[styles.cardTitle]}>
                            Trusted Devices ({trustedDevices.length})
                        </Text>
                        <Text style={[styles.cardSubtitle]}>
                            Devices authenticated with 30-day trust
                        </Text>
                    </View>

                    {trustedDevices.length > 0 ? (
                        <Pressable
                            accessibilityLabel="Revoke all trusted devices"
                            accessibilityRole="button"
                            disabled={isRevokingAllDevices}
                            onPress={handleRevokeAllDevices}
                            style={({ pressed }) => [
                                styles.revokeAllBtn,
                                pressed && styles.pressed,
                            ]}
                            testID="revoke-all-devices-btn"
                        >
                            <Text style={styles.revokeAllBtnText}>
                                Revoke All
                            </Text>
                        </Pressable>
                    ) : null}
                </View>

                {deviceFeedback ? (
                    <View
                        style={[
                            styles.feedbackBanner,
                            styles.feedbackSuccess,
                            { marginTop: 12 },
                        ]}
                    >
                        <Text
                            style={[
                                styles.feedbackText,
                                styles.feedbackSuccessText,
                            ]}
                        >
                            {deviceFeedback}
                        </Text>
                    </View>
                ) : null}

                <View style={styles.devicesList}>
                    {trustedDevices.length === 0 ? (
                        <Text style={[styles.emptyText]}>
                            No trusted devices currently registered.
                        </Text>
                    ) : (
                        trustedDevices.map((device) => {
                            const isProcessing =
                                processingDeviceId === device.id;

                            return (
                                <View
                                    key={device.id}
                                    style={[
                                        styles.deviceCard,
                                        isDarkHud && styles.darkDeviceCard,
                                    ]}
                                    testID={`device-item-${device.id}`}
                                >
                                    <View style={styles.deviceTopRow}>
                                        <View
                                            style={[
                                                styles.devicePlatformBadge,
                                                isDarkHud &&
                                                    styles.darkDevicePlatformBadge,
                                            ]}
                                        >
                                            <Icon
                                                color={theme.actionCobalt}
                                                name={getPlatformIcon(
                                                    device.platform,
                                                )}
                                                size={18}
                                            />
                                        </View>
                                        <View style={styles.deviceMeta}>
                                            <Text style={[styles.deviceLabel]}>
                                                {device.device_label}
                                            </Text>
                                            <Text
                                                style={[styles.devicePlatform]}
                                            >
                                                {device.platform} ·{' '}
                                                {device.ip_address} (
                                                {device.location})
                                            </Text>
                                            <Text style={[styles.deviceExpiry]}>
                                                Active {device.last_used_human}{' '}
                                                · Expires {device.expires_human}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.deviceActionsRow}>
                                        <Pressable
                                            accessibilityLabel={`Report ${device.device_label} lost`}
                                            disabled={isProcessing}
                                            onPress={() =>
                                                handleReportLostDevice(
                                                    device.id,
                                                    device.device_label,
                                                )
                                            }
                                            style={({ pressed }) => [
                                                styles.deviceLostBtn,
                                                pressed && styles.pressed,
                                            ]}
                                            testID={`report-lost-${device.id}`}
                                        >
                                            <Text style={styles.deviceLostText}>
                                                Report Lost
                                            </Text>
                                        </Pressable>

                                        <Pressable
                                            accessibilityLabel={`Revoke ${device.device_label}`}
                                            disabled={isProcessing}
                                            onPress={() =>
                                                handleRevokeDevice(
                                                    device.id,
                                                    device.device_label,
                                                )
                                            }
                                            style={({ pressed }) => [
                                                styles.deviceRevokeBtn,
                                                isDarkHud &&
                                                    styles.darkDeviceRevokeBtn,
                                                pressed && styles.pressed,
                                            ]}
                                            testID={`revoke-device-${device.id}`}
                                        >
                                            {isProcessing ? (
                                                <ActivityIndicator
                                                    color={theme.hazardRed}
                                                    size="small"
                                                />
                                            ) : (
                                                <Text
                                                    style={
                                                        styles.deviceRevokeText
                                                    }
                                                >
                                                    Revoke Trust
                                                </Text>
                                            )}
                                        </Pressable>
                                    </View>
                                </View>
                            );
                        })
                    )}
                </View>
            </View>
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        container: {
            gap: 16,
        },
        card: {
            backgroundColor: theme.surface,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: theme.border,
            elevation: 1,
            overflow: 'hidden',
        },
        cardTitle: {
            fontSize: 16,
            fontWeight: '700',
            color: theme.textPrimary,
        },
        cardSubtitle: {
            fontSize: 12,
            color: theme.textSecondary,
            marginTop: 2,
        },
        otpHeaderRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
        },
        otpIconTitle: {
            flexDirection: 'row',
            gap: 12,
            flex: 1,
        },
        iconWrap: {
            width: 40,
            height: 40,
            borderRadius: 10,
            justifyContent: 'center',
            alignItems: 'center',
        },
        lightIconWrap: {
            backgroundColor: theme.brandAmberLight,
        },
        darkIconWrap: {
            backgroundColor: theme.brandAmberLight,
        },
        lightIconWrapSuccess: {
            backgroundColor: theme.successEmeraldLight,
        },
        darkIconWrapSuccess: {
            backgroundColor: theme.successEmeraldLight,
        },
        otpTitleBlock: {
            flex: 1,
        },
        statusPill: {
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 6,
        },
        statusPillActive: {
            backgroundColor: theme.successEmeraldLight,
        },
        statusPillInactive: {
            backgroundColor: theme.canvas,
        },
        statusPillText: {
            fontSize: 12,
            fontWeight: '700',
        },
        statusPillTextActive: {
            color: theme.successEmeraldText,
        },
        statusPillTextInactive: {
            color: theme.textSecondary,
        },
        otpDescription: {
            fontSize: 13,
            color: theme.textSecondary,
            lineHeight: 18,
            marginTop: 12,
        },
        verifiedEmailBadgeRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginTop: 10,
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 8,
            backgroundColor: theme.successEmeraldLight,
            alignSelf: 'flex-start',
        },
        verifiedEmailText: {
            fontSize: 12,
            fontWeight: '600',
            color: theme.successEmeraldText,
        },
        otpActionRow: {
            marginTop: 14,
            alignItems: 'flex-start',
        },
        otpToggleBtn: {
            minHeight: 48,
            paddingHorizontal: 16,
            borderRadius: 10,
            justifyContent: 'center',
            alignItems: 'center',
        },
        lightOtpEnableBtn: {
            backgroundColor: theme.brandAmber,
        },
        darkOtpEnableBtn: {
            backgroundColor: theme.brandAmber,
        },
        otpDisableBtn: {
            backgroundColor: theme.hazardRedLight,
        },
        darkOtpDisableBtn: {
            backgroundColor: `${theme.hazardRedLight}40`,
            borderWidth: 1,
            borderColor: theme.hazardRed,
        },
        adminPolicyText: {
            fontSize: 12,
            color: theme.textSecondary,
            marginTop: 8,
        },
        otpToggleBtnText: {
            fontSize: 13,
            fontWeight: '700',
            color: theme.surfaceDark,
        },
        otpDisableBtnText: {
            color: theme.hazardRed,
        },
        darkOtpDisableBtnText: {
            color: theme.hazardRedText,
        },
        feedbackBanner: {
            borderRadius: 10,
            padding: 12,
            marginTop: 12,
        },
        feedbackSuccess: {
            backgroundColor: theme.successEmeraldLight,
            borderWidth: 1,
            borderColor: theme.successEmerald,
        },
        feedbackError: {
            backgroundColor: theme.hazardRedLight,
            borderWidth: 1,
            borderColor: theme.hazardRed,
        },
        feedbackText: {
            fontSize: 13,
            fontWeight: '600',
        },
        feedbackSuccessText: {
            color: theme.successEmeraldText,
        },
        feedbackErrorText: {
            color: theme.hazardRedText,
        },
        formFields: {
            marginTop: 16,
            gap: 14,
        },
        groupedInputContainer: {
            borderRadius: 14,
            borderWidth: 1,
            borderColor: theme.borderStrong,
            backgroundColor: theme.surfaceHighlight,
            overflow: 'hidden',
        },
        darkGroupedInputContainer: {
            backgroundColor: theme.textInverse,
            borderColor: theme.border,
        },
        stackedInputCell: {
            paddingHorizontal: 14,
            paddingTop: 10,
            paddingBottom: 4,
        },
        stackedInputLabel: {
            fontSize: 12,
            fontWeight: '700',
            color: theme.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
        },
        stackedInputRow: {
            flexDirection: 'row',
            alignItems: 'center',
            minHeight: 44,
        },
        stackedHairlineDivider: {
            height: StyleSheet.hairlineWidth,
            backgroundColor: theme.borderStrong,
            marginLeft: 14,
        },
        darkStackedHairlineDivider: {
            backgroundColor: theme.border,
        },
        textInput: {
            flex: 1,
            height: 48,
            fontSize: 14,
            color: theme.textPrimary,
        },
        eyeBtn: {
            minWidth: 48,
            minHeight: 48,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 8,
        },
        checklistCard: {
            backgroundColor: theme.surfaceHighlight,
            borderRadius: 10,
            padding: 12,
            borderWidth: 1,
            borderColor: theme.border,
            gap: 8,
        },
        darkChecklistCard: {
            backgroundColor: theme.textInverse,
            borderColor: theme.border,
        },
        checklistTitle: {
            fontSize: 12,
            fontWeight: '700',
            color: theme.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        checklistGrid: {
            gap: 6,
        },
        checklistItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        checkIcon: {
            fontSize: 13,
            fontWeight: '700',
        },
        checkSuccess: {
            color: theme.hudGlowEmerald,
        },
        checkPending: {
            color: theme.textMuted,
        },
        checkText: {
            fontSize: 12,
            color: theme.textSecondary,
        },
        checkTextDone: {
            color: theme.hudGlowEmerald,
            fontWeight: '600',
        },
        savePasswordBtn: {
            minHeight: 48,
            borderRadius: 10,
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: 6,
        },
        lightSavePasswordBtn: {
            backgroundColor: theme.brandAmber,
        },
        darkSavePasswordBtn: {
            backgroundColor: theme.brandAmber,
        },
        savePasswordBtnText: {
            fontSize: 14,
            fontWeight: '700',
            color: theme.surfaceDark,
        },
        trustedHeaderRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        revokeAllBtn: {
            minHeight: 48,
            justifyContent: 'center',
            paddingHorizontal: 8,
        },
        revokeAllBtnText: {
            fontSize: 12,
            fontWeight: '700',
            color: theme.hazardRed,
        },
        devicesList: {
            marginTop: 14,
            gap: 10,
        },
        emptyText: {
            fontSize: 13,
            color: theme.textMuted,
            fontStyle: 'italic',
            paddingVertical: 8,
        },
        deviceCard: {
            padding: 12,
            borderRadius: 10,
            backgroundColor: theme.surfaceHighlight,
            borderWidth: 1,
            borderColor: theme.border,
            gap: 10,
        },
        darkDeviceCard: {
            backgroundColor: theme.textInverse,
            borderColor: theme.border,
        },
        deviceTopRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        deviceMeta: {
            flex: 1,
            gap: 2,
        },
        devicePlatformBadge: {
            width: 38,
            height: 38,
            borderRadius: 10,
            backgroundColor: theme.actionCobaltLight,
            justifyContent: 'center',
            alignItems: 'center',
        },
        darkDevicePlatformBadge: {
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: theme.border,
        },
        deviceLabel: {
            fontSize: 14,
            fontWeight: '700',
            color: theme.textPrimary,
        },
        devicePlatform: {
            fontSize: 12,
            color: theme.textSecondary,
        },
        deviceExpiry: {
            fontSize: 12,
            color: theme.textMuted,
        },
        deviceActionsRow: {
            flexDirection: 'row',
            gap: 8,
            justifyContent: 'flex-end',
        },
        deviceLostBtn: {
            minHeight: 48,
            paddingHorizontal: 12,
            borderRadius: 8,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: theme.hazardRedLight,
        },
        deviceLostText: {
            fontSize: 12,
            fontWeight: '600',
            color: theme.hazardRed,
        },
        deviceRevokeBtn: {
            minHeight: 48,
            paddingHorizontal: 12,
            borderRadius: 8,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: theme.canvas,
        },
        darkDeviceRevokeBtn: {
            backgroundColor: theme.border,
        },
        deviceRevokeText: {
            fontSize: 12,
            fontWeight: '600',
            color: theme.textSecondary,
        },
        strengthContainer: {
            gap: 6,
            marginTop: 2,
        },
        strengthHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        strengthLabel: {
            fontSize: 12,
            fontWeight: '600',
            color: theme.textSecondary,
        },
        strengthValue: {
            fontSize: 12,
            fontWeight: '700',
        },
        strengthTrack: {
            height: 6,
            backgroundColor: theme.border,
            borderRadius: 3,
            overflow: 'hidden',
        },
        strengthFill: {
            height: '100%',
            borderRadius: 3,
        },
        disabledBtn: {
            opacity: 0.5,
        },
        pressed: {
            opacity: 0.75,
        },
    });
