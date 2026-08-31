import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../../theme';
import type { SafeReleaseVerification } from '../../types/index';
import { sharedStyles } from '../nativeStyles';

export interface SafeReleaseTabProps {
    assetCode: string;
    assetName: string;
    technicianName: string;
    onSafeRelease: (verification: SafeReleaseVerification) => void;
}

export const SafeReleaseTab: React.FC<SafeReleaseTabProps> = ({
    assetCode,
    assetName,
    technicianName,
    onSafeRelease,
}) => {
    const { isDarkHud } = useTheme();
    const [certified, setCertified] = useState(false);
    const [certNumber, setCertNumber] = useState('CERT-CRN07-2026');
    const [remarks, setRemarks] = useState(
        'All pre-shift safety inspection criteria verified. Asset released for active operation.',
    );

    const handleCertify = () => {
        setCertified(true);
        onSafeRelease({
            isCertifiedSafe: true,
            certifiedBy: technicianName,
            certificationDate: new Date().toISOString(),
            certificateNumber: certNumber,
            remarks,
        });
    };

    return (
        <View
            style={[styles.sectionCard, isDarkHud && styles.darkSectionCard]}
            testID="safe-release-section"
        >
            <Text
                accessibilityRole="header"
                style={[styles.cardHeading, isDarkHud && styles.darkText]}
            >
                Safe-Release Post-Repair Verification
            </Text>
            <Text style={[styles.cardHelper, isDarkHud && styles.darkHelper]}>
                Formal safety certification required before asset returns to
                active service after inspection or repair.
            </Text>

            <View
                style={[
                    styles.certCard,
                    isDarkHud && styles.darkCertCard,
                    certified
                        ? isDarkHud
                            ? styles.darkCertCardPassed
                            : styles.certCardPassed
                        : isDarkHud
                          ? styles.darkCertCardPending
                          : styles.certCardPending,
                ]}
            >
                <Text
                    style={[
                        styles.certBadge,
                        isDarkHud &&
                            (certified
                                ? styles.darkCertBadgePassed
                                : styles.darkCertBadgePending),
                    ]}
                >
                    {certified
                        ? '✓ CERTIFIED SAFE FOR RELEASE'
                        : 'PENDING TECHNICIAN SIGN-OFF'}
                </Text>
                <Text
                    style={[styles.certAssetCode, isDarkHud && styles.darkText]}
                >
                    {assetCode} · {assetName}
                </Text>

                <View style={styles.formGroup}>
                    <Text
                        style={[
                            styles.formLabel,
                            isDarkHud && styles.darkLabel,
                        ]}
                    >
                        Certificate / Work Reference Number
                    </Text>
                    <TextInput
                        accessibilityLabel="Certificate number"
                        editable={!certified}
                        onChangeText={setCertNumber}
                        placeholderTextColor={isDarkHud ? '#64748B' : '#94A3B8'}
                        style={[styles.input, isDarkHud && styles.darkInput]}
                        value={certNumber}
                        testID="cert-number-input"
                    />

                    <Text
                        style={[
                            styles.formLabel,
                            isDarkHud && styles.darkLabel,
                        ]}
                    >
                        Technician Sign-off Remarks
                    </Text>
                    <TextInput
                        accessibilityLabel="Technician release remarks"
                        editable={!certified}
                        multiline
                        numberOfLines={3}
                        onChangeText={setRemarks}
                        placeholderTextColor={isDarkHud ? '#64748B' : '#94A3B8'}
                        style={[
                            styles.input,
                            styles.textArea,
                            isDarkHud && styles.darkInput,
                        ]}
                        value={remarks}
                        testID="release-remarks-input"
                    />
                </View>

                {!certified ? (
                    <Pressable
                        accessibilityLabel="Sign and certify safe operational release"
                        accessibilityRole="button"
                        onPress={handleCertify}
                        style={({ pressed }) => [
                            sharedStyles.button,
                            styles.certifyButton,
                            isDarkHud && styles.darkCertifyButton,
                            pressed && styles.pressed,
                        ]}
                        testID="certify-safe-release-btn"
                    >
                        <Text
                            style={[
                                sharedStyles.buttonText,
                                styles.certifyBtnText,
                            ]}
                        >
                            ✓ Certify & Sign Safe Release
                        </Text>
                    </Pressable>
                ) : (
                    <View
                        style={[
                            styles.signedStamp,
                            isDarkHud && styles.darkSignedStamp,
                        ]}
                    >
                        <Text
                            style={[
                                styles.signedStampTitle,
                                isDarkHud && styles.darkSignedStampTitle,
                            ]}
                        >
                            ✓ CERTIFIED & DIGITALLY SIGNED
                        </Text>
                        <Text
                            style={[
                                styles.signedStampSub,
                                isDarkHud && styles.darkSignedStampSub,
                            ]}
                        >
                            Certified by: {technicianName} on{' '}
                            {new Date().toLocaleDateString()}
                        </Text>
                    </View>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    sectionCard: {
        backgroundColor: '#0F172A',
        borderColor: '#1E293B',
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 16,
        padding: 16,
    },
    darkSectionCard: {
        backgroundColor: '#0F172A',
        borderColor: '#1E293B',
    },
    cardHeading: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '800',
    },
    darkText: {
        color: '#FFFFFF',
    },
    cardHelper: {
        color: '#94A3B8',
        fontSize: 13,
        lineHeight: 18,
        marginBottom: 12,
        marginTop: 4,
    },
    darkHelper: {
        color: '#94A3B8',
    },
    certCard: {
        backgroundColor: '#101A2E',
        borderColor: '#1E3254',
        borderRadius: 10,
        borderWidth: 1,
        marginTop: 8,
        padding: 16,
    },
    darkCertCard: {
        borderRadius: 12,
    },
    certCardPending: {
        backgroundColor: '#101A2E',
        borderColor: '#1E3254',
    },
    darkCertCardPending: {
        backgroundColor: '#101A2E',
        borderColor: '#1E3254',
    },
    certCardPassed: {
        backgroundColor: '#06281E',
        borderColor: '#059669',
    },
    darkCertCardPassed: {
        backgroundColor: '#06281E',
        borderColor: '#059669',
    },
    certBadge: {
        color: '#38BDF8',
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 0.8,
        marginBottom: 4,
    },
    darkCertBadgePending: {
        color: '#38BDF8',
    },
    darkCertBadgePassed: {
        color: '#34D399',
    },
    certAssetCode: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '800',
        marginBottom: 12,
    },
    formGroup: {
        gap: 8,
    },
    formLabel: {
        color: '#CBD5E1',
        fontSize: 13,
        fontWeight: '800',
        marginTop: 4,
    },
    darkLabel: {
        color: '#CBD5E1',
    },
    input: {
        backgroundColor: '#162238',
        borderColor: '#1E3A8A',
        borderRadius: 8,
        borderWidth: 1,
        color: '#FFFFFF',
        fontSize: 14,
        minHeight: 48,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    darkInput: {
        backgroundColor: '#162238',
        borderColor: '#1E3A8A',
        color: '#FFFFFF',
    },
    textArea: {
        minHeight: 70,
        textAlignVertical: 'top',
    },
    certifyButton: {
        backgroundColor: '#059669',
        marginTop: 16,
        minHeight: 48,
        width: '100%',
    },
    darkCertifyButton: {
        backgroundColor: '#059669',
    },
    certifyBtnText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '800',
    },
    signedStamp: {
        backgroundColor: '#06281E',
        borderColor: '#059669',
        borderRadius: 8,
        borderWidth: 1,
        marginTop: 16,
        padding: 12,
    },
    darkSignedStamp: {
        backgroundColor: '#06281E',
        borderColor: '#059669',
    },
    signedStampTitle: {
        color: '#34D399',
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    darkSignedStampTitle: {
        color: '#34D399',
    },
    signedStampSub: {
        color: '#6EE7B7',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 2,
    },
    darkSignedStampSub: {
        color: '#6EE7B7',
    },
    pressed: {
        opacity: 0.78,
    },
});
