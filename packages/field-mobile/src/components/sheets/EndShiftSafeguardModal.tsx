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
                    {/* Warning Badge */}
                    <View
                        style={[
                            styles.iconBadge,
                            isDarkHud && styles.darkIconBadge,
                        ]}
                    >
                        <Icon
                            color={isDarkHud ? '#FBBF24' : '#D97706'}
                            name="alert-circle"
                            size={28}
                        />
                    </View>

                    {/* Header */}
                    <Text
                        accessibilityRole="header"
                        style={[styles.title, isDarkHud && styles.darkTitle]}
                    >
                        Active Equipment Warning
                    </Text>

                    {/* PRD Specified Safeguard Prompt */}
                    <Text
                        style={[
                            styles.promptText,
                            isDarkHud && styles.darkPromptText,
                        ]}
                    >
                        You are still linked to{' '}
                        <Text style={styles.assetHighlight}>{assetCode}</Text>.
                        Release unit and turn off tracking?
                    </Text>

                    <Text
                        style={[
                            styles.guardrailNotice,
                            isDarkHud && styles.darkGuardrailNotice,
                        ]}
                    >
                        Releasing automatically closes your equipment telemetry
                        proxy and makes {assetCode} available for relief crews
                        or the central dispatch depot.
                    </Text>

                    {/* Action Buttons */}
                    <View style={styles.actionRow}>
                        <Pressable
                            accessibilityLabel="Cancel clock out"
                            accessibilityRole="button"
                            onPress={onCancel}
                            style={[
                                styles.cancelButton,
                                isDarkHud && styles.darkCancelButton,
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
                            style={[
                                styles.confirmButton,
                                isDarkHud && styles.darkConfirmButton,
                            ]}
                            testID="confirm-safeguard-btn"
                        >
                            <Text style={styles.confirmButtonText}>
                                Confirm & Release
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
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    dialog: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        ...shadows.lg,
    },
    darkDialog: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
        borderWidth: 1,
    },
    iconBadge: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#FEF3C7',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    darkIconBadge: {
        backgroundColor: '#78350F',
    },
    title: {
        fontSize: 19,
        fontWeight: '700',
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
        color: '#64748B',
        textAlign: 'center',
        marginBottom: 12,
    },
    darkPromptText: {
        color: '#94A3B8',
    },
    assetHighlight: {
        fontWeight: '700',
        color: '#D97706',
    },
    guardrailNotice: {
        fontSize: 12,
        lineHeight: 17,
        color: '#64748B',
        textAlign: 'center',
        marginBottom: 24,
        backgroundColor: '#F8FAFC',
        padding: 10,
        borderRadius: 8,
        width: '100%',
    },
    darkGuardrailNotice: {
        backgroundColor: '#090D16',
        color: '#94A3B8',
    },
    actionRow: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    darkCancelButton: {
        borderColor: '#334155',
    },
    cancelButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#64748B',
    },
    darkCancelButtonText: {
        color: '#94A3B8',
    },
    confirmButton: {
        flex: 1.4,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#D97706',
        alignItems: 'center',
        justifyContent: 'center',
    },
    darkConfirmButton: {
        backgroundColor: '#F59E0B',
    },
    confirmButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});
