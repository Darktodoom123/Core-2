import React, { useState } from 'react';
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import type { PhotoAttachment } from '../components/attachments/PhotoAttachmentPicker';
import { PhotoAttachmentPicker } from '../components/attachments/PhotoAttachmentPicker';
import { Icon } from '../components/common/Icon';
import { colors, shadows } from '../components/nativeStyles';
import { DigitalSignatureModal } from '../components/signature/DigitalSignatureModal';

export interface RentalHandoverScreenProps {
    reservationId?: string;
    reservationReference?: string;
    clientName?: string;
    assetName?: string;
    assetCode?: string;
    mode?: 'checkout' | 'return';
    onBack?: () => void;
    onCompleteCheckout?: (data: RentalCheckoutData) => void;
    onCompleteReturn?: (data: RentalReturnData) => void;
}

export interface RentalCheckoutData {
    hourMeter: number;
    fuelLevelPercent: number;
    conditionNotes: string;
    photos: PhotoAttachment[];
    signatureBase64?: string;
    signeeName: string;
}

export interface RentalReturnData {
    hourMeter: number;
    fuelLevelPercent: number;
    conditionNotes: string;
    damageNoted: boolean;
    photos: PhotoAttachment[];
    signatureBase64?: string;
    signeeName: string;
}

export const RentalHandoverScreen: React.FC<RentalHandoverScreenProps> = ({
    reservationReference = 'REN-2026-0412',
    clientName = 'DMCI Construction & Power Inc.',
    assetName = '50T Tadano All-Terrain Crane',
    assetCode = 'ALB-CRN-050',
    mode: initialMode = 'checkout',
    onBack,
    onCompleteCheckout,
    onCompleteReturn,
}) => {
    const [mode, setMode] = useState<'checkout' | 'return'>(initialMode);
    const [hourMeter, setHourMeter] = useState('1420.5');
    const [fuelLevel, setFuelLevel] = useState('100');
    const [conditionNotes, setConditionNotes] = useState('');
    const [damageNoted, setDamageNoted] = useState(false);
    const [photos, setPhotos] = useState<PhotoAttachment[]>([]);
    const [signeeName, setSigneeName] = useState('Engr. Antonio Santos');
    const [signatureModalVisible, setSignatureModalVisible] = useState(false);
    const [signatureCaptured, setSignatureCaptured] = useState(false);

    const isCheckout = mode === 'checkout';

    const handleConfirm = () => {
        if (isCheckout) {
            onCompleteCheckout?.({
                hourMeter: parseFloat(hourMeter) || 0,
                fuelLevelPercent: parseInt(fuelLevel, 10) || 100,
                conditionNotes:
                    conditionNotes ||
                    'Checkout inspection completed with zero safety defects.',
                photos,
                signeeName,
            });
        } else {
            onCompleteReturn?.({
                hourMeter: parseFloat(hourMeter) || 0,
                fuelLevelPercent: parseInt(fuelLevel, 10) || 100,
                conditionNotes:
                    conditionNotes ||
                    (damageNoted
                        ? 'Damage recorded during return diff.'
                        : 'Returned in good operational condition.'),
                damageNoted,
                photos,
                signeeName,
            });
        }
    };

    return (
        <View style={styles.screen} testID="rental-handover-screen">
            {/* Top Navigation Bar */}
            <View style={styles.topBar}>
                <Pressable
                    accessibilityLabel="Go back"
                    accessibilityRole="button"
                    onPress={onBack}
                    style={({ pressed }) => [
                        styles.backBtn,
                        pressed && styles.pressed,
                    ]}
                    testID="rental-back-button"
                >
                    <Icon name="back" size={20} color={colors.text} />
                </Pressable>
                <View style={styles.headerTitles}>
                    <Text style={styles.screenTitle}>
                        {isCheckout ? 'Rental Checkout' : 'Return Check-in'}
                    </Text>
                    <Text style={styles.headerSubtitle}>
                        Alibaton Equipment Operations · PH
                    </Text>
                </View>
                <View style={styles.reservationPill}>
                    <Text style={styles.reservationPillText}>
                        {reservationReference}
                    </Text>
                </View>
            </View>

            {/* Mode Switcher Tabs */}
            <View style={styles.modeTabs}>
                <Pressable
                    accessibilityRole="button"
                    onPress={() => setMode('checkout')}
                    style={[styles.modeTab, isCheckout && styles.modeTabActive]}
                    testID="tab-checkout"
                >
                    <Icon
                        name="truck"
                        size={16}
                        color={isCheckout ? colors.blueDark : colors.muted}
                    />
                    <Text
                        style={[
                            styles.modeTabText,
                            isCheckout && styles.modeTabTextActive,
                        ]}
                    >
                        1. Outbound Handover
                    </Text>
                </Pressable>

                <Pressable
                    accessibilityRole="button"
                    onPress={() => setMode('return')}
                    style={[
                        styles.modeTab,
                        !isCheckout && styles.modeTabActive,
                    ]}
                    testID="tab-return"
                >
                    <Icon
                        name="check-circle"
                        size={16}
                        color={!isCheckout ? colors.blueDark : colors.muted}
                    />
                    <Text
                        style={[
                            styles.modeTabText,
                            !isCheckout && styles.modeTabTextActive,
                        ]}
                    >
                        2. Return Check-in Diff
                    </Text>
                </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Equipment & Client Summary Card */}
                <View style={styles.assetCard}>
                    <View style={styles.assetHeader}>
                        <View>
                            <Text style={styles.assetCodeLabel}>
                                ASSET CODE
                            </Text>
                            <Text style={styles.assetCode}>{assetCode}</Text>
                        </View>
                        <View style={styles.doleBadge}>
                            <Text style={styles.doleBadgeText}>
                                DOLE-OSHC CERTIFIED
                            </Text>
                        </View>
                    </View>

                    <Text style={styles.assetName}>{assetName}</Text>

                    <View style={styles.clientDivider} />
                    <View style={styles.clientRow}>
                        <Icon name="profile" size={14} color={colors.muted} />
                        <Text style={styles.clientName}>
                            Client: {clientName}
                        </Text>
                    </View>
                </View>

                {/* Telemetry & Operating Hours */}
                <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>
                        MACHINE TELEMETRY & FLUIDS
                    </Text>
                    <View style={styles.inputsRow}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>
                                Hour Meter (hrs)
                            </Text>
                            <TextInput
                                keyboardType="numeric"
                                onChangeText={setHourMeter}
                                style={styles.textInput}
                                testID="input-hour-meter"
                                value={hourMeter}
                            />
                        </View>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>
                                Fuel Level (%)
                            </Text>
                            <TextInput
                                keyboardType="numeric"
                                onChangeText={setFuelLevel}
                                style={styles.textInput}
                                testID="input-fuel-level"
                                value={fuelLevel}
                            />
                        </View>
                    </View>
                </View>

                {/* Return Damage Diff Toggle (Return Mode Only) */}
                {!isCheckout ? (
                    <View style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>
                            CONDITION DIFF & DAMAGE INSPECTION
                        </Text>
                        <Pressable
                            accessibilityRole="button"
                            onPress={() => setDamageNoted(!damageNoted)}
                            style={[
                                styles.damageToggle,
                                damageNoted
                                    ? styles.damageActive
                                    : styles.damageClean,
                            ]}
                            testID="toggle-damage-diff"
                        >
                            <Icon
                                name="alert"
                                size={18}
                                color={
                                    damageNoted
                                        ? colors.redDark
                                        : colors.greenDark
                                }
                            />
                            <View style={styles.damageCopy}>
                                <Text style={styles.damageTitle}>
                                    {damageNoted
                                        ? 'Damage or Wear Logged'
                                        : 'No New Damage · Clean Return'}
                                </Text>
                                <Text style={styles.damageSubtitle}>
                                    {damageNoted
                                        ? 'Requires photo documentation & customer sign-off'
                                        : 'Asset condition matches outbound baseline'}
                                </Text>
                            </View>
                        </Pressable>
                    </View>
                ) : null}

                {/* Photo Evidence & Attachments */}
                <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>
                        {isCheckout
                            ? 'OUTBOUND BASELINE PHOTOS'
                            : 'RETURN CONDITION EVIDENCE PHOTOS'}
                    </Text>
                    <PhotoAttachmentPicker
                        attachments={photos}
                        onAddAttachment={(att) =>
                            setPhotos((prev) => [...prev, att])
                        }
                        onRemoveAttachment={(idx) =>
                            setPhotos((prev) =>
                                prev.filter((_, i) => i !== idx),
                            )
                        }
                        title={
                            isCheckout
                                ? 'Baseline Inspection Photos'
                                : 'Return Condition Evidence Photos'
                        }
                    />
                </View>

                {/* Condition Notes */}
                <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>
                        REMARKS & INSPECTION NOTES
                    </Text>
                    <TextInput
                        multiline
                        numberOfLines={3}
                        onChangeText={setConditionNotes}
                        placeholder={
                            isCheckout
                                ? 'Verify tire pressure, outriggers, fluid leaks, and boom condition...'
                                : 'Describe physical condition, paint scratches, hydraulic seals...'
                        }
                        placeholderTextColor={colors.muted}
                        style={styles.notesInput}
                        testID="input-condition-notes"
                        value={conditionNotes}
                    />
                </View>

                {/* Customer Sign-off Card */}
                <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>
                        TWO-PARTY HANDOVER SIGN-OFF
                    </Text>
                    <View style={styles.signeeRow}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>
                                Client Representative Name
                            </Text>
                            <TextInput
                                onChangeText={setSigneeName}
                                style={styles.textInput}
                                testID="input-signee-name"
                                value={signeeName}
                            />
                        </View>
                    </View>

                    <Pressable
                        accessibilityLabel="Capture Customer Signature"
                        accessibilityRole="button"
                        onPress={() => setSignatureModalVisible(true)}
                        style={[
                            styles.signatureBtn,
                            signatureCaptured && styles.signatureBtnDone,
                        ]}
                        testID="open-signature-button"
                    >
                        <Icon
                            name="signature"
                            size={18}
                            color={
                                signatureCaptured
                                    ? colors.greenDark
                                    : colors.blueDark
                            }
                        />
                        <Text
                            style={[
                                styles.signatureBtnText,
                                signatureCaptured &&
                                    styles.signatureBtnTextDone,
                            ]}
                        >
                            {signatureCaptured
                                ? '✓ Customer Signature Captured'
                                : 'Capture Digital Signature'}
                        </Text>
                    </Pressable>
                </View>

                {/* Final Action Button */}
                <Pressable
                    accessibilityLabel={
                        isCheckout
                            ? 'Confirm Rental Checkout & Dispatch'
                            : 'Confirm Return Check-in & Close'
                    }
                    accessibilityRole="button"
                    onPress={handleConfirm}
                    style={({ pressed }) => [
                        styles.confirmBtn,
                        pressed && styles.pressed,
                    ]}
                    testID="confirm-handover-button"
                >
                    <Icon name="check-circle" size={20} color="#FFFFFF" />
                    <Text style={styles.confirmBtnText}>
                        {isCheckout
                            ? 'CONFIRM RENTAL CHECKOUT & DISPATCH'
                            : 'CONFIRM RETURN CHECK-IN & CLOSE'}
                    </Text>
                </Pressable>
            </ScrollView>

            <DigitalSignatureModal
                clientName={clientName}
                jobReference={reservationReference}
                onClose={() => setSignatureModalVisible(false)}
                onConfirmSignature={() => {
                    setSignatureCaptured(true);
                    setSignatureModalVisible(false);
                }}
                visible={signatureModalVisible}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    screen: {
        backgroundColor: colors.background,
        flex: 1,
    },
    topBar: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderBottomColor: colors.border,
        borderBottomWidth: 1,
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backBtn: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderRadius: 10,
        height: 38,
        justifyContent: 'center',
        width: 38,
    },
    headerTitles: {
        flex: 1,
    },
    screenTitle: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '800',
    },
    headerSubtitle: {
        color: colors.muted,
        fontSize: 11,
    },
    reservationPill: {
        backgroundColor: colors.blueLight,
        borderColor: colors.blueBorder,
        borderRadius: 8,
        borderWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    reservationPillText: {
        color: colors.blueDark,
        fontSize: 11,
        fontWeight: '700',
    },
    modeTabs: {
        backgroundColor: colors.surface,
        borderBottomColor: colors.border,
        borderBottomWidth: 1,
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 6,
    },
    modeTab: {
        alignItems: 'center',
        borderRadius: 8,
        flex: 1,
        flexDirection: 'row',
        gap: 6,
        justifyContent: 'center',
        paddingVertical: 10,
    },
    modeTabActive: {
        backgroundColor: colors.blueLight,
    },
    modeTabText: {
        color: colors.muted,
        fontSize: 12,
        fontWeight: '600',
    },
    modeTabTextActive: {
        color: colors.blueDark,
        fontWeight: '700',
    },
    scrollContent: {
        padding: 16,
    },
    assetCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 14,
        padding: 14,
        ...shadows.sm,
    },
    assetHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    assetCodeLabel: {
        color: colors.muted,
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    assetCode: {
        color: colors.blueDark,
        fontSize: 14,
        fontWeight: '800',
    },
    doleBadge: {
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
        borderRadius: 6,
        borderWidth: 1,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    doleBadgeText: {
        color: colors.greenDark,
        fontSize: 10,
        fontWeight: '700',
    },
    assetName: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '700',
        marginTop: 2,
    },
    clientDivider: {
        backgroundColor: colors.border,
        height: 1,
        marginVertical: 10,
    },
    clientRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6,
    },
    clientName: {
        color: colors.muted,
        fontSize: 13,
    },
    sectionCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 14,
        padding: 14,
        ...shadows.sm,
    },
    sectionTitle: {
        color: colors.muted,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.5,
        marginBottom: 10,
    },
    inputsRow: {
        flexDirection: 'row',
        gap: 10,
    },
    inputGroup: {
        flex: 1,
    },
    inputLabel: {
        color: colors.text,
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 4,
    },
    textInput: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        color: colors.text,
        fontSize: 14,
        fontWeight: '600',
        minHeight: 44,
        paddingHorizontal: 12,
    },
    damageToggle: {
        alignItems: 'center',
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 10,
        padding: 12,
    },
    damageClean: {
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
    },
    damageActive: {
        backgroundColor: colors.redLight,
        borderColor: colors.redBorder,
    },
    damageCopy: {
        flex: 1,
    },
    damageTitle: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '700',
    },
    damageSubtitle: {
        color: colors.muted,
        fontSize: 11,
        marginTop: 2,
    },
    notesInput: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        color: colors.text,
        fontSize: 13,
        minHeight: 70,
        padding: 10,
        textAlignVertical: 'top',
    },
    signeeRow: {
        marginBottom: 10,
    },
    signatureBtn: {
        alignItems: 'center',
        backgroundColor: colors.blueLight,
        borderColor: colors.blueBorder,
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
        minHeight: 48,
        padding: 12,
    },
    signatureBtnDone: {
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
    },
    signatureBtnText: {
        color: colors.blueDark,
        fontSize: 13,
        fontWeight: '700',
    },
    signatureBtnTextDone: {
        color: colors.greenDark,
    },
    confirmBtn: {
        alignItems: 'center',
        backgroundColor: colors.blueDark,
        borderRadius: 12,
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
        marginBottom: 24,
        minHeight: 52,
        padding: 14,
        ...shadows.md,
    },
    confirmBtnText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
    },
    pressed: {
        opacity: 0.8,
        transform: [{ scale: 0.985 }],
    },
});
