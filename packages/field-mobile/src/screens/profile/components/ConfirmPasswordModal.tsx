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
import { useTheme } from '../../../theme';

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
    const { isDarkHud } = useTheme();
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
                <View style={[styles.dialog, isDarkHud && styles.darkDialog]}>
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
                                        ? '#EF4444'
                                        : isDarkHud
                                          ? '#F59E0B'
                                          : '#D97706'
                                }
                                name="lock"
                                size={22}
                            />
                        </View>
                        <Text
                            accessibilityRole="header"
                            style={[
                                styles.title,
                                isDarkHud && styles.darkTitle,
                            ]}
                        >
                            {title}
                        </Text>
                    </View>

                    {description ? (
                        <Text
                            style={[
                                styles.description,
                                isDarkHud && styles.darkDescription,
                            ]}
                        >
                            {description}
                        </Text>
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
                                placeholderTextColor={
                                    isDarkHud ? '#64748B' : '#94A3B8'
                                }
                                secureTextEntry={!showPassword}
                                style={[
                                    styles.input,
                                    isDarkHud && styles.darkInput,
                                ]}
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
                                    color={isDarkHud ? '#94A3B8' : '#64748B'}
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
                                    color="#FFFFFF"
                                    size="small"
                                />
                            ) : (
                                <Text style={styles.submitBtnText}>
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

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
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
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
    },
    darkDialog: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
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
        backgroundColor: '#FEF3C7',
    },
    darkIconWrap: {
        backgroundColor: '#78350F',
    },
    iconWrapDanger: {
        backgroundColor: '#FEE2E2',
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
        flex: 1,
    },
    darkTitle: {
        color: '#F8FAFC',
    },
    description: {
        fontSize: 14,
        color: '#64748B',
        lineHeight: 20,
        marginBottom: 16,
    },
    darkDescription: {
        color: '#94A3B8',
    },
    inputContainer: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#334155',
        marginBottom: 6,
    },
    darkInputLabel: {
        color: '#CBD5E1',
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 48,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 10,
        paddingHorizontal: 12,
    },
    darkInputRow: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
    },
    inputRowError: {
        borderColor: '#EF4444',
    },
    input: {
        flex: 1,
        height: 48,
        fontSize: 15,
        color: '#0F172A',
    },
    darkInput: {
        color: '#F8FAFC',
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
        color: '#EF4444',
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
        backgroundColor: '#F1F5F9',
    },
    darkCancelBtn: {
        backgroundColor: '#334155',
    },
    cancelBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#475569',
    },
    darkCancelBtnText: {
        color: '#E2E8F0',
    },
    submitBtn: {
        minHeight: 48,
        paddingHorizontal: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    lightSubmitBtn: {
        backgroundColor: '#D97706',
    },
    darkSubmitBtn: {
        backgroundColor: '#F59E0B',
    },
    destructiveBtn: {
        backgroundColor: '#DC2626',
    },
    disabledBtn: {
        opacity: 0.5,
    },
    submitBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    pressed: {
        opacity: 0.75,
    },
});
