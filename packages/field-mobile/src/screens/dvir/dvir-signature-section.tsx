import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/common/Icon';
import type { DigitalSignatureData } from '../../components/signature/DigitalSignatureModal';
import { useTheme } from '../../theme';
import { dvirSharedStyles } from './dvir-shared-styles';

export interface DvirSignatureSectionProps {
    dvirSignature: DigitalSignatureData | null;
    setIsSignatureModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const DvirSignatureSection: React.FC<DvirSignatureSectionProps> = ({
    dvirSignature,
    setIsSignatureModalOpen,
}) => {
    const { isDarkHud } = useTheme();

    return (
        <View
            style={[
                dvirSharedStyles.telemetryCard,
                isDarkHud && dvirSharedStyles.darkTelemetryCard,
            ]}
            testID="dvir-signature-section"
        >
            <Text
                style={[
                    dvirSharedStyles.telemetryHeading,
                    isDarkHud && dvirSharedStyles.darkTelemetryHeading,
                ]}
            >
                DIGITAL SIGNATURE CERTIFICATION
            </Text>

            {dvirSignature ? (
                <View
                    style={[
                        styles.signatureConfirmedCard,
                        isDarkHud && styles.darkSignatureConfirmedCard,
                    ]}
                    testID="dvir-signature-confirmed"
                >
                    <View style={styles.signatureConfirmedHeader}>
                        <Icon color="#10B981" name="check-circle" size={18} />
                        <Text
                            style={[
                                styles.signatureConfirmedTitle,
                                isDarkHud && styles.darkSignatureConfirmedTitle,
                            ]}
                        >
                            Certified by {dvirSignature.signerName} (
                            {dvirSignature.signerRole})
                        </Text>
                    </View>
                    <Text
                        style={[
                            styles.signatureConfirmedSub,
                            isDarkHud && styles.darkSignatureConfirmedSub,
                        ]}
                    >
                        Signed at{' '}
                        {new Date(dvirSignature.signedAt).toLocaleTimeString()}{' '}
                        · {dvirSignature.pointCount} points captured
                    </Text>
                    <Pressable
                        accessibilityLabel="Re-sign DVIR"
                        accessibilityRole="button"
                        onPress={() => setIsSignatureModalOpen(true)}
                        style={styles.reSignBtn}
                        testID="dvir-re-sign-button"
                    >
                        <Text style={styles.reSignBtnText}>Re-sign</Text>
                    </Pressable>
                </View>
            ) : (
                <Pressable
                    accessibilityLabel="Capture Digital Signature"
                    accessibilityRole="button"
                    onPress={() => setIsSignatureModalOpen(true)}
                    style={({ pressed }) => [
                        styles.captureSignatureBtn,
                        isDarkHud && styles.darkCaptureSignatureBtn,
                        pressed && dvirSharedStyles.pressed,
                    ]}
                    testID="dvir-sign-button"
                >
                    <Icon
                        color={isDarkHud ? '#60A5FA' : '#2563EB'}
                        name="signature"
                        size={18}
                    />
                    <Text
                        style={[
                            styles.captureSignatureBtnText,
                            isDarkHud && styles.darkCaptureSignatureBtnText,
                        ]}
                    >
                        Capture Inspector Digital Signature
                    </Text>
                </Pressable>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    captureSignatureBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#EFF6FF',
        borderWidth: 1,
        borderColor: '#BFDBFE',
        borderRadius: 10,
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    captureSignatureBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1D4ED8',
    },
    darkCaptureSignatureBtn: {
        backgroundColor: '#1E3A8A30',
        borderColor: '#3B82F6',
    },
    darkCaptureSignatureBtnText: {
        color: '#60A5FA',
    },
    darkSignatureConfirmedCard: {
        backgroundColor: '#064E3B30',
        borderColor: '#059669',
    },
    darkSignatureConfirmedSub: {
        color: '#A7F3D0',
    },
    darkSignatureConfirmedTitle: {
        color: '#6EE7B7',
    },
    reSignBtn: {
        alignSelf: 'flex-start',
        paddingVertical: 4,
        paddingHorizontal: 10,
        backgroundColor: '#D1FAE5',
        borderRadius: 6,
    },
    reSignBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#065F46',
    },
    signatureConfirmedCard: {
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#A7F3D0',
        borderRadius: 10,
        padding: 14,
    },
    signatureConfirmedHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    signatureConfirmedSub: {
        fontSize: 12,
        color: '#047857',
        marginBottom: 8,
    },
    signatureConfirmedTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#065F46',
    },
});
