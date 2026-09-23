import React, { useState } from 'react';
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useTheme } from '../../theme';
import { Icon } from '../common/Icon';
import { shadows } from '../nativeStyles';

export interface ReliefHandoverModalProps {
    visible: boolean;
    mode?: 'outgoing_offer' | 'incoming_claim';
    assetCode?: string;
    reliefOperatorName?: string;
    handoverPin?: string;
    onInitiatePushHandover?: () => void;
    onClaimWithPin?: (pin: string) => void;
    onClaim1Tap?: () => void;
    onClose: () => void;
}

export const ReliefHandoverModal: React.FC<ReliefHandoverModalProps> = ({
    visible,
    mode = 'outgoing_offer',
    assetCode = 'CRN-101',
    reliefOperatorName = 'Carlos Reyes (Night Shift)',
    handoverPin = '8421',
    onInitiatePushHandover,
    onClaimWithPin,
    onClaim1Tap,
    onClose,
}) => {
    const { isDarkHud } = useTheme();
    const [enteredPin, setEnteredPin] = useState('');
    const [pushSent, setPushSent] = useState(false);

    const handleSendPush = () => {
        setPushSent(true);
        onInitiatePushHandover?.();
    };

    const handlePinSubmit = () => {
        if (enteredPin.trim().length === 4) {
            onClaimWithPin?.(enteredPin.trim());
        }
    };

    return (
        <Modal
            animationType="slide"
            onRequestClose={onClose}
            transparent
            visible={visible}
        >
            <View style={styles.overlay} testID="relief-handover-modal">
                <View style={[styles.dialog, isDarkHud && styles.darkDialog]}>
                    {/* Header with Close */}
                    <View style={styles.headerRow}>
                        <View style={styles.titleWrap}>
                            <View style={styles.badge}>
                                <Icon color="#2563EB" name="crane" size={14} />
                                <Text style={styles.badgeText}>
                                    {assetCode}
                                </Text>
                            </View>
                            <Text
                                accessibilityRole="header"
                                style={[
                                    styles.title,
                                    isDarkHud && styles.darkTitle,
                                ]}
                            >
                                {mode === 'outgoing_offer'
                                    ? 'Equipment Hot-Seat Handover'
                                    : 'Claim Equipment Handover'}
                            </Text>
                        </View>
                        <Pressable
                            accessibilityLabel="Close handover dialog"
                            accessibilityRole="button"
                            onPress={onClose}
                            style={styles.closeBtn}
                        >
                            <Icon
                                color={isDarkHud ? '#94A3B8' : '#64748B'}
                                name="chevron-right"
                                size={20}
                            />
                        </Pressable>
                    </View>

                    {mode === 'outgoing_offer' ? (
                        <>
                            {/* Option 1: 1-Tap Scheduled Relief Relay */}
                            <View
                                style={[
                                    styles.cardSection,
                                    isDarkHud && styles.darkCardSection,
                                ]}
                            >
                                <View style={styles.sectionHeader}>
                                    <View style={styles.methodNumber}>
                                        <Text style={styles.methodNumberText}>
                                            1
                                        </Text>
                                    </View>
                                    <Text
                                        style={[
                                            styles.sectionHeading,
                                            isDarkHud && styles.darkText,
                                        ]}
                                    >
                                        1-Tap Scheduled Relief Push
                                    </Text>
                                </View>

                                <Text
                                    style={[
                                        styles.reliefLabel,
                                        isDarkHud && styles.darkMuted,
                                    ]}
                                >
                                    Scheduled Relief Operator:
                                </Text>
                                <Text
                                    style={[
                                        styles.reliefName,
                                        isDarkHud && styles.darkText,
                                    ]}
                                >
                                    {reliefOperatorName}
                                </Text>

                                <Pressable
                                    accessibilityLabel="Send 1-tap handover request"
                                    accessibilityRole="button"
                                    onPress={handleSendPush}
                                    style={[
                                        styles.primaryButton,
                                        pushSent && styles.sentButton,
                                    ]}
                                    testID="send-push-handover-btn"
                                >
                                    <Icon
                                        color="#FFFFFF"
                                        name={
                                            pushSent
                                                ? 'check-circle'
                                                : 'chevron-right'
                                        }
                                        size={16}
                                    />
                                    <Text style={styles.primaryButtonText}>
                                        {pushSent
                                            ? 'Handover Alert Sent!'
                                            : 'Send 1-Tap Handover Alert'}
                                    </Text>
                                </Pressable>
                            </View>

                            {/* Option 2: 4-Digit PIN Fallback */}
                            <View
                                style={[
                                    styles.cardSection,
                                    isDarkHud && styles.darkCardSection,
                                ]}
                            >
                                <View style={styles.sectionHeader}>
                                    <View style={styles.methodNumber}>
                                        <Text style={styles.methodNumberText}>
                                            2
                                        </Text>
                                    </View>
                                    <Text
                                        style={[
                                            styles.sectionHeading,
                                            isDarkHud && styles.darkText,
                                        ]}
                                    >
                                        4-Digit PIN Fallback
                                    </Text>
                                </View>

                                <Text
                                    style={[
                                        styles.pinInstructions,
                                        isDarkHud && styles.darkMuted,
                                    ]}
                                >
                                    Share this PIN with your relief operator
                                    standing at the crane cab:
                                </Text>

                                {/* 4-Digit Box Display */}
                                <View style={styles.pinBoxes}>
                                    {handoverPin
                                        .slice(0, 4)
                                        .split('')
                                        .map((digit, idx) => (
                                            <View
                                                key={`pin-digit-${idx}`}
                                                style={[
                                                    styles.pinBox,
                                                    isDarkHud &&
                                                        styles.darkPinBox,
                                                ]}
                                            >
                                                <Text style={styles.pinDigit}>
                                                    {digit}
                                                </Text>
                                            </View>
                                        ))}
                                </View>
                            </View>

                            <Text
                                style={[
                                    styles.footerNotice,
                                    isDarkHud && styles.darkMuted,
                                ]}
                            >
                                Handover transfers the active GPS telemetry
                                stream atomically with zero coordinate drop on
                                the dispatch map.
                            </Text>
                        </>
                    ) : (
                        /* Incoming Claim Mode */
                        <>
                            <View
                                style={[
                                    styles.cardSection,
                                    isDarkHud && styles.darkCardSection,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.sectionHeading,
                                        isDarkHud && styles.darkText,
                                    ]}
                                >
                                    Accept Unit Takeover
                                </Text>
                                <Text
                                    style={[
                                        styles.pinInstructions,
                                        isDarkHud && styles.darkMuted,
                                    ]}
                                >
                                    Claim active operation of {assetCode}. Live
                                    telemetry will immediately bind to your
                                    mobile device.
                                </Text>

                                {onClaim1Tap ? (
                                    <Pressable
                                        accessibilityLabel="Accept 1-tap relief takeover"
                                        accessibilityRole="button"
                                        onPress={onClaim1Tap}
                                        style={styles.primaryButton}
                                        testID="claim-1tap-btn"
                                    >
                                        <Text style={styles.primaryButtonText}>
                                            Accept 1-Tap Takeover
                                        </Text>
                                    </Pressable>
                                ) : null}

                                <View style={styles.pinInputWrap}>
                                    <Text
                                        style={[
                                            styles.reliefLabel,
                                            isDarkHud && styles.darkMuted,
                                        ]}
                                    >
                                        Or Enter 4-Digit PIN from Outgoing
                                        Operator:
                                    </Text>
                                    <TextInput
                                        keyboardType="number-pad"
                                        maxLength={4}
                                        onChangeText={setEnteredPin}
                                        placeholder="0000"
                                        placeholderTextColor="#94A3B8"
                                        style={[
                                            styles.pinTextInput,
                                            isDarkHud &&
                                                styles.darkPinTextInput,
                                        ]}
                                        testID="handover-pin-input"
                                        value={enteredPin}
                                    />
                                    <Pressable
                                        accessibilityLabel="Confirm PIN takeover"
                                        accessibilityRole="button"
                                        disabled={enteredPin.length !== 4}
                                        onPress={handlePinSubmit}
                                        style={[
                                            styles.primaryButton,
                                            enteredPin.length !== 4 &&
                                                styles.disabledButton,
                                        ]}
                                        testID="claim-pin-btn"
                                    >
                                        <Text style={styles.primaryButtonText}>
                                            Claim with PIN
                                        </Text>
                                    </Pressable>
                                </View>
                            </View>
                        </>
                    )}
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
        padding: 20,
    },
    dialog: {
        width: '100%',
        maxWidth: 420,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 24,
        ...shadows.lg,
    },
    darkDialog: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
        borderWidth: 1,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 18,
    },
    titleWrap: {
        flex: 1,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        alignSelf: 'flex-start',
        marginBottom: 6,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFBF00',
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
    },
    darkTitle: {
        color: '#F8FAFC',
    },
    closeBtn: {
        padding: 6,
    },
    cardSection: {
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        padding: 16,
        marginBottom: 14,
    },
    darkCardSection: {
        backgroundColor: '#090D16',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 10,
    },
    methodNumber: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#FFBF00',
        justifyContent: 'center',
        alignItems: 'center',
    },
    methodNumberText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0F172A',
    },
    sectionHeading: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0F172A',
    },
    reliefLabel: {
        fontSize: 12,
        color: '#64748B',
        marginBottom: 2,
    },
    reliefName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#0F172A',
        marginBottom: 14,
    },
    primaryButton: {
        flexDirection: 'row',
        backgroundColor: '#FFBF00',
        borderRadius: 10,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    sentButton: {
        backgroundColor: '#059669',
    },
    disabledButton: {
        backgroundColor: '#94A3B8',
        opacity: 0.6,
    },
    primaryButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0F172A',
    },
    pinInstructions: {
        fontSize: 13,
        lineHeight: 18,
        color: '#64748B',
        marginBottom: 12,
    },
    pinBoxes: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        marginVertical: 6,
    },
    pinBox: {
        width: 52,
        height: 56,
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        borderColor: '#FFBF00',
        justifyContent: 'center',
        alignItems: 'center',
        ...shadows.sm,
    },
    darkPinBox: {
        backgroundColor: '#1E293B',
        borderColor: '#FFBF00',
    },
    pinDigit: {
        fontSize: 26,
        fontWeight: '800',
        color: '#FFBF00',
    },
    pinInputWrap: {
        marginTop: 14,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
    },
    pinTextInput: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 4,
        textAlign: 'center',
        color: '#0F172A',
        marginVertical: 10,
    },
    darkPinTextInput: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
        color: '#F8FAFC',
    },
    footerNotice: {
        fontSize: 11,
        lineHeight: 16,
        color: '#64748B',
        textAlign: 'center',
        marginTop: 4,
    },
    darkText: {
        color: '#F8FAFC',
    },
    darkMuted: {
        color: '#94A3B8',
    },
});
