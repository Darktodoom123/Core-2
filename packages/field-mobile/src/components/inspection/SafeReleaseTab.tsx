import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { SafeReleaseVerification } from '../../types/index';
import { colors, sharedStyles } from '../nativeStyles';

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
        <View style={styles.sectionCard} testID="safe-release-section">
            <Text accessibilityRole="header" style={styles.cardHeading}>
                Safe-Release Post-Repair Verification
            </Text>
            <Text style={styles.cardHelper}>
                Formal safety certification required before asset returns to
                active service after inspection or repair.
            </Text>

            <View
                style={[
                    styles.certCard,
                    certified ? styles.certCardPassed : styles.certCardPending,
                ]}
            >
                <Text style={styles.certBadge}>
                    {certified
                        ? 'CERTIFIED SAFE FOR RELEASE'
                        : 'PENDING TECHNICIAN SIGN-OFF'}
                </Text>
                <Text style={styles.certAssetCode}>
                    {assetCode} · {assetName}
                </Text>

                <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>
                        Certificate / Work Reference Number
                    </Text>
                    <TextInput
                        accessibilityLabel="Certificate number"
                        editable={!certified}
                        onChangeText={setCertNumber}
                        style={styles.input}
                        value={certNumber}
                        testID="cert-number-input"
                    />

                    <Text style={styles.formLabel}>
                        Technician Sign-off Remarks
                    </Text>
                    <TextInput
                        accessibilityLabel="Technician release remarks"
                        editable={!certified}
                        multiline
                        numberOfLines={3}
                        onChangeText={setRemarks}
                        style={[styles.input, styles.textArea]}
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
                            pressed && styles.pressed,
                        ]}
                        testID="certify-safe-release-btn"
                    >
                        <Text style={sharedStyles.buttonText}>
                            ✓ Certify & Sign Safe Release
                        </Text>
                    </Pressable>
                ) : (
                    <View style={styles.signedStamp}>
                        <Text style={styles.signedStampTitle}>
                            ✓ CERTIFIED & DIGITALLY SIGNED
                        </Text>
                        <Text style={styles.signedStampSub}>
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
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 16,
        padding: 16,
    },
    cardHeading: {
        color: colors.text,
        fontSize: 17,
        fontWeight: '800',
    },
    cardHelper: {
        color: colors.secondary,
        fontSize: 13,
        lineHeight: 18,
        marginBottom: 12,
        marginTop: 4,
    },
    certCard: {
        borderRadius: 10,
        borderWidth: 1,
        marginTop: 8,
        padding: 16,
    },
    certCardPending: {
        backgroundColor: colors.warningLight,
        borderColor: colors.warningBorder,
    },
    certCardPassed: {
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
    },
    certBadge: {
        color: colors.amberDark,
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 0.8,
    },
    certAssetCode: {
        color: colors.text,
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 8,
        marginTop: 2,
    },
    formGroup: {
        gap: 8,
        marginTop: 8,
    },
    formLabel: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '800',
    },
    input: {
        backgroundColor: colors.surface,
        borderColor: colors.borderStrong,
        borderRadius: 8,
        borderWidth: 1,
        color: colors.text,
        fontSize: 14,
        minHeight: 48,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    certifyButton: {
        backgroundColor: colors.green,
        marginTop: 12,
        minHeight: 48,
        width: '100%',
    },
    signedStamp: {
        backgroundColor: colors.surface,
        borderColor: colors.greenBorder,
        borderRadius: 8,
        borderWidth: 1.5,
        gap: 4,
        marginTop: 12,
        padding: 12,
    },
    signedStampTitle: {
        color: colors.greenDark,
        fontSize: 14,
        fontWeight: '900',
    },
    signedStampSub: {
        color: colors.secondary,
        fontSize: 12,
    },
    pressed: {
        opacity: 0.78,
    },
});
