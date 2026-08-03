import React, { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../components/nativeStyles';
import { useAuth } from './AuthContext';

export interface LoginScreenProps {
    onLoginSuccess?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
    const { login, logout, error, clearError, status, hasPendingRevocation } =
        useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isRetryingRevocation, setIsRetryingRevocation] = useState(false);

    const handleSubmit = async () => {
        if (!email.trim() || !password.trim() || isSubmitting) {
            return;
        }

        setIsSubmitting(true);

        try {
            await login(email.trim(), password);

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
    const submitDisabled = formDisabled || !email.trim() || !password.trim();

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar
                barStyle="dark-content"
                backgroundColor={colors.background}
            />
            <KeyboardAvoidingView style={styles.flex}>
                <ScrollView
                    contentInsetAdjustmentBehavior="automatic"
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    testID="login-screen"
                >
                    <View style={styles.card}>
                        <View style={styles.header}>
                            <View style={styles.brandLockup}>
                                <View style={styles.brandMark} />
                                <Text style={styles.badge}>
                                    Core 2 Field App
                                </Text>
                            </View>
                            <Text
                                style={styles.title}
                                accessibilityRole="header"
                            >
                                Sign in to your account
                            </Text>
                            <Text style={styles.subtitle}>
                                Access assigned field jobs and equipment
                                dispatches.
                            </Text>
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
                                    <Text style={styles.iconButtonText}>×</Text>
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
                                    Contact a system administrator to restore
                                    field access.
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
                                <Text selectable style={styles.revocationText}>
                                    This device is locked out until the server
                                    confirms that the previous token cannot be
                                    reused.
                                </Text>
                                <Pressable
                                    onPress={() => void handleRetryRevocation()}
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
                                            color={colors.amber}
                                        />
                                    ) : (
                                        <Text style={styles.retryButtonText}>
                                            Retry secure sign out
                                        </Text>
                                    )}
                                </Pressable>
                            </View>
                        ) : null}

                        <View style={styles.form}>
                            <View style={styles.fieldGroup}>
                                <Text style={styles.label}>Email address</Text>
                                <TextInput
                                    value={email}
                                    onChangeText={setEmail}
                                    placeholder="worker@example.com"
                                    placeholderTextColor={colors.muted}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    textContentType="emailAddress"
                                    editable={!formDisabled}
                                    style={styles.input}
                                    accessibilityLabel="Email address"
                                    accessibilityHint="Enter your verified work email"
                                    returnKeyType="next"
                                    testID="login-email-input"
                                />
                            </View>

                            <View style={styles.fieldGroup}>
                                <Text style={styles.label}>Password</Text>
                                <TextInput
                                    value={password}
                                    onChangeText={setPassword}
                                    placeholder="Your password"
                                    placeholderTextColor={colors.muted}
                                    secureTextEntry
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    textContentType="password"
                                    editable={!formDisabled}
                                    style={styles.input}
                                    accessibilityLabel="Password"
                                    returnKeyType="go"
                                    onSubmitEditing={() => void handleSubmit()}
                                    testID="login-password-input"
                                />
                            </View>

                            <Pressable
                                onPress={() => void handleSubmit()}
                                disabled={submitDisabled}
                                style={({ pressed }) => [
                                    styles.submitButton,
                                    pressed && styles.pressed,
                                    submitDisabled && styles.disabledButton,
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
                                    <ActivityIndicator color={colors.amber} />
                                ) : (
                                    <Text
                                        style={[
                                            styles.submitButtonText,
                                            submitDisabled &&
                                                styles.disabledButtonText,
                                        ]}
                                    >
                                        Sign in
                                    </Text>
                                )}
                            </Pressable>

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
                                                setEmail('driver@example.com');
                                                setPassword('password');
                                            }}
                                            disabled={formDisabled}
                                            style={({ pressed }) => [
                                                styles.devButton,
                                                pressed && styles.pressed,
                                                formDisabled &&
                                                    styles.disabledButton,
                                            ]}
                                            accessibilityRole="button"
                                            accessibilityLabel="Fill Driver dev credentials"
                                            testID="dev-login-driver"
                                        >
                                            <Text style={styles.devButtonText}>
                                                Driver
                                            </Text>
                                        </Pressable>

                                        <Pressable
                                            onPress={() => {
                                                setEmail(
                                                    'technician@example.com',
                                                );
                                                setPassword('password');
                                            }}
                                            disabled={formDisabled}
                                            style={({ pressed }) => [
                                                styles.devButton,
                                                pressed && styles.pressed,
                                                formDisabled &&
                                                    styles.disabledButton,
                                            ]}
                                            accessibilityRole="button"
                                            accessibilityLabel="Fill Technician dev credentials"
                                            testID="dev-login-technician"
                                        >
                                            <Text style={styles.devButtonText}>
                                                Technician
                                            </Text>
                                        </Pressable>

                                        <Pressable
                                            onPress={() => {
                                                setEmail(
                                                    'operator@example.com',
                                                );
                                                setPassword('password');
                                            }}
                                            disabled={formDisabled}
                                            style={({ pressed }) => [
                                                styles.devButton,
                                                pressed && styles.pressed,
                                                formDisabled &&
                                                    styles.disabledButton,
                                            ]}
                                            accessibilityRole="button"
                                            accessibilityLabel="Fill Operator dev credentials"
                                            testID="dev-login-operator"
                                        >
                                            <Text style={styles.devButtonText}>
                                                Operator
                                            </Text>
                                        </Pressable>
                                    </View>
                                </View>
                            ) : null}
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
    card: {
        width: '100%',
        maxWidth: 480,
        alignSelf: 'center',
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 24,
        borderWidth: 1,
        borderColor: colors.border,
    },
    header: { marginBottom: 24 },
    brandLockup: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 10,
        marginBottom: 24,
    },
    brandMark: {
        backgroundColor: colors.amber,
        borderRadius: 3,
        height: 28,
        width: 8,
    },
    badge: {
        color: colors.amberDark,
        fontSize: 15,
        fontWeight: '800',
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
        backgroundColor: colors.amber,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
    },
    retryButtonText: { color: colors.white, fontSize: 15, fontWeight: '700' },
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
    submitButton: {
        minHeight: 48,
        borderRadius: 8,
        backgroundColor: colors.amber,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 4,
    },
    submitButtonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
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
        gap: 8,
    },
    devButton: {
        flex: 1,
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
});
