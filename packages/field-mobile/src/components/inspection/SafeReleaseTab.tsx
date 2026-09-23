import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../../theme';
import type { SafeReleaseVerification } from '../../types/index';
import { Icon } from '../common/Icon';
import { colors, shadows } from '../nativeStyles';

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
            <View style={styles.cardHeaderRow}>
                <View style={styles.headerIconWrap}>
                    <Icon
                        color={isDarkHud ? colors.hudAmber : colors.amber}
                        name="shield-check"
                        size={18}
                    />
                </View>
                <View style={styles.headerTitles}>
                    <Text
                        accessibilityRole="header"
                        style={[
                            styles.cardHeading,
                            isDarkHud && styles.darkText,
                        ]}
                    >
                        Safe-Release Post-Repair Verification
                    </Text>
                    <Text
                        style={[
                            styles.cardHelper,
                            isDarkHud && styles.darkHelper,
                        ]}
                    >
                        Formal safety certification required before asset
                        returns to active service after inspection or repair.
                    </Text>
                </View>
            </View>

            <View
                style={[
                    styles.certCard,
                    isDarkHud && styles.darkCertCard,
                    certified &&
                        (isDarkHud
                            ? styles.darkCertCardPassed
                            : styles.certCardPassed),
                ]}
            >
                <View
                    style={[
                        styles.certStatusBanner,
                        certified
                            ? styles.certStatusBannerPassed
                            : styles.certStatusBannerPending,
                        isDarkHud &&
                            (certified
                                ? styles.darkCertStatusBannerPassed
                                : styles.darkCertStatusBannerPending),
                    ]}
                >
                    <Icon
                        color={
                            certified
                                ? isDarkHud
                                    ? '#34D399'
                                    : colors.greenDark
                                : isDarkHud
                                  ? '#FDBA74'
                                  : colors.warningDark
                        }
                        name={certified ? 'shield-check' : 'alert-circle'}
                        size={16}
                    />
                    <Text
                        style={[
                            styles.certBadge,
                            certified && styles.certBadgePassed,
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
                </View>

                <View style={styles.assetRow}>
                    <Icon
                        color={isDarkHud ? colors.hudAmber : colors.amber}
                        name="truck"
                        size={16}
                    />
                    <Text
                        style={[
                            styles.certAssetCode,
                            isDarkHud && styles.darkText,
                        ]}
                    >
                        {assetCode} · {assetName}
                    </Text>
                </View>

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
                        placeholderTextColor={
                            isDarkHud ? '#64748B' : colors.muted
                        }
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
                        placeholderTextColor={
                            isDarkHud ? '#64748B' : colors.muted
                        }
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
                            styles.certifyButton,
                            isDarkHud && styles.darkCertifyButton,
                            pressed && styles.pressed,
                        ]}
                        testID="certify-safe-release-btn"
                    >
                        <Text
                            style={[
                                styles.certifyBtnText,
                                isDarkHud && styles.darkCertifyBtnText,
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
                        <View style={styles.stampHeader}>
                            <Icon
                                color={isDarkHud ? '#34D399' : colors.greenDark}
                                name="check-circle"
                                size={18}
                            />
                            <Text
                                style={[
                                    styles.signedStampTitle,
                                    isDarkHud && styles.darkSignedStampTitle,
                                ]}
                            >
                                ✓ CERTIFIED & DIGITALLY SIGNED
                            </Text>
                        </View>
                        <Text
                            style={[
                                styles.signedStampSub,
                                isDarkHud && styles.darkSignedStampSub,
                            ]}
                        >
                            Certified by: {technicianName} on{' '}
                            {new Date().toLocaleDateString()}
                        </Text>
                        <Text
                            style={[
                                styles.certNumberStamp,
                                isDarkHud && styles.darkCertNumberStamp,
                            ]}
                        >
                            Reference: {certNumber}
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
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 16,
        padding: 16,
        ...shadows.sm,
    },
    darkSectionCard: {
        backgroundColor: colors.hudSurface,
        borderColor: colors.hudBorder,
        shadowColor: 'transparent',
    },
    cardHeaderRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 12,
    },
    headerIconWrap: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        height: 34,
        justifyContent: 'center',
        width: 34,
    },
    headerTitles: {
        flex: 1,
    },
    cardHeading: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '800',
    },
    darkText: {
        color: colors.hudText,
    },
    cardHelper: {
        color: colors.muted,
        fontSize: 12,
        lineHeight: 16,
        marginTop: 2,
    },
    darkHelper: {
        color: colors.hudTextDim,
    },
    certCard: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
    },
    darkCertCard: {
        backgroundColor: colors.surfaceDark,
        borderColor: colors.hudBorder,
    },
    certCardPassed: {
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
    },
    darkCertCardPassed: {
        backgroundColor: 'rgba(5, 150, 105, 0.12)',
        borderColor: 'rgba(5, 150, 105, 0.3)',
    },
    certStatusBanner: {
        alignItems: 'center',
        alignSelf: 'flex-start',
        borderRadius: 6,
        flexDirection: 'row',
        gap: 6,
        marginBottom: 12,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    certStatusBannerPending: {
        backgroundColor: colors.warningLight,
    },
    darkCertStatusBannerPending: {
        backgroundColor: 'rgba(234, 88, 12, 0.18)',
    },
    certStatusBannerPassed: {
        backgroundColor: colors.greenSoft,
    },
    darkCertStatusBannerPassed: {
        backgroundColor: 'rgba(5, 150, 105, 0.22)',
    },
    certBadge: {
        color: colors.warningDark,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    certBadgePassed: {
        color: colors.greenDark,
    },
    darkCertBadgePending: {
        color: '#FDBA74',
    },
    darkCertBadgePassed: {
        color: '#34D399',
    },
    assetRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    certAssetCode: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '700',
    },
    formGroup: {
        gap: 8,
    },
    formLabel: {
        color: colors.textSecondary,
        fontSize: 12,
        fontWeight: '700',
        marginTop: 4,
    },
    darkLabel: {
        color: colors.hudTextDim,
    },
    input: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 10,
        borderWidth: 1,
        color: colors.text,
        fontSize: 14,
        minHeight: 44,
        paddingHorizontal: 12,
    },
    darkInput: {
        backgroundColor: colors.surfaceDark,
        borderColor: colors.hudBorder,
        color: colors.hudText,
    },
    textArea: {
        minHeight: 76,
        paddingTop: 10,
        textAlignVertical: 'top',
    },
    certifyButton: {
        alignItems: 'center',
        backgroundColor: colors.primary,
        borderRadius: 10,
        justifyContent: 'center',
        minHeight: 48,
        marginTop: 14,
    },
    darkCertifyButton: {
        backgroundColor: colors.hudAmber,
    },
    certifyBtnText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
    },
    darkCertifyBtnText: {
        color: colors.surfaceDark,
    },
    signedStamp: {
        alignItems: 'center',
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
        borderRadius: 10,
        borderWidth: 1,
        marginTop: 14,
        padding: 14,
    },
    darkSignedStamp: {
        backgroundColor: 'rgba(5, 150, 105, 0.15)',
        borderColor: '#059669',
    },
    stampHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6,
    },
    signedStampTitle: {
        color: colors.greenDark,
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    darkSignedStampTitle: {
        color: '#34D399',
    },
    signedStampSub: {
        color: colors.greenDark,
        fontSize: 12,
        marginTop: 4,
    },
    darkSignedStampSub: {
        color: '#6EE7B7',
    },
    certNumberStamp: {
        color: colors.muted,
        fontSize: 11,
        fontWeight: '600',
        marginTop: 4,
    },
    darkCertNumberStamp: {
        color: colors.hudTextDim,
    },
    pressed: {
        opacity: 0.85,
    },
});
