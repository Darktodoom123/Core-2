import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { Icon } from '../common/Icon';
import { shadows } from '../nativeStyles';

export interface PreTripDefectFallbackModalProps {
    visible: boolean;
    assetCode?: string;
    onSwapUnit: () => void;
    onStandby: () => void;
    onClose?: () => void;
}

export const PreTripDefectFallbackModal: React.FC<
    PreTripDefectFallbackModalProps
> = ({ visible, assetCode = 'CRN-101', onSwapUnit, onStandby, onClose }) => {
    const { isDarkHud } = useTheme();

    return (
        <Modal
            animationType="fade"
            onRequestClose={onClose || onStandby}
            transparent
            visible={visible}
        >
            <View
                style={styles.overlay}
                testID="pre-trip-defect-fallback-modal"
            >
                <View style={[styles.dialog, isDarkHud && styles.darkDialog]}>
                    {/* Danger Lockout Badge */}
                    <View
                        style={[
                            styles.iconBadge,
                            isDarkHud && styles.darkIconBadge,
                        ]}
                    >
                        <Icon
                            color={isDarkHud ? '#EF4444' : '#DC2626'}
                            name="alert"
                            size={32}
                        />
                    </View>

                    {/* Status Pill */}
                    <View
                        style={[
                            styles.statusPill,
                            isDarkHud && styles.darkStatusPill,
                        ]}
                    >
                        <Text
                            style={[
                                styles.statusPillText,
                                isDarkHud && styles.darkStatusPillText,
                            ]}
                        >
                            SAFETY LOCKOUT · UnderMaintenance
                        </Text>
                    </View>

                    {/* Title */}
                    <Text
                        accessibilityRole="header"
                        style={[styles.title, isDarkHud && styles.darkTitle]}
                    >
                        Pre-Trip Safety Lockout
                    </Text>

                    {/* Operational Context */}
                    <Text
                        style={[
                            styles.promptText,
                            isDarkHud && styles.darkPromptText,
                        ]}
                    >
                        Unit{' '}
                        <Text
                            style={[
                                styles.assetHighlight,
                                isDarkHud && styles.darkAssetHighlight,
                            ]}
                        >
                            {assetCode}
                        </Text>{' '}
                        has failed pre-trip inspection due to critical defects.
                        Dispatch is blocked and phone telemetry has been
                        automatically unbound from this unit.
                    </Text>

                    {/* HoS Guardrail Card */}
                    <View
                        style={[
                            styles.hosNoticeCard,
                            isDarkHud && styles.darkHosNoticeCard,
                        ]}
                    >
                        <Icon
                            color={isDarkHud ? '#10B981' : '#059669'}
                            name="clock"
                            size={16}
                        />
                        <Text
                            style={[
                                styles.hosNoticeText,
                                isDarkHud && styles.darkHosNoticeText,
                            ]}
                        >
                            You remain clocked in{' '}
                            <Text style={styles.boldText}>On Duty</Text> on
                            Hours of Service.
                        </Text>
                    </View>

                    {/* Operational Fallback Actions */}
                    <View style={styles.actionColumn}>
                        {/* Option A: Swap / Link Replacement Unit */}
                        <Pressable
                            accessibilityLabel="Swap or link replacement unit"
                            accessibilityRole="button"
                            onPress={onSwapUnit}
                            style={({ pressed }) => [
                                styles.swapButton,
                                isDarkHud && styles.darkSwapButton,
                                pressed && styles.pressed,
                            ]}
                            testID="fallback-swap-unit-btn"
                        >
                            <View style={styles.actionButtonContent}>
                                <Icon color="#FFFFFF" name="sync" size={18} />
                                <View style={styles.actionTextWrap}>
                                    <Text style={styles.swapButtonText}>
                                        Swap / Link Replacement Unit
                                    </Text>
                                    <Text style={styles.swapButtonSubtext}>
                                        Enter replacement unit (e.g. CRN-102) to
                                        start fresh pre-trip
                                    </Text>
                                </View>
                            </View>
                        </Pressable>

                        {/* Option B: Switch to Standby / Await Dispatch */}
                        <Pressable
                            accessibilityLabel="Switch to standby and await dispatch reassignment"
                            accessibilityRole="button"
                            onPress={onStandby}
                            style={({ pressed }) => [
                                styles.standbyButton,
                                isDarkHud && styles.darkStandbyButton,
                                pressed && styles.pressed,
                            ]}
                            testID="fallback-standby-btn"
                        >
                            <View style={styles.actionButtonContent}>
                                <Icon
                                    color={isDarkHud ? '#FFBF00' : '#806000'}
                                    name="clock"
                                    size={18}
                                />
                                <View style={styles.actionTextWrap}>
                                    <Text
                                        style={[
                                            styles.standbyButtonText,
                                            isDarkHud &&
                                                styles.darkStandbyButtonText,
                                        ]}
                                    >
                                        Switch to Standby / Await Dispatch
                                    </Text>
                                    <Text
                                        style={[
                                            styles.standbyButtonSubtext,
                                            isDarkHud &&
                                                styles.darkStandbyButtonSubtext,
                                        ]}
                                    >
                                        Keep On Duty while central dispatch
                                        reassigns orders
                                    </Text>
                                </View>
                            </View>
                        </Pressable>
                    </View>

                    {/* Optional Close Button */}
                    {onClose ? (
                        <Pressable
                            accessibilityLabel="Dismiss lockout modal"
                            accessibilityRole="button"
                            onPress={onClose}
                            style={styles.closeRow}
                            testID="close-fallback-modal-btn"
                        >
                            <Text
                                style={[
                                    styles.closeText,
                                    isDarkHud && styles.darkCloseText,
                                ]}
                            >
                                Dismiss
                            </Text>
                        </Pressable>
                    ) : null}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    dialog: {
        width: '100%',
        maxWidth: 440,
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
        backgroundColor: '#FEE2E2',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    darkIconBadge: {
        backgroundColor: '#451A1A',
    },
    statusPill: {
        backgroundColor: '#FEF2F2',
        borderColor: '#F87171',
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 4,
        marginBottom: 10,
    },
    darkStatusPill: {
        backgroundColor: '#3F1D1D',
        borderColor: '#991B1B',
    },
    statusPillText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#DC2626',
        letterSpacing: 0.5,
    },
    darkStatusPillText: {
        color: '#F87171',
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 8,
        textAlign: 'center',
    },
    darkTitle: {
        color: '#F8FAFC',
    },
    promptText: {
        fontSize: 14,
        lineHeight: 20,
        color: '#475569',
        textAlign: 'center',
        marginBottom: 14,
    },
    darkPromptText: {
        color: '#94A3B8',
    },
    assetHighlight: {
        fontWeight: '800',
        color: '#DC2626',
    },
    darkAssetHighlight: {
        color: '#F87171',
    },
    hosNoticeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        borderColor: '#A7F3D0',
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 18,
        width: '100%',
        gap: 8,
    },
    darkHosNoticeCard: {
        backgroundColor: '#064E3B25',
        borderColor: '#065F46',
    },
    hosNoticeText: {
        fontSize: 12,
        color: '#065F46',
        flex: 1,
    },
    darkHosNoticeText: {
        color: '#34D399',
    },
    boldText: {
        fontWeight: '700',
    },
    actionColumn: {
        width: '100%',
        gap: 12,
    },
    actionButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    actionTextWrap: {
        flex: 1,
    },
    swapButton: {
        backgroundColor: '#2563EB',
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 16,
        ...shadows.sm,
    },
    darkSwapButton: {
        backgroundColor: '#3B82F6',
    },
    swapButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
    },
    swapButtonSubtext: {
        color: '#BFDBFE',
        fontSize: 11,
        marginTop: 2,
    },
    standbyButton: {
        backgroundColor: '#FFF3C4',
        borderColor: '#FFBF00',
        borderWidth: 1.5,
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    darkStandbyButton: {
        backgroundColor: '#33280025',
        borderColor: '#FFBF00',
    },
    standbyButtonText: {
        color: '#806000',
        fontSize: 15,
        fontWeight: '700',
    },
    darkStandbyButtonText: {
        color: '#FFBF00',
    },
    standbyButtonSubtext: {
        color: '#806000',
        fontSize: 11,
        marginTop: 2,
    },
    darkStandbyButtonSubtext: {
        color: '#FFBF00',
    },
    closeRow: {
        marginTop: 14,
        paddingVertical: 6,
    },
    closeText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748B',
    },
    darkCloseText: {
        color: '#94A3B8',
    },
    pressed: {
        opacity: 0.85,
        transform: [{ scale: 0.99 }],
    },
});
