import React, { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from './AuthContext';

export interface LoginScreenProps {
    onLoginSuccess?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
    const { login, logout, error, clearError, status, hasPendingRevocation } =
        useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [deviceName, setDeviceName] = useState('Field Mobile Device');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isRetryingRevocation, setIsRetryingRevocation] = useState(false);

    const handleSubmit = async () => {
        if (!email.trim() || !password.trim() || isSubmitting) {
            return;
        }

        setIsSubmitting(true);

        try {
            await login(email.trim(), password, deviceName.trim() || undefined);

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
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    testID="login-screen"
                >
                    <View style={styles.card}>
                        <View style={styles.header}>
                            <Text style={styles.badge}>Core 2 Field App</Text>
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
                                <Text style={styles.errorText}>{error}</Text>
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
                                <Text style={styles.revocationText}>
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
                                            color={colors.white}
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

                            <View style={styles.fieldGroup}>
                                <Text style={styles.label}>
                                    Device identification
                                </Text>
                                <TextInput
                                    value={deviceName}
                                    onChangeText={setDeviceName}
                                    placeholder="e.g. Field Tablet 4"
                                    placeholderTextColor={colors.muted}
                                    autoCapitalize="words"
                                    editable={!formDisabled}
                                    style={styles.input}
                                    accessibilityLabel="Device identification"
                                    accessibilityHint="Optional name used to identify this device"
                                    returnKeyType="done"
                                    testID="login-device-input"
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
                                    <ActivityIndicator color={colors.white} />
                                ) : (
                                    <Text style={styles.submitButtonText}>
                                        Sign in
                                    </Text>
                                )}
                            </Pressable>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const colors = {
    background: '#0f172a',
    surface: '#1e293b',
    input: '#111827',
    border: '#475569',
    text: '#f8fafc',
    secondary: '#cbd5e1',
    muted: '#94a3b8',
    amber: '#d97706',
    red: '#991b1b',
    redText: '#fecaca',
    white: '#ffffff',
};

const styles = StyleSheet.create({
    flex: { flex: 1 },
    safeArea: { flex: 1, backgroundColor: colors.background },
    scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
    card: {
        width: '100%',
        maxWidth: 520,
        alignSelf: 'center',
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 24,
        borderWidth: 1,
        borderColor: '#334155',
    },
    header: { alignItems: 'center', marginBottom: 24 },
    badge: {
        color: colors.white,
        backgroundColor: colors.amber,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.8,
        marginBottom: 14,
    },
    title: {
        color: colors.text,
        fontSize: 26,
        fontWeight: '700',
        textAlign: 'center',
    },
    subtitle: {
        color: colors.secondary,
        fontSize: 16,
        lineHeight: 23,
        textAlign: 'center',
        marginTop: 8,
    },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#7f1d1d',
        borderWidth: 1,
        borderColor: '#b91c1c',
        borderRadius: 10,
        padding: 12,
        marginBottom: 16,
    },
    errorIcon: {
        width: 24,
        height: 24,
        borderRadius: 12,
        color: colors.white,
        backgroundColor: '#b91c1c',
        textAlign: 'center',
        lineHeight: 24,
        fontWeight: '800',
        marginRight: 8,
    },
    errorText: { flex: 1, color: colors.redText, fontSize: 14, lineHeight: 20 },
    iconButton: {
        minWidth: 48,
        minHeight: 48,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 4,
    },
    iconButtonText: { color: colors.redText, fontSize: 28, lineHeight: 32 },
    suspendedBanner: {
        backgroundColor: colors.red,
        borderRadius: 10,
        padding: 14,
        marginBottom: 16,
    },
    suspendedTitle: { color: colors.white, fontWeight: '700', fontSize: 15 },
    suspendedText: {
        color: colors.white,
        fontSize: 14,
        lineHeight: 20,
        marginTop: 4,
    },
    revocationBanner: {
        backgroundColor: '#78350f',
        borderWidth: 1,
        borderColor: '#d97706',
        borderRadius: 10,
        padding: 14,
        marginBottom: 16,
    },
    revocationTitle: { color: colors.white, fontWeight: '700', fontSize: 15 },
    revocationText: {
        color: '#fef3c7',
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
    label: { color: colors.secondary, fontSize: 15, fontWeight: '600' },
    input: {
        minHeight: 48,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        backgroundColor: colors.input,
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
    disabledButton: { opacity: 0.55 },
    pressed: { opacity: 0.8 },
});
