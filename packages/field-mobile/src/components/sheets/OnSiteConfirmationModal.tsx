import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { Icon } from '../common/Icon';
import { shadows } from '../nativeStyles';

export interface OnSiteConfirmationModalProps {
    visible: boolean;
    assetCode?: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export const OnSiteConfirmationModal: React.FC<
    OnSiteConfirmationModalProps
> = ({ visible, assetCode = 'CRN-101', onConfirm, onCancel }) => {
    const { isDarkHud } = useTheme();

    return (
        <Modal
            animationType="fade"
            onRequestClose={onCancel}
            transparent
            visible={visible}
        >
            <View style={styles.overlay} testID="on-site-confirmation-modal">
                <View style={[styles.dialog, isDarkHud && styles.darkDialog]}>
                    {/* Icon Badge */}
                    <View
                        style={[
                            styles.iconBadge,
                            isDarkHud && styles.darkIconBadge,
                        ]}
                    >
                        <Icon
                            color={isDarkHud ? '#34D399' : '#059669'}
                            name="location"
                            size={28}
                        />
                    </View>

                    {/* Header */}
                    <Text
                        accessibilityRole="header"
                        style={[styles.title, isDarkHud && styles.darkTitle]}
                    >
                        Confirm Physical Arrival
                    </Text>

                    {/* PRD Specified Verification Prompt */}
                    <Text
                        style={[
                            styles.promptText,
                            isDarkHud && styles.darkPromptText,
                        ]}
                    >
                        Are you physically at Unit{' '}
                        <Text style={styles.assetHighlight}>{assetCode}</Text>?
                        Live GPS broadcasting will begin immediately.
                    </Text>

                    <Text
                        style={[
                            styles.privacyNotice,
                            isDarkHud && styles.darkPrivacyNotice,
                        ]}
                    >
                        Personal coordinates remain private during your commute.
                        Telemetry only binds to heavy equipment once on site.
                    </Text>

                    {/* Action Buttons */}
                    <View style={styles.actionRow}>
                        <Pressable
                            accessibilityLabel="Cancel on site confirmation"
                            accessibilityRole="button"
                            onPress={onCancel}
                            style={[
                                styles.cancelButton,
                                isDarkHud && styles.darkCancelButton,
                            ]}
                            testID="cancel-on-site-btn"
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
                            accessibilityLabel="Confirm on-site and start unit"
                            accessibilityRole="button"
                            onPress={onConfirm}
                            style={[
                                styles.confirmButton,
                                isDarkHud && styles.darkConfirmButton,
                            ]}
                            testID="confirm-on-site-btn"
                        >
                            <Text style={styles.confirmButtonText}>
                                Confirm On-Site
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
        backgroundColor: '#ECFDF5',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    darkIconBadge: {
        backgroundColor: '#064E3B',
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
        color: '#059669',
    },
    privacyNotice: {
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
    darkPrivacyNotice: {
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
        flex: 1.3,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#059669',
        alignItems: 'center',
        justifyContent: 'center',
    },
    darkConfirmButton: {
        backgroundColor: '#10B981',
    },
    confirmButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});
