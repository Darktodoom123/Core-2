import React, { useEffect, useState } from 'react';
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

                        <View style={styles.content}>
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
                                    <Text
                                        style={styles.errorIcon}
                                        accessibilityLabel="Warning"
                                    >
                                        !
                                    </Text>
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
                                        <Text style={styles.iconButtonText}>
                                            ×
                                        </Text>
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
                                                color={colors.white}
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
                                                color={colors.white}
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
                                        <TextInput
                                            value={username}
                                            onChangeText={setUsername}
                                            placeholder="your.username"
                                            placeholderTextColor={colors.muted}
                                            keyboardType="default"
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                            textContentType="username"
                                            editable={!formDisabled}
                                            style={[
                                                styles.input,
                                                focusedField === 'username' &&
                                                    styles.inputFocused,
                                            ]}
                                            onFocus={() =>
                                                setFocusedField('username')
                                            }
                                            onBlur={() => setFocusedField(null)}
                                            accessibilityLabel="Username"
                                            accessibilityHint="Enter your work username"
                                            returnKeyType="next"
                                            testID="login-username-input"
                                        />
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
                                            ]}
                                        >
                                            <TextInput
                                                value={password}
                                                onChangeText={setPassword}
                                                placeholder="Your password"
                                                placeholderTextColor={
                                                    colors.muted
                                                }
                                                secureTextEntry={
                                                    !isPasswordVisible
                                                }
                                                autoCapitalize="none"
                                                autoCorrect={false}
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
                                                <Text
                                                    style={
                                                        styles.passwordToggleText
                                                    }
                                                >
                                                    {isPasswordVisible
                                                        ? 'Hide'
                                                        : 'Show'}
                                                </Text>
                                            </Pressable>
                                        </View>
                                    </View>

                                    <Pressable
                                        onPress={() => void handleSubmit()}
                                        disabled={submitDisabled}
                                        style={({ pressed }) => [
                                            styles.submitButton,
                                            pressed && styles.pressed,
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
                                                color={colors.white}
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

                                    <View style={styles.secureRow}>
                                        <Text style={styles.secureIcon}>✓</Text>
                                        <View style={styles.secureCopy}>
                                            <Text style={styles.secureTitle}>
                                                Secure access
                                            </Text>
                                            <Text style={styles.secureText}>
                                                Built for your field team and
                                                device.
                                            </Text>
                                        </View>
                                    </View>

                                    {__DEV__ ? (
                                        <View
                                            style={styles.devSection}
                                            testID="dev-quick-login-section"
                                        >
                                            <Text style={styles.devTitle}>
                                                Dev Quick Sign-In
                                            </Text>
                                            <View style={styles.devButtons}>
                                                <Pressable
                                                    onPress={() => {
                                                        setUsername('driver');
                                                        setPassword('password');
                                                    }}
                                                    disabled={formDisabled}
                                                    style={({ pressed }) => [
                                                        styles.devButton,
                                                        pressed &&
                                                            styles.pressed,
                                                        formDisabled &&
                                                            styles.disabledButton,
                                                    ]}
                                                    accessibilityRole="button"
                                                    accessibilityLabel="Fill Driver dev credentials"
                                                    testID="dev-login-driver"
                                                >
                                                    <Text
                                                        style={
                                                            styles.devButtonText
                                                        }
                                                    >
                                                        Driver
                                                    </Text>
                                                </Pressable>

                                                <Pressable
                                                    onPress={() => {
                                                        setUsername('operator');
                                                        setPassword('password');
                                                    }}
                                                    disabled={formDisabled}
                                                    style={({ pressed }) => [
                                                        styles.devButton,
                                                        pressed &&
                                                            styles.pressed,
                                                        formDisabled &&
                                                            styles.disabledButton,
                                                    ]}
                                                    accessibilityRole="button"
                                                    accessibilityLabel="Fill Operator dev credentials"
                                                    testID="dev-login-operator"
                                                >
                                                    <Text
                                                        style={
                                                            styles.devButtonText
                                                        }
                                                    >
                                                        Operator
                                                    </Text>
                                                </Pressable>
                                            </View>
                                        </View>
                                    ) : null}
                                </View>
                            )}
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
    mobileScrollContent: {
        paddingHorizontal: 0,
        paddingTop: 0,
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
    header: { marginBottom: 24 },
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
        width: 24,
        height: 24,
        borderRadius: 12,
        color: colors.white,
        backgroundColor: colors.red,
        textAlign: 'center',
        lineHeight: 24,
        fontWeight: '800',
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
    iconButtonText: { color: colors.redDark, fontSize: 28, lineHeight: 32 },
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
    form: { gap: 16 },
    fieldGroup: { gap: 8 },
    label: { color: colors.text, fontSize: 15, fontWeight: '700' },
    input: {
        minHeight: 48,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        borderRadius: 8,
        backgroundColor: colors.surface,
        color: colors.text,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
    },
    inputFocused: {
        borderColor: colors.primaryBorder,
        borderWidth: 2,
    },
    inputShell: {
        minHeight: 48,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        borderRadius: 8,
        backgroundColor: colors.surface,
        flexDirection: 'row',
        alignItems: 'center',
    },
    inputInShell: {
        flex: 1,
        minHeight: 48,
        color: colors.text,
        paddingLeft: 14,
        paddingRight: 4,
        paddingVertical: 12,
        fontSize: 16,
    },
    passwordToggle: {
        minHeight: 48,
        minWidth: 64,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
    },
    passwordToggleText: {
        color: colors.amber,
        fontSize: 14,
        fontWeight: '800',
    },
    submitButton: {
        minHeight: 48,
        borderRadius: 8,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 4,
    },
    submitButtonText: { color: colors.text, fontSize: 16, fontWeight: '700' },
    secureRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 10,
        marginTop: 2,
    },
    secureIcon: {
        alignItems: 'center',
        backgroundColor: colors.greenSoft,
        borderRadius: 12,
        color: colors.greenDark,
        fontSize: 14,
        fontWeight: '800',
        height: 24,
        lineHeight: 24,
        textAlign: 'center',
        width: 24,
    },
    secureCopy: { flex: 1 },
    secureTitle: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '800',
    },
    secureText: {
        color: colors.muted,
        fontSize: 12,
        lineHeight: 17,
        marginTop: 2,
    },
    disabledButton: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderWidth: 1,
        opacity: 1,
    },
    disabledButtonText: { color: colors.muted },
    pressed: { opacity: 0.8 },
    devSection: {
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: 16,
        marginTop: 4,
    },
    devTitle: {
        color: colors.muted,
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        marginBottom: 10,
    },
    devButtons: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    devButton: {
        flexGrow: 1,
        flexBasis: 96,
        minHeight: 48,
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
    },
    devButtonText: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '600',
    },
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
