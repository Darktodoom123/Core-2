import React, { useRef, useState } from 'react';
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
import { TileScreenHeader } from '../components/layout/tile-screen-header';
import { colors, shadows } from '../components/nativeStyles';
import { DigitalSignatureModal } from '../components/signature/DigitalSignatureModal';
import { durableAttachmentStorage } from '../services/durableAttachmentStorage';
import { useTheme } from '../theme';
import type { AssetAssignment } from '../types';

type DeliveryAssetOption = Pick<
    AssetAssignment,
    'operational_asset_id' | 'asset_code' | 'asset_name'
>;

export interface SalesDeliveryScreenProps {
    jobId?: number;
    orderId?: string | number;
    orderReference?: string;
    clientName?: string;
    assetId?: number;
    equipmentName?: string;
    assignedAssets?: DeliveryAssetOption[];
    actorId?: number | string;
    vinNumber?: string;
    deliveryAddress?: string;
    syncStatus?:
        'idle' | 'saving' | 'queued' | 'submitting' | 'success' | 'failed';
    syncErrorMessage?: string | null;
    onBack?: () => void;
    onCompleteDelivery?: (data: SalesDeliveryData) => void | Promise<void>;
    onRetrySync?: () => void;
}

export interface SalesDeliveryData {
    jobId?: number;
    orderId?: number;
    assetId?: number;
    verifiedVin: string;
    accessoriesChecked: string[];
    signeeName: string;
    signeeRole: string;
    notes: string;
    photos?: PhotoAttachment[];
    signatureBase64?: string;
}

