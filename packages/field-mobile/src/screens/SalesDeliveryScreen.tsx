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
import { colors, shadows } from '../components/nativeStyles';
import { DigitalSignatureModal } from '../components/signature/DigitalSignatureModal';

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
        });
    };

    return (
        <View style={styles.screen} testID="sales-delivery-screen">
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
                    testID="sales-back-button"
                >
                    <Icon name="back" size={20} color={colors.text} />
                </Pressable>
                <View style={styles.headerTitles}>
                    <Text style={styles.screenTitle}>
                        Equipment Sales Delivery
                    </Text>
                    <Text style={styles.headerSubtitle}>
                        Alibaton Heavy Equipment Sales · PH
                    </Text>
                </View>
                <View style={styles.orderPill}>
                    <Text style={styles.orderPillText}>{orderReference}</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Order & Asset Summary Card */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.categoryLabel}>EQUIPMENT SALE</Text>
                        <View style={styles.paidBadge}>
                            <Text style={styles.paidBadgeText}>
                                CORE-1 PAID · CLEARED
                            </Text>
                        </View>
                    </View>

                    <Text style={styles.equipmentTitle}>{equipmentName}</Text>

                    <View style={styles.clientRow}>
                        <Icon name="profile" size={14} color={colors.muted} />
                        <Text style={styles.clientName}>
                            Buyer: {clientName}
                        </Text>
                    </View>

                    <View style={styles.locationRow}>
                        <Icon name="location" size={14} color={colors.muted} />
                        <Text style={styles.locationText}>
                            {deliveryAddress}
                        </Text>
                    </View>
                </View>

                {/* VIN / Serial Number Verification */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>
                        PHYSICAL SERIAL / VIN VERIFICATION
                    </Text>
                    <View style={styles.vinInputRow}>
                        <TextInput
                            autoCapitalize="characters"
                            onChangeText={(text) => {
                                setEnteredVin(text);
                                setVinVerified(
                                    text.trim() === vinNumber.trim(),
                                );
                            }}
                            style={styles.vinInput}
                            testID="input-vin-number"
                            value={enteredVin}
                        />
                        <View
                            style={[
                                styles.vinStatusBadge,
                                vinVerified
                                    ? styles.vinValid
                                    : styles.vinMismatch,
                            ]}
                            testID="vin-verification-badge"
                        >
                            <Icon
                                name={vinVerified ? 'check-circle' : 'alert'}
                                size={14}
                                color={
                                    vinVerified
                                        ? colors.greenDark
                                        : colors.redDark
                                }
                            />
                            <Text
                                style={[
                                    styles.vinStatusText,
                                    vinVerified
                                        ? styles.vinStatusValid
                                        : styles.vinStatusMismatch,
                                ]}
                            >
                                {vinVerified ? 'MATCH' : 'MISMATCH'}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Accessories & Handover Inclusions */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>
                        INCLUDED ACCESSORIES & DOCUMENTATION
                    </Text>

                    <Pressable
                        accessibilityRole="checkbox"
                        onPress={() => toggleAccessory('bucket')}
                        style={styles.checkItem}
                        testID="check-bucket"
                    >
                        <Icon
                            name={accessories.bucket ? 'check-circle' : 'close'}
                            size={18}
                            color={
                                accessories.bucket
                                    ? colors.greenDark
                                    : colors.muted
                            }
                        />
                        <Text style={styles.checkLabel}>
                            Heavy Duty Excavator Bucket (Installed)
                        </Text>
                    </Pressable>

                    <Pressable
                        accessibilityRole="checkbox"
                        onPress={() => toggleAccessory('coupler')}
                        style={styles.checkItem}
                        testID="check-coupler"
                    >
                        <Icon
                            name={
                                accessories.coupler ? 'check-circle' : 'close'
                            }
                            size={18}
                            color={
                                accessories.coupler
                                    ? colors.greenDark
                                    : colors.muted
                            }
                        />
                        <Text style={styles.checkLabel}>
                            Hydraulic Quick Coupler
                        </Text>
                    </Pressable>

                    <Pressable
                        accessibilityRole="checkbox"
                        onPress={() => toggleAccessory('toolkit')}
                        style={styles.checkItem}
                        testID="check-toolkit"
                    >
                        <Icon
                            name={
                                accessories.toolkit ? 'check-circle' : 'close'
                            }
                            size={18}
                            color={
                                accessories.toolkit
                                    ? colors.greenDark
                                    : colors.muted
                            }
                        />
                        <Text style={styles.checkLabel}>
                            OEM Maintenance Tool Kit & Spare Seals
                        </Text>
                    </Pressable>

                    <Pressable
                        accessibilityRole="checkbox"
                        onPress={() => toggleAccessory('manual')}
                        style={styles.checkItem}
                        testID="check-manual"
                    >
                        <Icon
                            name={accessories.manual ? 'check-circle' : 'close'}
                            size={18}
                            color={
                                accessories.manual
                                    ? colors.greenDark
                                    : colors.muted
                            }
                        />
                        <Text style={styles.checkLabel}>
                            DOLE-OSHC Safety & Operations Manual
                        </Text>
                    </Pressable>
                </View>

                {/* Delivery Notes */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>DELIVERY NOTES</Text>
                    <TextInput
                        multiline
                        numberOfLines={3}
                        onChangeText={setDeliveryNotes}
                        placeholder="Note site unloading conditions, fuel status upon delivery..."
                        placeholderTextColor={colors.muted}
                        style={styles.notesInput}
                        testID="input-delivery-notes"
                        value={deliveryNotes}
                    />
                </View>

                {/* Buyer Sign-off & Title Handover */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>
                        BUYER TITLE HANDOVER SIGN-OFF
                    </Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>
                            Buyer Authorized Representative
                        </Text>
                        <TextInput
                            onChangeText={setSigneeName}
                            style={styles.textInput}
                            testID="input-buyer-name"
                            value={signeeName}
                        />
                    </View>

                    <View style={[styles.inputGroup, { marginTop: 10 }]}>
                        <Text style={styles.inputLabel}>
                            Position / Designation
                        </Text>
                        <TextInput
                            onChangeText={setSigneeRole}
                            style={styles.textInput}
                            testID="input-buyer-role"
                            value={signeeRole}
                        />
                    </View>

                    <Pressable
                        accessibilityLabel="Capture Customer Signature"
                        accessibilityRole="button"
                        onPress={() => setSignatureModalVisible(true)}
                        style={[
                            styles.signatureBtn,
                            signatureCaptured && styles.signatureBtnDone,
                        ]}
                        testID="open-sales-signature-button"
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
                                ? '✓ Buyer Signature Verified'
                                : 'Capture Buyer Digital Signature'}
                        </Text>
                    </Pressable>
                </View>

                {/* Primary Transfer Action Button */}
                <Pressable
                    accessibilityLabel="Confirm Delivery & Complete Title Transfer"
                    accessibilityRole="button"
                    onPress={handleConfirm}
                    style={({ pressed }) => [
                        styles.confirmBtn,
                        pressed && styles.pressed,
                    ]}
                    testID="confirm-sales-delivery-button"
                >
                    <Icon name="shield-check" size={20} color="#FFFFFF" />
                    <Text style={styles.confirmBtnText}>
                        CONFIRM DELIVERY & COMPLETE TITLE TRANSFER
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
    orderPill: {
        backgroundColor: colors.amberLight,
        borderColor: colors.amberBorder,
        borderRadius: 8,
        borderWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    orderPillText: {
        color: colors.amberDark,
        fontSize: 11,
        fontWeight: '700',
    },
    scrollContent: {
        padding: 16,
    },
    card: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 14,
        padding: 14,
        ...shadows.sm,
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
    paidBadge: {
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
        borderRadius: 6,
        borderWidth: 1,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    paidBadgeText: {
        color: colors.greenDark,
        fontSize: 10,
        fontWeight: '700',
    },
    equipmentTitle: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '800',
        marginTop: 2,
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
    sectionTitle: {
        color: colors.muted,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.5,
        marginBottom: 10,
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
        minHeight: 44,
        paddingHorizontal: 12,
    },
    vinStatusBadge: {
        alignItems: 'center',
        borderRadius: 8,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 4,
        paddingHorizontal: 10,
    },
    vinValid: {
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
    },
    vinMismatch: {
        backgroundColor: colors.redLight,
        borderColor: colors.redBorder,
    },
    vinStatusText: {
        fontSize: 11,
        fontWeight: '800',
    },
    vinStatusValid: {
        color: colors.greenDark,
    },
    vinStatusMismatch: {
        color: colors.redDark,
    },
    checkItem: {
        alignItems: 'center',
        borderBottomColor: colors.border,
        borderBottomWidth: 1,
        flexDirection: 'row',
        gap: 10,
        paddingVertical: 10,
    },
    checkLabel: {
        color: colors.text,
        flex: 1,
        fontSize: 13,
        fontWeight: '500',
    },
    notesInput: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        color: colors.text,
        fontSize: 13,
        minHeight: 60,
        padding: 10,
        textAlignVertical: 'top',
    },
    inputGroup: {
        marginBottom: 4,
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
        fontSize: 13,
        fontWeight: '600',
        minHeight: 44,
        paddingHorizontal: 12,
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
        marginTop: 12,
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
        backgroundColor: colors.surfaceDark,
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
        fontSize: 13,
        fontWeight: '800',
    },
    pressed: {
        opacity: 0.8,
        transform: [{ scale: 0.985 }],
    },
});
