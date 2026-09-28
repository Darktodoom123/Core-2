import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    KeyboardAvoidingView,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    useWindowDimensions,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import loginHero from '../../assets/login-hero.png';
import { Icon } from '../components/common/Icon';
import { colors } from '../components/nativeStyles';
import { useAuth } from './AuthContext';

export interface LoginScreenProps {
    onLoginSuccess?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
    const {
        login,
        verifyChallenge,
        resendChallenge,
        cancelChallenge,
        logout,
        error,
        clearError,
        status,
        hasPendingRevocation,
        isChallenging,
        challengeData,
    } = useAuth();
    const { width } = useWindowDimensions();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isRetryingRevocation, setIsRetryingRevocation] = useState(false);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const passwordRef = useRef<TextInput>(null);
    const [focusedField, setFocusedField] = useState<
        'username' | 'password' | 'code' | null
    >(null);

    // Verification Challenge State
    const [challengeCode, setChallengeCode] = useState('');
    const [trustDevice, setTrustDevice] = useState(false);
    const [isVerifyingChallenge, setIsVerifyingChallenge] = useState(false);
    const [isResendingChallenge, setIsResendingChallenge] = useState(false);
    const [challengeCooldown, setChallengeCooldown] = useState(45);
    const [prevChallengeId, setPrevChallengeId] = useState<string | null>(null);

    if (
        isChallenging &&
        challengeData &&
        challengeData.challenge_id !== prevChallengeId
    ) {
        setPrevChallengeId(challengeData.challenge_id);
        setChallengeCooldown(challengeData.cooldown_seconds ?? 45);
        setChallengeCode('');
        setTrustDevice(false);
    }

    useEffect(() => {
        if (challengeCooldown <= 0 || !isChallenging) {
            return;
        }

        const timer = setInterval(() => {
            setChallengeCooldown((prev) => Math.max(0, prev - 1));
        }, 1000);

        return () => clearInterval(timer);
    }, [challengeCooldown, isChallenging]);

    const handleVerifyChallenge = async () => {
        if (challengeCode.length !== 6 || isVerifyingChallenge) {
            return;
        }

        setIsVerifyingChallenge(true);

        try {
            await verifyChallenge(challengeCode, trustDevice);

            if (onLoginSuccess) {
                onLoginSuccess();
            }
        } finally {
            setIsVerifyingChallenge(false);
        }
    };

    const handleResend = async () => {
        if (challengeCooldown > 0 || isResendingChallenge) {
            return;
        }

        setIsResendingChallenge(true);

        try {
            await resendChallenge();
            setChallengeCooldown(45);
        } finally {
            setIsResendingChallenge(false);
        }
    };

    const handleSubmit = async () => {
        if (!username.trim() || !password.trim() || isSubmitting) {
            return;
        }

        setIsSubmitting(true);

        try {
            await login(username.trim(), password);

            if (onLoginSuccess) {
                onLoginSuccess();
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRetryRevocation = async () => {
        if (isRetryingRevocation) {
            return;
        }

        setIsRetryingRevocation(true);

        try {
            await logout();
        } finally {
            setIsRetryingRevocation(false);
        }
    };

    const formDisabled =
        isSubmitting || isRetryingRevocation || hasPendingRevocation;
    const submitDisabled = formDisabled || !username.trim() || !password.trim();
    const isMobile = width < 768;

    return (
        <SafeAreaView
            style={styles.safeArea}
            edges={['left', 'right', 'bottom']}
            testID="login-safe-area"
        >
            <StatusBar
                barStyle="dark-content"
                backgroundColor="transparent"
                translucent
            />
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={0}
            >
                <ScrollView
                    contentInsetAdjustmentBehavior="never"
                    contentContainerStyle={[
                        styles.scrollContent,
                        isMobile && styles.mobileScrollContent,
                    ]}
                    keyboardDismissMode="on-drag"
                    keyboardShouldPersistTaps="handled"
                    testID="login-screen"
                >
                    <View
                        style={[styles.card, isMobile && styles.mobileCard]}
                        testID="login-card"
                    >
                        <View
                            style={styles.hero}
                            accessible={false}
                            accessibilityElementsHidden
                            importantForAccessibility="no-hide-descendants"
                        >
                            <Image
                                source={loginHero}
                                style={styles.heroImage}
                                resizeMode="cover"
                                accessible={false}
                            />
                        </View>

                        <View
                            style={[
                                styles.content,
                                isMobile && styles.mobileContent,
                            ]}
                        >
                            <View style={styles.header}>
                                <View style={styles.brandLockup}>
                                    <Text style={styles.wordmark}>
                                        <Text style={styles.wordmarkDark}>
                                            Core{' '}
                                        </Text>
                                        <Text style={styles.wordmarkAmber}>
                                            2
                                        </Text>
                                        <Text style={styles.wordmarkDark}>
                                            {' '}
                                            Field
                                        </Text>
                                    </Text>
                                    <Text style={styles.brandDescriptor}>
                                        Field operations
                                    </Text>
                                </View>
                            </View>

                            {error ? (
                                <View
                                    accessible
                                    style={styles.errorBanner}
                                    accessibilityRole="alert"
                                    accessibilityLiveRegion="assertive"
                                >
                                    <View
                                        style={styles.errorIcon}
                                        accessibilityLabel="Warning"
                                    >
                                        <Icon
                                            name="alert-circle"
                                            size={20}
                                            color={colors.redDark}
                                        />
                                    </View>
                                    <Text selectable style={styles.errorText}>
                                        {error}
                                    </Text>
                                    <Pressable
                                        onPress={clearError}
                                        style={styles.iconButton}
                                        accessibilityRole="button"
                                        accessibilityLabel="Dismiss error"
                                        accessibilityHint="Removes the sign-in error message"
                                    >
                                        <Icon
                                            name="close"
                                            size={20}
                                            color={colors.redDark}
                                        />
                                    </Pressable>
                                </View>
                            ) : null}

                            {status === 'suspended' ? (
                                <View
                                    accessible
                                    style={styles.suspendedBanner}
                                    accessibilityRole="alert"
                                >
                                    <Text style={styles.suspendedTitle}>
                                        Account suspended
                                    </Text>
                                    <Text style={styles.suspendedText}>
                                        Contact a system administrator to
                                        restore field access.
                                    </Text>
                                </View>
                            ) : null}

                            {hasPendingRevocation ? (
                                <View
                                    accessible
                                    style={styles.revocationBanner}
                                    accessibilityRole="alert"
                                    accessibilityLiveRegion="assertive"
                                >
                                    <Text style={styles.revocationTitle}>
                                        Secure sign-out pending
                                    </Text>
                                    <Text
                                        selectable
                                        style={styles.revocationText}
                                    >
                                        This device is locked out until the
                                        server confirms that the previous token
                                        cannot be reused.
                                    </Text>
                                    <Pressable
                                        onPress={() =>
                                            void handleRetryRevocation()
                                        }
                                        disabled={isRetryingRevocation}
                                        style={({ pressed }) => [
                                            styles.retryButton,
                                            pressed && styles.pressed,
                                            isRetryingRevocation &&
                                                styles.disabledButton,
                                        ]}
                                        accessibilityRole="button"
                                        accessibilityLabel="Retry secure sign out"
                                        accessibilityState={{
                                            busy: isRetryingRevocation,
                                            disabled: isRetryingRevocation,
                                        }}
                                        testID="retry-logout-button"
                                    >
                                        {isRetryingRevocation ? (
                                            <ActivityIndicator
                                                color={colors.text}
                                            />
                                        ) : (
                                            <Text
                                                style={styles.retryButtonText}
                                            >
                                                Retry secure sign out
                                            </Text>
                                        )}
                                    </Pressable>
                                </View>
                            ) : null}

                            {isChallenging && challengeData ? (
                                <View
                                    style={styles.form}
                                    testID="verification-challenge-form"
                                >
                                    <View style={styles.challengeHeader}>
                                        <Text style={styles.challengeTitle}>
                                            Device Verification
                                        </Text>
                                        <Text style={styles.challengeText}>
                                            A 6-digit verification code was sent
                                            to{' '}
                                            <Text style={styles.boldEmail}>
                                                {challengeData.email_obfuscated}
                                            </Text>
                                            . Enter it below to sign in.
                                        </Text>
                                    </View>

                                    <View style={styles.fieldGroup}>
                                        <Text style={styles.label}>
                                            Verification Code
                                        </Text>
                                        <TextInput
                                            value={challengeCode}
                                            onChangeText={(val) =>
                                                setChallengeCode(
                                                    val
                                                        .replace(/[^0-9]/g, '')
                                                        .slice(0, 6),
                                                )
                                            }
                                            placeholder="123456"
                                            placeholderTextColor={colors.muted}
                                            keyboardType="number-pad"
                                            maxLength={6}
                                            autoFocus
                                            editable={!isVerifyingChallenge}
                                            style={[
                                                styles.input,
                                                styles.codeInput,
                                                focusedField === 'code' &&
                                                    styles.inputFocused,
                                            ]}
                                            onFocus={() =>
                                                setFocusedField('code')
                                            }
                                            onBlur={() => setFocusedField(null)}
                                            testID="verification-code-input"
                                            accessibilityLabel="6-digit verification code"
                                        />
                                    </View>

                                    {/* Trust Device Checkbox */}
                                    <Pressable
                                        onPress={() =>
                                            setTrustDevice((prev) => !prev)
                                        }
                                        style={styles.checkboxRow}
                                        accessibilityRole="checkbox"
                                        accessibilityState={{
                                            checked: trustDevice,
                                        }}
                                        accessibilityLabel="Trust this device for 30 days. Only on a device you control."
                                        testID="trust-device-checkbox"
                                    >
                                        <View
                                            style={[
                                                styles.checkbox,
                                                trustDevice &&
                                                    styles.checkboxChecked,
                                            ]}
                                        >
                                            {trustDevice ? (
                                                <Text style={styles.checkmark}>
                                                    ✓
                                                </Text>
                                            ) : null}
                                        </View>
                                        <View
                                            style={
                                                styles.checkboxLabelContainer
                                            }
                                        >
                                            <Text style={styles.checkboxLabel}>
                                                Trust this device for 30 days.
                                            </Text>
                                            <Text
                                                style={styles.checkboxSubtext}
                                            >
                                                Only on a device you control.
                                            </Text>
                                        </View>
                                    </Pressable>

                                    {/* Submit button */}
                                    <Pressable
                                        onPress={() =>
                                            void handleVerifyChallenge()
                                        }
                                        disabled={
                                            challengeCode.length !== 6 ||
                                            isVerifyingChallenge
                                        }
                                        style={({ pressed }) => [
                                            styles.submitButton,
                                            pressed && styles.pressed,
                                            (challengeCode.length !== 6 ||
                                                isVerifyingChallenge) &&
                                                styles.disabledButton,
                                        ]}
                                        accessibilityRole="button"
                                        accessibilityLabel="Verify and sign in"
                                        testID="verify-code-button"
                                    >
                                        {isVerifyingChallenge ? (
                                            <ActivityIndicator
                                                color={colors.text}
                                            />
                                        ) : (
                                            <Text
                                                style={styles.submitButtonText}
                                            >
                                                Verify and Sign In
                                            </Text>
                                        )}
                                    </Pressable>

                                    {/* Resend & Cancel actions */}
                                    <View style={styles.challengeActionsRow}>
                                        <Pressable
                                            onPress={() => void handleResend()}
                                            disabled={
                                                challengeCooldown > 0 ||
                                                isResendingChallenge
                                            }
                                            style={styles.textAction}
                                            accessibilityRole="button"
                                            accessibilityLabel={
                                                challengeCooldown > 0
                                                    ? `Resend code available in ${challengeCooldown}s`
                                                    : 'Resend verification code'
                                            }
                                            testID="resend-code-button"
                                        >
                                            <Text
                                                style={[
                                                    styles.textActionLabel,
                                                    challengeCooldown > 0 &&
                                                        styles.disabledText,
                                                ]}
                                            >
                                                {challengeCooldown > 0
                                                    ? `Resend code (${challengeCooldown}s)`
                                                    : 'Resend code'}
                                            </Text>
                                        </Pressable>

                                        <Pressable
                                            onPress={cancelChallenge}
                                            style={styles.textAction}
                                            accessibilityRole="button"
                                            accessibilityLabel="Back to sign in"
                                            testID="cancel-challenge-button"
                                        >
                                            <Text
                                                style={styles.textActionLabel}
                                            >
                                                Back to sign in
                                            </Text>
                                        </Pressable>
                                    </View>
                                </View>
                            ) : (
                                <View style={styles.form}>
                                    <View style={styles.fieldGroup}>
                                        <Text style={styles.label}>
                                            Username
                                        </Text>
                                        <View
                                            style={[
                                                styles.inputShell,
                                                focusedField === 'username' &&
                                                    styles.inputFocused,
                                                formDisabled &&
                                                    styles.inputDisabled,
                                            ]}
                                        >
                                            <View style={styles.inputIcon}>
                                                <Icon
                                                    name="profile"
                                                    size={20}
                                                    color={
                                                        focusedField ===
                                                        'username'
                                                            ? colors.amber
                                                            : colors.muted
                                                    }
                                                />
                                            </View>
                                            <TextInput
                                                value={username}
                                                onChangeText={setUsername}
                                                keyboardType="default"
                                                autoCapitalize="none"
                                                autoCorrect={false}
                                                autoComplete="username"
                                                textContentType="username"
                                                editable={!formDisabled}
                                                style={styles.inputInShell}
                                                onFocus={() =>
                                                    setFocusedField('username')
                                                }
                                                onBlur={() =>
                                                    setFocusedField(null)
                                                }
                                                accessibilityLabel="Username"
                                                accessibilityHint="Enter your work username"
                                                returnKeyType="next"
                                                submitBehavior="submit"
                                                onSubmitEditing={() =>
                                                    passwordRef.current?.focus()
                                                }
                                                testID="login-username-input"
                                            />
                                        </View>
                                    </View>

                                    <View style={styles.fieldGroup}>
                                        <Text style={styles.label}>
                                            Password
                                        </Text>
                                        <View
                                            style={[
                                                styles.inputShell,
                                                focusedField === 'password' &&
                                                    styles.inputFocused,
                                                formDisabled &&
                                                    styles.inputDisabled,
                                            ]}
                                        >
                                            <View style={styles.inputIcon}>
                                                <Icon
                                                    name="lock"
                                                    size={20}
                                                    color={
                                                        focusedField ===
                                                        'password'
                                                            ? colors.amber
                                                            : colors.muted
                                                    }
                                                />
                                            </View>
                                            <TextInput
                                                ref={passwordRef}
                                                value={password}
                                                onChangeText={setPassword}
                                                secureTextEntry={
                                                    !isPasswordVisible
                                                }
                                                autoCapitalize="none"
                                                autoCorrect={false}
                                                autoComplete="current-password"
                                                textContentType="password"
                                                editable={!formDisabled}
                                                style={styles.inputInShell}
                                                onFocus={() =>
                                                    setFocusedField('password')
                                                }
                                                onBlur={() =>
                                                    setFocusedField(null)
                                                }
                                                accessibilityLabel="Password"
                                                returnKeyType="go"
                                                onSubmitEditing={() =>
                                                    void handleSubmit()
                                                }
                                                testID="login-password-input"
                                            />
                                            <Pressable
                                                onPress={() =>
                                                    setIsPasswordVisible(
                                                        (visible) => !visible,
                                                    )
                                                }
                                                style={styles.passwordToggle}
                                                accessibilityRole="button"
                                                accessibilityLabel={
                                                    isPasswordVisible
                                                        ? 'Hide password'
                                                        : 'Show password'
                                                }
                                                accessibilityState={{
                                                    disabled: formDisabled,
                                                }}
                                                disabled={formDisabled}
                                                testID="password-visibility-button"
                                            >
                                                <Icon
                                                    name={
                                                        isPasswordVisible
                                                            ? 'eye-off'
                                                            : 'eye'
                                                    }
                                                    size={22}
                                                    color={colors.muted}
                                                />
                                            </Pressable>
                                        </View>
                                    </View>

                                    <Pressable
                                        onPress={() => void handleSubmit()}
                                        disabled={submitDisabled}
                                        style={({ pressed }) => [
                                            styles.submitButton,
                                            pressed && styles.pressed,
                                            submitDisabled &&
                                                !formDisabled &&
                                                styles.submitIdle,
                                            formDisabled &&
                                                styles.disabledButton,
                                        ]}
                                        accessibilityRole="button"
                                        accessibilityLabel="Sign in to field app"
                                        accessibilityState={{
                                            disabled: submitDisabled,
                                            busy: isSubmitting,
                                        }}
                                        testID="login-submit-button"
                                    >
                                        {isSubmitting ? (
                                            <ActivityIndicator
                                                color={colors.text}
                                            />
                                        ) : (
                                            <Text
                                                style={[
                                                    styles.submitButtonText,
                                                    formDisabled &&
                                                        styles.disabledButtonText,
                                                ]}
                                            >
                                                Sign in
                                            </Text>
                                        )}
                                    </Pressable>
                                </View>
                            )}

                            <View style={styles.secureRow}>
                                <Icon
                                    name="shield-check"
                                    size={16}
                                    color={colors.greenDark}
                                />
                                <Text style={styles.secureText}>
                                    <Text style={styles.secureTitle}>
                                        Secure access
                                    </Text>
                                    {' · Built for your field team and device.'}
                                </Text>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    flex: { flex: 1 },
    safeArea: { flex: 1, backgroundColor: colors.background },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 20,
        paddingVertical: 32,
    },
    // Pin to the top on phones so the hero meets the status bar instead of
    // floating in a centred column with empty bands above and below.
    mobileScrollContent: {
        justifyContent: 'flex-start',
        paddingHorizontal: 0,
        paddingTop: 0,
        paddingBottom: 0,
    },
    card: {
        width: '100%',
        maxWidth: 480,
        alignSelf: 'center',
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
    },
    mobileCard: {
        flexGrow: 1,
        maxWidth: '100%',
        backgroundColor: colors.background,
        borderRadius: 0,
        borderWidth: 0,
        overflow: 'visible',
    },
    hero: {
        aspectRatio: 3 / 2,
        width: '100%',
        backgroundColor: colors.surfaceMuted,
    },
    heroImage: { height: '100%', width: '100%' },
    content: { padding: 24 },
    // A rounded sheet that overlaps the hero softens the photo edge.
    mobileContent: {
        flexGrow: 1,
        backgroundColor: colors.background,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        marginTop: -24,
        paddingTop: 28,
        paddingBottom: 20,
    },
    header: { marginBottom: 28 },
    brandLockup: {
        marginBottom: 0,
    },
    wordmark: {
        fontSize: 30,
        fontWeight: '800',
        lineHeight: 38,
        letterSpacing: -0.6,
    },
    wordmarkDark: { color: colors.text },
    wordmarkAmber: { color: colors.amber },
    brandDescriptor: {
        color: colors.muted,
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.8,
        marginTop: 4,
        textTransform: 'uppercase',
    },
    title: {
        color: colors.text,
        fontSize: 25,
        fontWeight: '800',
        lineHeight: 32,
    },
    subtitle: {
        color: colors.secondary,
        fontSize: 15,
        lineHeight: 22,
        marginTop: 8,
    },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.redSoft,
        borderWidth: 1,
        borderColor: colors.redBorder,
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
    },
    errorIcon: {
        marginRight: 8,
    },
    errorText: {
        flex: 1,
        color: colors.redDark,
        fontSize: 14,
        lineHeight: 20,
    },
    iconButton: {
        minWidth: 48,
        minHeight: 48,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 4,
    },
    suspendedBanner: {
        backgroundColor: colors.redSoft,
        borderColor: colors.redBorder,
        borderRadius: 12,
        borderWidth: 1,
        padding: 14,
        marginBottom: 16,
    },
    suspendedTitle: {
        color: colors.redDark,
        fontWeight: '800',
        fontSize: 15,
    },
    suspendedText: {
        color: colors.redDark,
        fontSize: 14,
        lineHeight: 20,
        marginTop: 4,
    },
    revocationBanner: {
        backgroundColor: colors.warningSoft,
        borderWidth: 1,
        borderColor: colors.warningBorder,
        borderRadius: 12,
        padding: 14,
        marginBottom: 16,
    },
    revocationTitle: {
        color: colors.warningDark,
        fontWeight: '800',
        fontSize: 15,
    },
    revocationText: {
        color: colors.warningDark,
        fontSize: 14,
        lineHeight: 20,
        marginTop: 4,
    },
    retryButton: {
        minHeight: 48,
        borderRadius: 8,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
    },
    retryButtonText: { color: colors.text, fontSize: 15, fontWeight: '700' },
    form: { gap: 18 },
    fieldGroup: { gap: 8 },
    label: { color: colors.text, fontSize: 14, fontWeight: '700' },
    input: {
        minHeight: 52,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        borderRadius: 12,
        backgroundColor: colors.surface,
        color: colors.text,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
    },
    // Focus keeps a 1px border and swaps colour plus a soft ring, so the
    // text inside the field does not shift by a pixel on focus.
    inputFocused: {
        borderColor: colors.primaryBorder,
        boxShadow: '0 0 0 3px rgba(255, 191, 0, 0.25)',
    },
    inputDisabled: {
        backgroundColor: colors.surfaceMuted,
    },
    inputShell: {
        minHeight: 52,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        borderRadius: 12,
        backgroundColor: colors.surface,
        flexDirection: 'row',
        alignItems: 'center',
    },
    inputIcon: {
        paddingLeft: 14,
        paddingRight: 2,
    },
    inputInShell: {
        flex: 1,
        minHeight: 52,
        color: colors.text,
        paddingLeft: 10,
        paddingRight: 4,
        paddingVertical: 12,
        fontSize: 16,
    },
    passwordToggle: {
        minHeight: 52,
        minWidth: 52,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
    },
    submitButton: {
        minHeight: 54,
        borderRadius: 12,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 6,
    },
    // Still gold, but visibly waiting until both fields are filled.
    submitIdle: { opacity: 0.45 },
    submitButtonText: { color: colors.text, fontSize: 16, fontWeight: '800' },
    secureRow: {
        alignItems: 'center',
        alignSelf: 'center',
        flexDirection: 'row',
        gap: 6,
        marginTop: 'auto',
        paddingTop: 28,
    },
    secureTitle: {
        color: colors.text,
        fontWeight: '700',
    },
    secureText: {
        color: colors.muted,
        fontSize: 12,
        lineHeight: 17,
    },
    disabledButton: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderWidth: 1,
        opacity: 1,
    },
    disabledButtonText: { color: colors.muted },
    pressed: { opacity: 0.8 },
    challengeHeader: {
        marginBottom: 8,
    },
    challengeTitle: {
        color: colors.text,
        fontSize: 18,
        fontWeight: '800',
    },
    challengeText: {
        color: colors.secondary,
        fontSize: 14,
        lineHeight: 20,
        marginTop: 6,
    },
    boldEmail: {
        fontWeight: '700',
        color: colors.text,
    },
    codeInput: {
        fontSize: 22,
        letterSpacing: 6,
        textAlign: 'center',
        fontWeight: '700',
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        paddingVertical: 6,
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
    },
    checkboxChecked: {
        backgroundColor: colors.primary,
        borderColor: colors.primaryBorder,
    },
    checkmark: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '800',
        lineHeight: 16,
    },
    checkboxLabelContainer: {
        flex: 1,
    },
    checkboxLabel: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '600',
    },
    checkboxSubtext: {
        color: colors.muted,
        fontSize: 12,
        marginTop: 2,
    },
    challengeActionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
    },
    textAction: {
        minHeight: 44,
        justifyContent: 'center',
    },
    textActionLabel: {
        color: colors.amber,
        fontSize: 14,
        fontWeight: '700',
    },
    disabledText: {
        color: colors.muted,
    },
});