export const SalesDeliveryScreen: React.FC<SalesDeliveryScreenProps> = ({
    jobId,
    orderId,
    orderReference = 'SO-2026-0091',
    clientName = 'San Miguel Infrastructure Corp.',
    assetId,
    equipmentName = 'Caterpillar 320 GC Hydraulic Excavator',
    assignedAssets = [],
    actorId = '1',
    vinNumber = 'CAT0320GC88912',
    deliveryAddress = 'North-South Commuter Railway (NSCR) Project - Depot Area, Bulacan, PH',
    syncStatus: propSyncStatus,
    syncErrorMessage: propSyncErrorMessage,
    onBack,
    onCompleteDelivery,
    onRetrySync,
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
    const [photos, setPhotos] = useState<PhotoAttachment[]>([]);
    const [signatureModalVisible, setSignatureModalVisible] = useState(false);
    const [signatureCaptured, setSignatureCaptured] = useState(false);
    const [signatureData, setSignatureData] = useState<string | undefined>(
        undefined,
    );
    const [localSyncStatus, setLocalSyncStatus] = useState<
        'idle' | 'saving' | 'queued' | 'submitting' | 'success' | 'failed'
    >('idle');
    const [localErrorMessage, setLocalErrorMessage] = useState<string | null>(
        null,
    );
    const [selectedAssetId, setSelectedAssetId] = useState<number | null>(
        assetId ??
            (assignedAssets.length === 1
                ? assignedAssets[0].operational_asset_id
                : null),
    );
    const [assetSelectionError, setAssetSelectionError] = useState<
        string | null
    >(null);
    const submitInFlightRef = useRef(false);

    const selectedAsset = assignedAssets.find(
        (asset) => asset.operational_asset_id === selectedAssetId,
    );
    const displayedEquipmentName =
        selectedAsset?.asset_name ??
        (assignedAssets.length > 1
            ? 'Choose the assigned machine covered by this evidence'
            : equipmentName);

    const activeSyncStatus = propSyncStatus ?? localSyncStatus;
    const isServerConfirmedSuccess = propSyncStatus === 'success';
    const activeErrorMessage = propSyncErrorMessage ?? localErrorMessage;
    const isSubmitting =
        activeSyncStatus === 'submitting' || activeSyncStatus === 'saving';

    const toggleAccessory = (key: string) => {
        setAccessories((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

    const handleConfirm = async () => {
        if (submitInFlightRef.current) {
            return;
        }

        if (assignedAssets.length > 1 && !selectedAsset) {
            setAssetSelectionError(
                'Select the assigned machine covered by this evidence before submitting.',
            );

            return;
        }

        setAssetSelectionError(null);
        submitInFlightRef.current = true;
        const checkedList = Object.keys(accessories).filter(
            (k) => accessories[k],
        );
        const signaturePayload =
            signatureData ||
            (signatureCaptured
                ? 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
                : undefined);

        setLocalSyncStatus('saving');
        setLocalErrorMessage(null);

        try {
            // Durable attachment persistence: copy temporary photos to durable storage before queueing/reporting saved
            const durablePhotos: PhotoAttachment[] = [];

            for (const photo of photos) {
                const stored =
                    await durableAttachmentStorage.saveAttachmentDurably(
                        {
                            uri: photo.uri,
                            base64: photo.base64,
                            fileName: photo.fileName,
                        },
                        actorId,
                    );
                durablePhotos.push({
                    uri: stored.uri,
                    fileName: stored.fileName,
                    fileSize: stored.fileSize ?? photo.fileSize,
                    base64: photo.base64,
                });
            }

            setLocalSyncStatus('submitting');

            const numericOrderId =
                typeof orderId === 'number'
                    ? orderId
                    : orderId
                      ? parseInt(String(orderId), 10)
                      : undefined;

            await onCompleteDelivery?.({
                jobId,
                orderId: numericOrderId,
                assetId: selectedAssetId ?? assetId,
                verifiedVin: enteredVin,
                accessoriesChecked: checkedList,
                signeeName,
                signeeRole,
                notes:
                    deliveryNotes ||
                    'Unit delivered in brand new operational condition to customer site.',
                photos: durablePhotos,
                signatureBase64: signaturePayload,
            });
            setLocalSyncStatus('success');
        } catch (err: unknown) {
            setLocalSyncStatus('failed');
            setLocalErrorMessage(
                err instanceof Error
                    ? err.message
                    : 'Delivery submission failed.',
            );
        } finally {
            submitInFlightRef.current = false;
        }
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
                        {displayedEquipmentName}
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

                {assignedAssets.length > 1 && (
                    <View
                        style={[
                            styles.assetSelectorCard,
                            isDarkHud && styles.assetSelectorCardDark,
                        ]}
                        testID="sales-asset-selector"
                    >
                        <Text
                            style={[
                                styles.sectionTitle,
                                isDarkHud && styles.sectionTitleDark,
                            ]}
                        >
                            EVIDENCE ASSET (REQUIRED)
                        </Text>
                        <Text
                            style={[
                                styles.assetSelectorHint,
                                isDarkHud && styles.assetSelectorHintDark,
                            ]}
                        >
                            Choose which assigned machine this delivery covers.
                        </Text>
                        <View
                            accessibilityRole="radiogroup"
                            style={styles.assetSelectorList}
                        >
                            {assignedAssets.map((asset) => {
                                const isSelected =
                                    selectedAssetId ===
                                    asset.operational_asset_id;

                                return (
                                    <Pressable
                                        accessibilityLabel={`Select ${asset.asset_code}, ${asset.asset_name}`}
                                        accessibilityRole="radio"
                                        accessibilityState={{
                                            selected: isSelected,
                                        }}
                                        key={asset.operational_asset_id}
                                        onPress={() => {
                                            setSelectedAssetId(
                                                asset.operational_asset_id,
                                            );
                                            setAssetSelectionError(null);
                                        }}
                                        style={[
                                            styles.assetSelectorOption,
                                            isDarkHud &&
                                                styles.assetSelectorOptionDark,
                                            isSelected &&
                                                (isDarkHud
                                                    ? styles.assetSelectorOptionSelectedDark
                                                    : styles.assetSelectorOptionSelected),
                                        ]}
                                        testID={`sales-asset-${asset.operational_asset_id}`}
                                    >
                                        <View style={styles.assetSelectorCopy}>
                                            <Text
                                                style={[
                                                    styles.assetSelectorCode,
                                                    isDarkHud &&
                                                        styles.assetSelectorCodeDark,
                                                ]}
                                            >
                                                {asset.asset_code}
                                            </Text>
                                            <Text
                                                numberOfLines={2}
                                                style={[
                                                    styles.assetSelectorName,
                                                    isDarkHud &&
                                                        styles.assetSelectorNameDark,
                                                ]}
                                            >
                                                {asset.asset_name}
                                            </Text>
                                        </View>
                                        <View
                                            style={[
                                                styles.assetSelectorRadio,
                                                isSelected &&
                                                    styles.assetSelectorRadioSelected,
                                            ]}
                                        >
                                            {isSelected && (
                                                <View
                                                    style={
                                                        styles.assetSelectorRadioInner
                                                    }
                                                />
                                            )}
                                        </View>
                                    </Pressable>
                                );
                            })}
                        </View>
                        {assetSelectionError && (
                            <Text
                                accessibilityRole="alert"
                                style={styles.assetSelectionError}
                            >
                                {assetSelectionError}
                            </Text>
                        )}
                    </View>
                )}

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

                {/* Delivery Evidence Photos */}
                <View style={[styles.card, isDarkHud && styles.cardDark]}>
                    <PhotoAttachmentPicker
                        attachments={photos}
                        maxCount={6}
                        onAddAttachment={(att) =>
                            setPhotos((prev) => [...prev, att])
                        }
                        onRemoveAttachment={(idx) =>
                            setPhotos((prev) =>
                                prev.filter((_, i) => i !== idx),
                            )
                        }
                        style={[
                            styles.embeddedPhotoPicker,
                            isDarkHud && styles.embeddedPhotoPickerDark,
                        ]}
                        testID="sales-photo-attachment-picker"
                        title="Delivery Evidence Photos"
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

                {/* Offline Outbox & Sync State Banner */}
                {activeSyncStatus !== 'idle' && (
                    <View
                        accessibilityLiveRegion="polite"
                        accessibilityRole={
                            activeSyncStatus === 'failed' ? 'alert' : 'summary'
                        }
                        style={[
                            styles.syncBanner,
                            activeSyncStatus === 'submitting' ||
                            activeSyncStatus === 'saving'
                                ? isDarkHud
                                    ? styles.syncBannerSubmittingDark
                                    : styles.syncBannerSubmitting
                                : activeSyncStatus === 'queued'
                                  ? isDarkHud
                                      ? styles.syncBannerQueuedDark
                                      : styles.syncBannerQueued
                                  : activeSyncStatus === 'success'
                                    ? isDarkHud
                                        ? styles.syncBannerSuccessDark
                                        : styles.syncBannerSuccess
                                    : isDarkHud
                                      ? styles.syncBannerFailedDark
                                      : styles.syncBannerFailed,
                        ]}
                        testID="sync-status-banner"
                    >
                        <Icon
                            color={
                                activeSyncStatus === 'submitting' ||
                                activeSyncStatus === 'saving'
                                    ? isDarkHud
                                        ? '#93C5FD'
                                        : colors.blue
                                    : activeSyncStatus === 'queued'
                                      ? isDarkHud
                                          ? '#FCD34D'
                                          : colors.amberDark
                                      : activeSyncStatus === 'success'
                                        ? isDarkHud
                                            ? '#34D399'
                                            : colors.greenDark
                                        : isDarkHud
                                          ? '#F87171'
                                          : colors.red
                            }
                            name={
                                activeSyncStatus === 'submitting' ||
                                activeSyncStatus === 'saving'
                                    ? 'sync'
                                    : activeSyncStatus === 'queued'
                                      ? 'clock'
                                      : activeSyncStatus === 'success'
                                        ? 'check-circle'
                                        : 'alert-circle'
                            }
                            size={18}
                        />
                        <View style={styles.syncBannerContent}>
                            <Text
                                style={[
                                    styles.syncBannerTitle,
                                    isDarkHud && styles.syncBannerTitleDark,
                                ]}
                            >
                                {activeSyncStatus === 'submitting' ||
                                activeSyncStatus === 'saving'
                                    ? 'Uploading & Synchronizing…'
                                    : activeSyncStatus === 'queued'
                                      ? 'Saved on Device (Waiting to Sync)'
                                      : activeSyncStatus === 'success'
                                        ? isServerConfirmedSuccess
                                            ? 'Server Confirmed'
                                            : 'Saved for Synchronization'
                                        : 'Submission Failed'}
                            </Text>
                            <Text
                                style={[
                                    styles.syncBannerSubtitle,
                                    isDarkHud && styles.syncBannerSubtitleDark,
                                ]}
                            >
                                {activeSyncStatus === 'submitting' ||
                                activeSyncStatus === 'saving'
                                    ? 'Uploading delivery evidence to operations desk.'
                                    : activeSyncStatus === 'queued'
                                      ? 'Evidence securely stored in offline outbox. It will synchronize automatically when connection is restored.'
                                      : activeSyncStatus === 'success'
                                        ? isServerConfirmedSuccess
                                            ? 'Operations confirmed receipt of this delivery evidence.'
                                            : 'Delivery evidence was saved to the outbox. Check synchronization status for server receipt.'
                                        : activeErrorMessage ||
                                          'Unable to complete submission. Tap retry to re-attempt.'}
                            </Text>
                        </View>
                        {activeSyncStatus === 'failed' && (
                            <Pressable
                                accessibilityLabel="Retry synchronization"
                                accessibilityRole="button"
                                onPress={() => {
                                    if (onRetrySync) {
                                        onRetrySync();
                                    } else {
                                        void handleConfirm();
                                    }
                                }}
                                style={styles.syncRetryButton}
                                testID="sync-retry-button"
                            >
                                <Text style={styles.syncRetryButtonText}>
                                    Retry
                                </Text>
                            </Pressable>
                        )}
                    </View>
                )}

                {/* Primary Transfer Action Button */}
                <Pressable
                    accessibilityLabel="Confirm Delivery & Complete Acceptance"
                    accessibilityRole="button"
                    accessibilityState={{
                        busy: isSubmitting,
                        disabled: isSubmitting,
                    }}
                    disabled={isSubmitting}
                    onPress={handleConfirm}
                    style={({ pressed }) => [
                        styles.confirmBtn,
                        isDarkHud && styles.confirmBtnDark,
                        isSubmitting && styles.confirmBtnDisabled,
                        pressed && !isSubmitting && styles.pressed,
                    ]}
                    testID="confirm-sales-delivery-button"
                >
                    <Icon color="#FFFFFF" name="shield-check" size={20} />
                    <Text style={styles.confirmBtnText}>
                        {isSubmitting
                            ? 'SUBMITTING EVIDENCE…'
                            : 'CONFIRM DELIVERY & ACCEPTANCE'}
                    </Text>
                </Pressable>
            </ScrollView>

            <DigitalSignatureModal
                clientName={clientName}
                jobReference={orderReference}
                onClose={() => setSignatureModalVisible(false)}
                onConfirmSignature={(data) => {
                    setSignatureCaptured(true);

                    if (data?.signerName) {
                        setSigneeName(data.signerName);
                    }

                    if (data?.signerRole) {
                        setSigneeRole(data.signerRole);
                    }

                    const base64Sig = `data:image/svg+xml;base64,${typeof btoa === 'function' ? btoa(JSON.stringify(data?.strokes || [])) : Buffer.from(JSON.stringify(data?.strokes || [])).toString('base64')}`;
                    setSignatureData(base64Sig);
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
    assetSelectorCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 14,
        padding: 16,
    },
    assetSelectorCardDark: {
        backgroundColor: colors.hudSurface,
        borderColor: colors.hudBorder,
    },
    assetSelectorHint: {
        color: colors.secondary,
        fontSize: 13,
        marginBottom: 10,
        marginTop: 4,
    },
    assetSelectorHintDark: {
        color: colors.hudTextDim,
    },
    assetSelectorList: {
        gap: 8,
    },
    assetSelectorOption: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        minHeight: 48,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    assetSelectorOptionDark: {
        backgroundColor: colors.hudSurface,
        borderColor: colors.hudBorder,
    },
    assetSelectorOptionSelected: {
        backgroundColor: colors.amberLight,
        borderColor: colors.amber,
    },
    assetSelectorOptionSelectedDark: {
        backgroundColor: 'rgba(245, 158, 11, 0.16)',
        borderColor: colors.amber,
    },
    assetSelectorCopy: {
        flex: 1,
        minWidth: 0,
    },
    assetSelectorCode: {
        color: colors.amberDark,
        fontSize: 12,
        fontWeight: '800',
    },
    assetSelectorCodeDark: {
        color: '#FDE68A',
    },
    assetSelectorName: {
        color: colors.text,
        fontSize: 13,
        marginTop: 2,
    },
    assetSelectorNameDark: {
        color: colors.hudText,
    },
    assetSelectorRadio: {
        alignItems: 'center',
        borderColor: colors.muted,
        borderRadius: 10,
        borderWidth: 1.5,
        height: 20,
        justifyContent: 'center',
        marginLeft: 10,
        width: 20,
    },
    assetSelectorRadioSelected: {
        borderColor: colors.amber,
    },
    assetSelectorRadioInner: {
        backgroundColor: colors.amber,
        borderRadius: 5,
        height: 10,
        width: 10,
    },
    assetSelectionError: {
        color: colors.red,
        fontSize: 12,
        fontWeight: '600',
        marginTop: 8,
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
        minHeight: 48,
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
        minHeight: 48,
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
        minHeight: 48,
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
    embeddedPhotoPicker: {
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        borderWidth: 0,
        marginTop: 0,
        padding: 0,
    },
    embeddedPhotoPickerDark: {
        backgroundColor: 'transparent',
        borderColor: 'transparent',
    },
    syncBanner: {
        alignItems: 'flex-start',
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
        padding: 14,
    },
    syncBannerSubmitting: {
        backgroundColor: '#EFF6FF',
        borderColor: '#BFDBFE',
    },
    syncBannerSubmittingDark: {
        backgroundColor: '#1E293B',
        borderColor: '#3B82F6',
    },
    syncBannerQueued: {
        backgroundColor: '#FFFBEB',
        borderColor: '#FDE68A',
    },
    syncBannerQueuedDark: {
        backgroundColor: '#451A03',
        borderColor: '#D97706',
    },
    syncBannerSuccess: {
        backgroundColor: '#ECFDF5',
        borderColor: '#A7F3D0',
    },
    syncBannerSuccessDark: {
        backgroundColor: '#064E3B',
        borderColor: '#059669',
    },
    syncBannerFailed: {
        backgroundColor: '#FEF2F2',
        borderColor: '#FECACA',
    },
    syncBannerFailedDark: {
        backgroundColor: '#450A0A',
        borderColor: '#DC2626',
    },
    syncBannerContent: {
        flex: 1,
    },
    syncBannerTitle: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 2,
    },
    syncBannerTitleDark: {
        color: '#FFFFFF',
    },
    syncBannerSubtitle: {
        color: colors.muted,
        fontSize: 12,
        lineHeight: 16,
    },
    syncBannerSubtitleDark: {
        color: colors.hudTextDim,
    },
    syncRetryButton: {
        alignSelf: 'center',
        backgroundColor: colors.amber,
        borderRadius: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    syncRetryButtonText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    confirmBtnDisabled: {
        opacity: 0.5,
    },
});
