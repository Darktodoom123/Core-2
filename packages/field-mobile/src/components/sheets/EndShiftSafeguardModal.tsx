import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { Icon } from '../common/Icon';
import { shadows } from '../nativeStyles';

export interface EndShiftSafeguardModalProps {
    visible: boolean;
    assetCode?: string;
    onConfirmReleaseAndClockOut: () => void;
    onCancel: () => void;
}

export const EndShiftSafeguardModal: React.FC<EndShiftSafeguardModalProps> = ({
    visible,
    assetCode = 'CRN-101',
    onConfirmReleaseAndClockOut,
    onCancel,
}) => {
    const { isDarkHud } = useTheme();

    return (
        <Modal
            animationType="fade"
            onRequestClose={onCancel}
            transparent
            visible={visible}
        >
            <View style={styles.overlay} testID="end-shift-safeguard-modal">
                <View style={[styles.dialog, isDarkHud && styles.darkDialog]}>
                    {/* Ambient Amber Warning Badge */}
                    <View
                        style={[
                            styles.iconBadge,
                            isDarkHud && styles.darkIconBadge,
                        ]}
                    >
                        <Icon
                            color={isDarkHud ? '#F59E0B' : '#D97706'}
                            name="alert-circle"
                            size={32}
                        />
                    </View>

                    {/* Header */}
                    <Text
                        accessibilityRole="header"
                        style={[styles.title, isDarkHud && styles.darkTitle]}
                    >
                        Active Equipment Warning
                    </Text>

                    {/* Safeguard Prompt */}
                    <Text
                        style={[
                            styles.promptText,
                            isDarkHud && styles.darkPromptText,
                        ]}
                    >
                        You are still linked to{' '}
                        <Text
                            style={[
                                styles.assetHighlight,
                                isDarkHud && styles.darkAssetHighlight,
                            ]}
                        >
                            {assetCode}
                        </Text>
                        . Release unit and turn off tracking?
                    </Text>

                    {/* Warm Helper Guidance Card */}
                    <View
                        style={[
                            styles.guardrailContainer,
                            isDarkHud && styles.darkGuardrailContainer,
                        ]}
                    >
                        <View style={styles.guardrailIcon}>
                            <Icon
                                color={isDarkHud ? '#94A3B8' : '#64748B'}
                                name="shield-check"
                                size={16}
                            />
                        </View>
                        <Text
                            style={[
                                styles.guardrailNotice,
                                isDarkHud && styles.darkGuardrailNotice,
                            ]}
                        >
                            Releasing automatically closes your equipment
                            telemetry proxy and makes {assetCode} available for
                            relief crews or the central dispatch depot.
                        </Text>
                    </View>

                    {/* Ergonomic Action Buttons */}
                    <View style={styles.actionRow}>
                        <Pressable
                            accessibilityLabel="Cancel clock out"
                            accessibilityRole="button"
                            onPress={onCancel}
                            style={({ pressed }) => [
                                styles.cancelButton,
                                isDarkHud && styles.darkCancelButton,
                                pressed && styles.buttonPressed,
                            ]}
                            testID="cancel-safeguard-btn"
                        >
                            <Text
                                style={[
                                    styles.cancelButtonText,
                                    isDarkHud && styles.darkCancelButtonText,
                                ]}
                            >
                                Cancel
                            </Text>
                        </Pressable>

                        <Pressable
                            accessibilityLabel="Confirm release unit and clock out"
                            accessibilityRole="button"
                            onPress={onConfirmReleaseAndClockOut}
                            style={({ pressed }) => [
                                styles.confirmButton,
                                isDarkHud && styles.darkConfirmButton,
                                pressed && styles.buttonPressed,
                            ]}
                            testID="confirm-safeguard-btn"
                        >
                            <Text
                                style={[
                                    styles.confirmButtonText,
                                    isDarkHud && styles.darkConfirmButtonText,
                                ]}
                            >
                                Confirm &amp; Release
                            </Text>
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
        padding: 24,
    },
    dialog: {
        width: '100%',
        maxWidth: 390,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        paddingHorizontal: 24,
        paddingTop: 28,
        paddingBottom: 24,
        alignItems: 'center',
        ...shadows.lg,
    },
    darkDialog: {
        backgroundColor: '#1E293B',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        shadowColor: '#000000',
        shadowOpacity: 0.5,
        shadowRadius: 16,
    },
    iconBadge: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#FEF3C7',
        borderColor: 'rgba(217, 119, 6, 0.25)',
        borderWidth: 1.5,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 18,
    },
    darkIconBadge: {
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        borderColor: 'rgba(245, 158, 11, 0.35)',
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
        letterSpacing: -0.3,
        color: '#0F172A',
        marginBottom: 10,
        textAlign: 'center',
    },
    darkTitle: {
        color: '#F8FAFC',
    },
    promptText: {
        fontSize: 15,
        lineHeight: 22,
        color: '#475569',
        textAlign: 'center',
        marginBottom: 16,
        paddingHorizontal: 6,
    },
    darkPromptText: {
        color: '#94A3B8',
    },
    assetHighlight: {
        fontWeight: '800',
        color: '#D97706',
    },
    darkAssetHighlight: {
        color: '#FBBF24',
    },
    guardrailContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#F8FAFC',
        borderColor: '#E2E8F0',
        borderWidth: 1,
        borderRadius: 14,
        padding: 12,
        marginBottom: 24,
        width: '100%',
        gap: 10,
    },
    darkGuardrailContainer: {
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        borderColor: '#334155',
    },
    guardrailIcon: {
        marginTop: 2,
    },
    guardrailNotice: {
        flex: 1,
        fontSize: 12.5,
        lineHeight: 18,
        color: '#64748B',
    },
    darkGuardrailNotice: {
        color: '#94A3B8',
    },
    actionRow: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    cancelButton: {
        flex: 1,
        height: 48,
        borderRadius: 14,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    darkCancelButton: {
        backgroundColor: '#334155',
        borderColor: '#475569',
    },
    cancelButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#475569',
    },
    darkCancelButtonText: {
        color: '#F1F5F9',
    },
    confirmButton: {
        flex: 1.4,
        height: 48,
        borderRadius: 14,
        backgroundColor: '#D97706',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 2,
        shadowColor: '#D97706',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    darkConfirmButton: {
        backgroundColor: '#F59E0B',
        shadowColor: '#F59E0B',
    },
    confirmButtonText: {
        fontSize: 15,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    darkConfirmButtonText: {
        color: '#090D16',
    },
    buttonPressed: {
        opacity: 0.85,
        transform: [{ scale: 0.98 }],
    },
});
