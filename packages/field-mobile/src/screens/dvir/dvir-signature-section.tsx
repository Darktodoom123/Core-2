import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/common/Icon';
import type { DigitalSignatureData } from '../../components/signature/DigitalSignatureModal';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import { createDvirSharedStyles } from './dvir-shared-styles';

export interface DvirSignatureSectionProps {
    dvirSignature: DigitalSignatureData | null;
    setIsSignatureModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const DvirSignatureSection: React.FC<DvirSignatureSectionProps> = ({
    dvirSignature,
    setIsSignatureModalOpen,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const dvirSharedStyles = useThemedStyles(createDvirSharedStyles);

    return (
        <View
            style={[dvirSharedStyles.telemetryCard]}
            testID="dvir-signature-section"
        >
            <Text style={[dvirSharedStyles.telemetryHeading]}>
                DIGITAL SIGNATURE CERTIFICATION
            </Text>

            {dvirSignature ? (
                <View
                    style={[styles.signatureConfirmedCard]}
                    testID="dvir-signature-confirmed"
                >
                    <View style={styles.signatureConfirmedHeader}>
                        <Icon
                            color={theme.successEmerald}
                            name="check-circle"
                            size={18}
                        />
                        <Text style={[styles.signatureConfirmedTitle]}>
                            Certified by {dvirSignature.signerName} (
                            {dvirSignature.signerRole})
                        </Text>
                    </View>
                    <Text style={[styles.signatureConfirmedSub]}>
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
                        pressed && dvirSharedStyles.pressed,
                    ]}
                    testID="dvir-sign-button"
                >
                    <Icon
                        color={theme.textPrimary}
                        name="signature"
                        size={18}
                    />
                    <Text style={[styles.captureSignatureBtnText]}>
                        Capture Inspector Digital Signature
                    </Text>
                </Pressable>
            )}
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        captureSignatureBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: theme.borderStrong,
            borderRadius: 12,
            minHeight: 52,
            paddingHorizontal: 16,
        },
        captureSignatureBtnText: {
            fontSize: 14,
            fontWeight: '700',
            color: theme.textPrimary,
        },
        reSignBtn: {
            alignSelf: 'flex-start',
            justifyContent: 'center',
            minHeight: 48,
            paddingHorizontal: 14,
            backgroundColor: theme.surface,
            borderColor: theme.borderStrong,
            borderWidth: 1,
            borderRadius: 12,
        },
        reSignBtnText: {
            fontSize: 14,
            fontWeight: '700',
            color: theme.textPrimary,
        },
        signatureConfirmedCard: {
            backgroundColor: theme.successEmeraldLight,
            borderWidth: 1,
            borderColor: theme.successEmerald,
            borderRadius: 12,
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
            color: theme.successEmeraldText,
            marginBottom: 8,
        },
        signatureConfirmedTitle: {
            fontSize: 14,
            fontWeight: '700',
            color: theme.successEmeraldText,
        },
    });
