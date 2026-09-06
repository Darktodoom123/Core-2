import React, { useState } from 'react';
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { Icon } from '../components/common/Icon';
import { TileScreenHeader } from '../components/layout/tile-screen-header';
import { colors, shadows } from '../components/nativeStyles';
import { DigitalSignatureModal } from '../components/signature/DigitalSignatureModal';
import { useTheme } from '../theme';

export interface SalesDeliveryScreenProps {
    orderReference?: string;
    clientName?: string;
    equipmentName?: string;
    vinNumber?: string;
    deliveryAddress?: string;
    onBack?: () => void;
    onCompleteDelivery?: (data: SalesDeliveryData) => void;
}

export interface SalesDeliveryData {
    verifiedVin: string;
    accessoriesChecked: string[];
    signeeName: string;
    signeeRole: string;
    notes: string;
    signatureBase64?: string;
}

export const SalesDeliveryScreen: React.FC<SalesDeliveryScreenProps> = ({
    orderReference = 'SO-2026-0091',
    clientName = 'San Miguel Infrastructure Corp.',
    equipmentName = 'Caterpillar 320 GC Hydraulic Excavator',
    vinNumber = 'CAT0320GC88912',
    deliveryAddress = 'North-South Commuter Railway (NSCR) Project - Depot Area, Bulacan, PH',
    onBack,
    onCompleteDelivery,
}) => {
    const { isDarkHud } = useTheme();
    const [enteredVin, setEnteredVin] = useState(vinNumber);
    const [vinVerified, setVinVerified] = useState(true);
    const [accessories, setAccessories] = useState<Record<string, boolean>>({
        bucket: true,
        coupler: true,
        toolkit: true,
        manual: true,
    });
    const [signeeName, setSigneeName] = useState('Engr. Rafael Mendoza');
    const [signeeRole, setSigneeRole] = useState(
        'Authorized Receiving Engineer',
    );
    const [deliveryNotes, setDeliveryNotes] = useState('');
    const [signatureModalVisible, setSignatureModalVisible] = useState(false);
    const [signatureCaptured, setSignatureCaptured] = useState(false);

    const toggleAccessory = (key: string) => {
        setAccessories((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

    const handleConfirm = () => {
        const checkedList = Object.keys(accessories).filter(
            (k) => accessories[k],
        );
        onCompleteDelivery?.({
            verifiedVin: enteredVin,
            accessoriesChecked: checkedList,
            signeeName,
            signeeRole,
            notes:
                deliveryNotes ||
                'Unit delivered in brand new operational condition to customer site.',
            signatureBase64: signatureCaptured
                ? 'digital-signature-captured'
                : undefined,
        });
    };

    return (
        <View
            style={[styles.screen, isDarkHud && styles.darkScreen]}
            testID="sales-delivery-screen"
        >
            {/* Top Navigation Bar */}
            <TileScreenHeader
                backAccessibilityLabel="Go back"
                backTestID="sales-back-button"
                category="Equipment Sales"
                onBack={onBack}
                rightElement={
                    <View
                        style={[
                            styles.orderPill,
                            isDarkHud && styles.orderPillDark,
                        ]}
                    >
                        <Text
                            style={[
                                styles.orderPillText,
                                isDarkHud && styles.orderPillTextDark,
                            ]}
                        >
                            {orderReference}
                        </Text>
                    </View>
                }
                subtitle="Alibaton Heavy Equipment Sales · PH"
                title="Equipment Sales Delivery"
            />

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Order & Equipment Summary Card */}
                <View style={[styles.card, isDarkHud && styles.cardDark]}>
                    <View style={styles.cardHeader}>
                        <Text
                            style={[
                                styles.categoryLabel,
                                isDarkHud && styles.categoryLabelDark,
                            ]}
                        >
                            EQUIPMENT SALE
                        </Text>
                        <View
                            style={[
                                styles.paidBadge,
                                isDarkHud && styles.paidBadgeDark,
                            ]}
                        >
                            <Icon
                                color={isDarkHud ? '#34D399' : colors.greenDark}
                                name="check-circle"
                                size={12}
                            />
                            <Text
                                style={[
                                    styles.paidBadgeText,
                                    isDarkHud && styles.paidBadgeTextDark,
                                ]}
                            >
                                PAID IN FULL · CLEARED
                            </Text>
                        </View>
                    </View>

                    <Text
                        style={[
                            styles.equipmentTitle,
                            isDarkHud && styles.equipmentTitleDark,
                        ]}
                    >
                        {equipmentName}
                    </Text>

                    <View style={styles.clientRow}>
                        <Icon
                            color={isDarkHud ? colors.hudTextDim : colors.muted}
                            name="profile"
                            size={14}
                        />
                        <Text
                            style={[
                                styles.clientName,
                                isDarkHud && styles.clientNameDark,
                            ]}
                        >
                            Buyer: {clientName}
                        </Text>
                    </View>

                    <View style={styles.locationRow}>
                        <Icon
                            color={isDarkHud ? colors.hudTextDim : colors.muted}
                            name="location"
                            size={14}
                        />
                        <Text
                            style={[
                                styles.locationText,
                                isDarkHud && styles.locationTextDark,
                            ]}
                        >
                            {deliveryAddress}
                        </Text>
                    </View>
                </View>

                {/* Serial / VIN Verification */}
                <View style={[styles.card, isDarkHud && styles.cardDark]}>
                    <Text
                        style={[
                            styles.sectionTitle,
                            isDarkHud && styles.sectionTitleDark,
                        ]}
                    >
                        SERIAL / VIN VERIFICATION
                    </Text>
                    <View style={styles.vinInputRow}>
                        <TextInput
                            accessibilityLabel="Serial or VIN number"
                            autoCapitalize="characters"
                            onChangeText={(text) => {
                                setEnteredVin(text);
                                setVinVerified(
                                    text.trim() === vinNumber.trim(),
                                );
                            }}
                            placeholder="Enter VIN"
                            placeholderTextColor={
                                isDarkHud ? colors.hudTextDim : colors.muted
                            }
                            style={[
                                styles.vinInput,
                                isDarkHud && styles.vinInputDark,
                            ]}
                            testID="input-vin-number"
                            value={enteredVin}
                        />
                        <View
                            style={[
                                styles.vinStatusBadge,
                                vinVerified
                                    ? isDarkHud
                                        ? styles.vinValidDark
                                        : styles.vinValid
                                    : isDarkHud
                                      ? styles.vinMismatchDark
                                      : styles.vinMismatch,
                            ]}
                            testID="vin-verification-badge"
                        >
                            <Icon
                                color={
                                    vinVerified
                                        ? isDarkHud
                                            ? '#34D399'
                                            : colors.greenDark
                                        : isDarkHud
                                          ? '#F87171'
                                          : colors.redDark
                                }
                                name={vinVerified ? 'check-circle' : 'alert'}
                                size={14}
                            />
                            <Text
                                style={[
                                    styles.vinStatusText,
                                    vinVerified
                                        ? isDarkHud
                                            ? styles.vinStatusValidDark
                                            : styles.vinStatusValid
                                        : isDarkHud
                                          ? styles.vinStatusMismatchDark
                                          : styles.vinStatusMismatch,
                                ]}
                            >
                                {vinVerified ? 'MATCH' : 'MISMATCH'}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Included Accessories & Manuals */}
                <View style={[styles.card, isDarkHud && styles.cardDark]}>
                    <Text
                        style={[
                            styles.sectionTitle,
                            isDarkHud && styles.sectionTitleDark,
                        ]}
                    >
                        INCLUDED ACCESSORIES & MANUALS
                    </Text>

                    <Pressable
                        accessibilityLabel="Heavy Duty Excavator Bucket (Installed)"
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: accessories.bucket }}
                        onPress={() => toggleAccessory('bucket')}
                        style={({ pressed }) => [
                            styles.checkItem,
                            isDarkHud && styles.checkItemDark,
                            pressed && styles.checkItemPressed,
                        ]}
                        testID="check-bucket"
                    >
                        <View
                            style={[
                                styles.checkbox,
                                isDarkHud && styles.darkCheckbox,
                                accessories.bucket &&
                                    (isDarkHud
                                        ? styles.darkCheckboxSelected
                                        : styles.checkboxSelected),
                            ]}
                        >
                            {accessories.bucket ? (
                                <Icon color="#FFFFFF" name="check" size={13} />
                            ) : null}
                        </View>
                        <Text
                            style={[
                                styles.checkLabel,
                                isDarkHud && styles.checkLabelDark,
                            ]}
                        >
                            Heavy Duty Excavator Bucket (Installed)
                        </Text>
                    </Pressable>

                    <Pressable
                        accessibilityLabel="Hydraulic Quick Coupler"
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: accessories.coupler }}
                        onPress={() => toggleAccessory('coupler')}
                        style={({ pressed }) => [
                            styles.checkItem,
                            isDarkHud && styles.checkItemDark,
                            pressed && styles.checkItemPressed,
                        ]}
                        testID="check-coupler"
                    >
                        <View
                            style={[
                                styles.checkbox,
                                isDarkHud && styles.darkCheckbox,
                                accessories.coupler &&
                                    (isDarkHud
                                        ? styles.darkCheckboxSelected
                                        : styles.checkboxSelected),
                            ]}
                        >
                            {accessories.coupler ? (
                                <Icon color="#FFFFFF" name="check" size={13} />
                            ) : null}
                        </View>
                        <Text
                            style={[
                                styles.checkLabel,
                                isDarkHud && styles.checkLabelDark,
                            ]}
                        >
                            Hydraulic Quick Coupler
                        </Text>
                    </Pressable>

                    <Pressable
                        accessibilityLabel="OEM Maintenance Tool Kit & Spare Seals"
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: accessories.toolkit }}
                        onPress={() => toggleAccessory('toolkit')}
                        style={({ pressed }) => [
                            styles.checkItem,
                            isDarkHud && styles.checkItemDark,
                            pressed && styles.checkItemPressed,
                        ]}
                        testID="check-toolkit"
                    >
                        <View
                            style={[
                                styles.checkbox,
                                isDarkHud && styles.darkCheckbox,
                                accessories.toolkit &&
                                    (isDarkHud
                                        ? styles.darkCheckboxSelected
                                        : styles.checkboxSelected),
                            ]}
                        >
                            {accessories.toolkit ? (
                                <Icon color="#FFFFFF" name="check" size={13} />
                            ) : null}
                        </View>
                        <Text
                            style={[
                                styles.checkLabel,
                                isDarkHud && styles.checkLabelDark,
                            ]}
                        >
                            OEM Maintenance Tool Kit & Spare Seals
                        </Text>
                    </Pressable>

                    <Pressable
                        accessibilityLabel="DOLE-OSHC Safety & Operations Manual"
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: accessories.manual }}
                        onPress={() => toggleAccessory('manual')}
                        style={({ pressed }) => [
                            styles.checkItem,
                            isDarkHud && styles.checkItemDark,
                            styles.checkItemLast,
                            pressed && styles.checkItemPressed,
                        ]}
                        testID="check-manual"
                    >
                        <View
                            style={[
                                styles.checkbox,
                                isDarkHud && styles.darkCheckbox,
                                accessories.manual &&
                                    (isDarkHud
                                        ? styles.darkCheckboxSelected
                                        : styles.checkboxSelected),
                            ]}
                        >
                            {accessories.manual ? (
                                <Icon color="#FFFFFF" name="check" size={13} />
                            ) : null}
                        </View>
                        <Text
                            style={[
                                styles.checkLabel,
                                isDarkHud && styles.checkLabelDark,
                            ]}
                        >
                            DOLE-OSHC Safety & Operations Manual
                        </Text>
                    </Pressable>
                </View>

                {/* Delivery Notes */}
                <View style={[styles.card, isDarkHud && styles.cardDark]}>
                    <Text
                        style={[
                            styles.sectionTitle,
                            isDarkHud && styles.sectionTitleDark,
                        ]}
                    >
                        DELIVERY NOTES
                    </Text>
                    <TextInput
                        accessibilityLabel="Delivery Notes"
                        multiline
                        numberOfLines={3}
                        onChangeText={setDeliveryNotes}
                        placeholder="Note site unloading conditions, fuel status upon delivery..."
                        placeholderTextColor={
                            isDarkHud ? colors.hudTextDim : colors.muted
                        }
                        style={[
                            styles.notesInput,
                            isDarkHud && styles.notesInputDark,
                        ]}
                        testID="input-delivery-notes"
                        value={deliveryNotes}
                    />
                </View>

                {/* Buyer Acceptance & Sign-off */}
                <View style={[styles.card, isDarkHud && styles.cardDark]}>
                    <Text
                        style={[
                            styles.sectionTitle,
                            isDarkHud && styles.sectionTitleDark,
                        ]}
                    >
                        BUYER ACCEPTANCE & SIGN-OFF
                    </Text>

                    <View style={styles.inputGroup}>
                        <Text
                            style={[
                                styles.inputLabel,
                                isDarkHud && styles.inputLabelDark,
                            ]}
                        >
                            Buyer Authorized Representative
                        </Text>
                        <TextInput
                            accessibilityLabel="Buyer Authorized Representative Name"
                            onChangeText={setSigneeName}
                            placeholder="Authorized Representative Name"
                            placeholderTextColor={
                                isDarkHud ? colors.hudTextDim : colors.muted
                            }
                            style={[
                                styles.textInput,
                                isDarkHud && styles.textInputDark,
                            ]}
                            testID="input-buyer-name"
                            value={signeeName}
                        />
                    </View>

                    <View style={[styles.inputGroup, { marginTop: 10 }]}>
                        <Text
                            style={[
                                styles.inputLabel,
                                isDarkHud && styles.inputLabelDark,
                            ]}
                        >
                            Position / Designation
                        </Text>
                        <TextInput
                            accessibilityLabel="Position or Designation"
                            onChangeText={setSigneeRole}
                            placeholder="Representative Designation"
                            placeholderTextColor={
                                isDarkHud ? colors.hudTextDim : colors.muted
                            }
                            style={[
                                styles.textInput,
                                isDarkHud && styles.textInputDark,
                            ]}
                            testID="input-buyer-role"
                            value={signeeRole}
                        />
                    </View>

                    <Pressable
                        accessibilityLabel="Capture Buyer Signature"
                        accessibilityRole="button"
                        onPress={() => setSignatureModalVisible(true)}
                        style={({ pressed }) => [
                            styles.signatureBtn,
                            isDarkHud && styles.signatureBtnDark,
                            signatureCaptured &&
                                (isDarkHud
                                    ? styles.signatureBtnDoneDark
                                    : styles.signatureBtnDone),
                            pressed && styles.pressed,
                        ]}
                        testID="open-sales-signature-button"
                    >
                        <Icon
                            color={
                                signatureCaptured
                                    ? isDarkHud
                                        ? '#34D399'
                                        : colors.greenDark
                                    : isDarkHud
                                      ? '#F59E0B'
                                      : '#B45309'
                            }
                            name={
                                signatureCaptured ? 'check-circle' : 'signature'
                            }
                            size={18}
                        />
                        <Text
                            style={[
                                styles.signatureBtnText,
                                isDarkHud && styles.signatureBtnTextDark,
                                signatureCaptured &&
                                    (isDarkHud
                                        ? styles.signatureBtnTextDoneDark
                                        : styles.signatureBtnTextDone),
                            ]}
                        >
                            {signatureCaptured
                                ? '✓ Buyer Signature Verified'
                                : 'Capture Buyer Digital Signature'}
                        </Text>
                    </Pressable>
                </View>

                {/* Primary Transfer Action Button */}
                <Pressable
                    accessibilityLabel="Confirm Delivery & Complete Acceptance"
                    accessibilityRole="button"
                    onPress={handleConfirm}
                    style={({ pressed }) => [
                        styles.confirmBtn,
                        isDarkHud && styles.confirmBtnDark,
                        pressed && styles.pressed,
                    ]}
                    testID="confirm-sales-delivery-button"
                >
                    <Icon color="#FFFFFF" name="shield-check" size={20} />
                    <Text style={styles.confirmBtnText}>
                        CONFIRM DELIVERY & ACCEPTANCE
                    </Text>
                </Pressable>
            </ScrollView>

            <DigitalSignatureModal
                clientName={clientName}
                jobReference={orderReference}
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
    darkScreen: {
        backgroundColor: colors.hudBackground,
    },
    orderPill: {
        backgroundColor: colors.amberLight,
        borderColor: colors.amberBorder,
        borderRadius: 8,
        borderWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    orderPillDark: {
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        borderColor: 'rgba(245, 158, 11, 0.4)',
    },
    orderPillText: {
        color: colors.amberDark,
        fontSize: 11,
        fontWeight: '700',
    },
    orderPillTextDark: {
        color: '#FDE68A',
    },
    scrollContent: {
        alignSelf: 'center',
        maxWidth: 720,
        padding: 16,
        paddingBottom: 36,
        width: '100%',
    },
    card: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 14,
        padding: 16,
        ...shadows.sm,
    },
    cardDark: {
        backgroundColor: colors.hudSurface,
        borderColor: colors.hudBorder,
        elevation: 0,
        shadowOpacity: 0,
    },
    cardHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    categoryLabel: {
        color: colors.muted,
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    categoryLabelDark: {
        color: colors.hudTextDim,
    },
    paidBadge: {
        alignItems: 'center',
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
        borderRadius: 6,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    paidBadgeDark: {
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        borderColor: 'rgba(16, 185, 129, 0.4)',
    },
    paidBadgeText: {
        color: colors.greenDark,
        fontSize: 10,
        fontWeight: '700',
    },
    paidBadgeTextDark: {
        color: '#34D399',
    },
    equipmentTitle: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '800',
        marginTop: 2,
    },
    equipmentTitleDark: {
        color: colors.hudText,
    },
    clientRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6,
        marginTop: 8,
    },
    clientName: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '600',
    },
    clientNameDark: {
        color: colors.hudText,
    },
    locationRow: {
        alignItems: 'flex-start',
        flexDirection: 'row',
        gap: 6,
        marginTop: 4,
    },
    locationText: {
        color: colors.muted,
        flex: 1,
        fontSize: 12,
    },
    locationTextDark: {
        color: colors.hudTextDim,
    },
    sectionTitle: {
        color: colors.muted,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.6,
        marginBottom: 12,
    },
    sectionTitleDark: {
        color: colors.hudTextDim,
    },
    vinInputRow: {
        flexDirection: 'row',
        gap: 8,
    },
    vinInput: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        color: colors.text,
        flex: 1,
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 1,
        minHeight: 46,
        paddingHorizontal: 12,
    },
    vinInputDark: {
        backgroundColor: '#0F172A',
        borderColor: colors.hudBorder,
        color: colors.hudText,
    },
    vinStatusBadge: {
        alignItems: 'center',
        borderRadius: 8,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 4,
        minHeight: 46,
        paddingHorizontal: 10,
    },
    vinValid: {
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
    },
    vinValidDark: {
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        borderColor: 'rgba(16, 185, 129, 0.4)',
    },
    vinMismatch: {
        backgroundColor: colors.redLight,
        borderColor: colors.redBorder,
    },
    vinMismatchDark: {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        borderColor: 'rgba(239, 68, 68, 0.5)',
    },
    vinStatusText: {
        fontSize: 11,
        fontWeight: '800',
    },
    vinStatusValid: {
        color: colors.greenDark,
    },
    vinStatusValidDark: {
        color: '#34D399',
    },
    vinStatusMismatch: {
        color: colors.redDark,
    },
    vinStatusMismatchDark: {
        color: '#F87171',
    },
    checkItem: {
        alignItems: 'center',
        borderBottomColor: colors.border,
        borderBottomWidth: 1,
        flexDirection: 'row',
        gap: 12,
        minHeight: 48,
        paddingVertical: 10,
    },
    checkItemDark: {
        borderBottomColor: colors.hudBorder,
    },
    checkItemLast: {
        borderBottomWidth: 0,
    },
    checkbox: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.borderStrong,
        borderRadius: 6,
        borderWidth: 1.5,
        height: 22,
        justifyContent: 'center',
        width: 22,
    },
    darkCheckbox: {
        backgroundColor: '#0F172A',
        borderColor: '#475569',
    },
    checkboxSelected: {
        backgroundColor: colors.green,
        borderColor: colors.green,
    },
    darkCheckboxSelected: {
        backgroundColor: '#059669',
        borderColor: '#10B981',
    },
    checkLabel: {
        color: colors.text,
        flex: 1,
        fontSize: 13,
        fontWeight: '500',
    },
    checkLabelDark: {
        color: colors.hudText,
    },
    notesInput: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        color: colors.text,
        fontSize: 13,
        minHeight: 70,
        padding: 12,
        textAlignVertical: 'top',
    },
    notesInputDark: {
        backgroundColor: '#0F172A',
        borderColor: colors.hudBorder,
        color: colors.hudText,
    },
    inputGroup: {
        marginBottom: 6,
    },
    inputLabel: {
        color: colors.text,
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 6,
    },
    inputLabelDark: {
        color: colors.hudText,
    },
    textInput: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        color: colors.text,
        fontSize: 13,
        fontWeight: '600',
        minHeight: 46,
        paddingHorizontal: 12,
    },
    textInputDark: {
        backgroundColor: '#0F172A',
        borderColor: colors.hudBorder,
        color: colors.hudText,
    },
    signatureBtn: {
        alignItems: 'center',
        backgroundColor: colors.amberLight,
        borderColor: colors.amberBorder,
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
        marginTop: 12,
        minHeight: 48,
        padding: 12,
    },
    signatureBtnDark: {
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        borderColor: 'rgba(245, 158, 11, 0.45)',
    },
    signatureBtnDone: {
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
    },
    signatureBtnDoneDark: {
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        borderColor: 'rgba(16, 185, 129, 0.45)',
    },
    signatureBtnText: {
        color: colors.amberDark,
        fontSize: 13,
        fontWeight: '700',
    },
    signatureBtnTextDark: {
        color: '#FDE68A',
    },
    signatureBtnTextDone: {
        color: colors.greenDark,
    },
    signatureBtnTextDoneDark: {
        color: '#34D399',
    },
    confirmBtn: {
        alignItems: 'center',
        backgroundColor: colors.amber,
        borderRadius: 12,
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
        marginBottom: 24,
        minHeight: 52,
        padding: 14,
        ...shadows.md,
    },
    confirmBtnDark: {
        backgroundColor: colors.amber,
        borderColor: 'rgba(245, 158, 11, 0.5)',
        borderWidth: 1,
        elevation: 0,
        shadowOpacity: 0,
    },
    confirmBtnText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    checkItemPressed: {
        opacity: 0.85,
        transform: [{ scale: 0.985 }],
    },
    pressed: {
        opacity: 0.82,
        transform: [{ scale: 0.96 }],
    },
});
