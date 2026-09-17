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
import { TileScreenHeader } from '../components/layout/tile-screen-header';
import { colors, shadows } from '../components/nativeStyles';
import { DigitalSignatureModal } from '../components/signature/DigitalSignatureModal';
import { durableAttachmentStorage } from '../services/durableAttachmentStorage';
import { useTheme } from '../theme';

export interface RentalHandoverScreenProps {
    jobId?: number;
    reservationId?: string | number;
    reservationReference?: string;
    clientName?: string;
    assetId?: number;
    assetName?: string;
    assetCode?: string;
    actorId?: number | string;
    mode?: 'checkout' | 'return';
    syncStatus?:
        'idle' | 'saving' | 'queued' | 'submitting' | 'success' | 'failed';
    syncErrorMessage?: string | null;
    onBack?: () => void;
    onCompleteCheckout?: (data: RentalCheckoutData) => void | Promise<void>;
    onCompleteReturn?: (data: RentalReturnData) => void | Promise<void>;
    onRetrySync?: () => void;
}

export interface RentalCheckoutData {
    jobId?: number;
    reservationId?: number;
    assetId?: number;
    hourMeter: number;
    fuelLevelPercent: number;
    conditionAssessment?: 'excellent' | 'good' | 'fair' | 'poor';
    conditionNotes: string;
    damageNoted?: boolean;
    damageNotes?: string;
    photos: PhotoAttachment[];
    signatureBase64?: string;
    signeeName: string;
    signeeRole?: string;
}

export interface RentalReturnData {
    jobId?: number;
    reservationId?: number;
    assetId?: number;
    hourMeter: number;
    fuelLevelPercent: number;
    conditionAssessment?: 'excellent' | 'good' | 'fair' | 'poor';
    conditionNotes: string;
    damageNoted: boolean;
    damageNotes?: string;
    photos: PhotoAttachment[];
    signatureBase64?: string;
    signeeName: string;
    signeeRole?: string;
}

export const RentalHandoverScreen: React.FC<RentalHandoverScreenProps> = ({
    jobId,
    reservationId,
    reservationReference = 'REN-2026-0412',
    clientName = 'DMCI Construction & Power Inc.',
    assetId,
    assetName = '50T Tadano All-Terrain Crane',
    assetCode = 'ALB-CRN-050',
    actorId = '1',
    mode: initialMode = 'checkout',
    syncStatus: propSyncStatus,
    syncErrorMessage: propSyncErrorMessage,
    onBack,
    onCompleteCheckout,
    onCompleteReturn,
    onRetrySync,
}) => {
    const { isDarkHud } = useTheme();
    const [mode, setMode] = useState<'checkout' | 'return'>(initialMode);
    const [hourMeter, setHourMeter] = useState('1420.5');
    const [fuelLevel, setFuelLevel] = useState('100');
    const [conditionNotes, setConditionNotes] = useState('');
    const [damageNoted, setDamageNoted] = useState(false);
    const [photos, setPhotos] = useState<PhotoAttachment[]>([]);
    const [signeeName, setSigneeName] = useState('Engr. Antonio Santos');
    const [signatureModalVisible, setSignatureModalVisible] = useState(false);
    const [signatureCaptured, setSignatureCaptured] = useState(false);
    const [signatureData, setSignatureData] = useState<string | undefined>(
        undefined,
    );
    const [signeeRole, setSigneeRole] = useState('Site Supervisor');
    const [localSyncStatus, setLocalSyncStatus] = useState<
        'idle' | 'saving' | 'queued' | 'submitting' | 'success' | 'failed'
    >('idle');
    const [localErrorMessage, setLocalErrorMessage] = useState<string | null>(
        null,
    );

    const activeSyncStatus = propSyncStatus ?? localSyncStatus;
    const activeErrorMessage = propSyncErrorMessage ?? localErrorMessage;
    const isSubmitting =
        activeSyncStatus === 'submitting' || activeSyncStatus === 'saving';

    const isCheckout = mode === 'checkout';

    const handleConfirm = async () => {
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

            const numericReservationId =
                typeof reservationId === 'number'
                    ? reservationId
                    : reservationId
                      ? parseInt(String(reservationId), 10)
                      : undefined;

            if (isCheckout) {
                await onCompleteCheckout?.({
                    jobId,
                    reservationId: numericReservationId,
                    assetId,
                    hourMeter: parseFloat(hourMeter) || 0,
                    fuelLevelPercent: parseInt(fuelLevel, 10) || 100,
                    conditionAssessment: 'good',
                    conditionNotes:
                        conditionNotes ||
                        'Checkout inspection completed with zero safety defects.',
                    photos: durablePhotos,
                    signatureBase64: signaturePayload,
                    signeeName,
                    signeeRole,
                });
            } else {
                await onCompleteReturn?.({
                    jobId,
                    reservationId: numericReservationId,
                    assetId,
                    hourMeter: parseFloat(hourMeter) || 0,
                    fuelLevelPercent: parseInt(fuelLevel, 10) || 100,
                    conditionAssessment: damageNoted ? 'fair' : 'good',
                    conditionNotes:
                        conditionNotes ||
                        (damageNoted
                            ? 'Damage recorded during return inspection.'
                            : 'Returned in good operational condition.'),
                    damageNoted,
                    damageNotes: damageNoted ? conditionNotes : undefined,
                    photos: durablePhotos,
                    signatureBase64: signaturePayload,
                    signeeName,
                    signeeRole,
                });
            }

            setLocalSyncStatus('success');
        } catch (err: unknown) {
            setLocalSyncStatus('failed');
            setLocalErrorMessage(
                err instanceof Error
                    ? err.message
                    : 'Handover submission failed.',
            );
        }
    };

    return (
        <View
            style={[styles.screen, isDarkHud && styles.darkScreen]}
            testID="rental-handover-screen"
        >
            {/* Top Navigation Bar */}
            <TileScreenHeader
                backAccessibilityLabel="Go back"
                backTestID="rental-back-button"
                category="Rental Handover"
                onBack={onBack}
                rightElement={
                    <View
                        style={[
                            styles.reservationPill,
                            isDarkHud && styles.reservationPillDark,
                        ]}
                    >
                        <Text
                            style={[
                                styles.reservationPillText,
                                isDarkHud && styles.reservationPillTextDark,
                            ]}
                        >
                            {reservationReference}
                        </Text>
                    </View>
                }
                subtitle="Alibaton Equipment Operations · PH"
                title={isCheckout ? 'Rental Checkout' : 'Return Check-in'}
            />

            {/* Mode Switcher Tabs */}
            <View
                accessibilityRole="tablist"
                style={[styles.modeTabs, isDarkHud && styles.modeTabsDark]}
            >
                <Pressable
                    accessibilityLabel="Checkout Handover Tab"
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isCheckout }}
                    onPress={() => setMode('checkout')}
                    style={({ pressed }) => [
                        styles.modeTab,
                        isDarkHud && styles.modeTabDark,
                        isCheckout &&
                            (isDarkHud
                                ? styles.modeTabActiveDark
                                : styles.modeTabActive),
                        pressed && styles.tabPressed,
                    ]}
                    testID="tab-checkout"
                >
                    <Icon
                        color={
                            isCheckout
                                ? isDarkHud
                                    ? '#F59E0B'
                                    : '#B45309'
                                : isDarkHud
                                  ? colors.hudTextDim
                                  : colors.muted
                        }
                        name="truck"
                        size={16}
                    />
                    <Text
                        style={[
                            styles.modeTabText,
                            isDarkHud && styles.modeTabTextDark,
                            isCheckout &&
                                (isDarkHud
                                    ? styles.modeTabTextActiveDark
                                    : styles.modeTabTextActive),
                        ]}
                    >
                        Checkout Handover
                    </Text>
                </Pressable>

                <Pressable
                    accessibilityLabel="Return Check-in Tab"
                    accessibilityRole="tab"
                    accessibilityState={{ selected: !isCheckout }}
                    onPress={() => setMode('return')}
                    style={({ pressed }) => [
                        styles.modeTab,
                        isDarkHud && styles.modeTabDark,
                        !isCheckout &&
                            (isDarkHud
                                ? styles.modeTabActiveDark
                                : styles.modeTabActive),
                        pressed && styles.tabPressed,
                    ]}
                    testID="tab-return"
                >
                    <Icon
                        color={
                            !isCheckout
                                ? isDarkHud
                                    ? '#F59E0B'
                                    : '#B45309'
                                : isDarkHud
                                  ? colors.hudTextDim
                                  : colors.muted
                        }
                        name="check-circle"
                        size={16}
                    />
                    <Text
                        style={[
                            styles.modeTabText,
                            isDarkHud && styles.modeTabTextDark,
                            !isCheckout &&
                                (isDarkHud
                                    ? styles.modeTabTextActiveDark
                                    : styles.modeTabTextActive),
                        ]}
                    >
                        Return Inspection
                    </Text>
                </Pressable>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Equipment & Client Summary Card */}
                <View
                    style={[
                        styles.assetCard,
                        isDarkHud && styles.assetCardDark,
                    ]}
                >
                    <View style={styles.assetHeader}>
                        <View>
                            <Text
                                style={[
                                    styles.assetCodeLabel,
                                    isDarkHud && styles.assetCodeLabelDark,
                                ]}
                            >
                                ASSET CODE
                            </Text>
                            <Text
                                style={[
                                    styles.assetCode,
                                    isDarkHud && styles.assetCodeDark,
                                ]}
                            >
                                {assetCode}
                            </Text>
                        </View>
                        <View
                            style={[
                                styles.doleBadge,
                                isDarkHud && styles.doleBadgeDark,
                            ]}
                        >
                            <Icon
                                color={isDarkHud ? '#34D399' : colors.greenDark}
                                name="shield-check"
                                size={12}
                            />
                            <Text
                                style={[
                                    styles.doleBadgeText,
                                    isDarkHud && styles.doleBadgeTextDark,
                                ]}
                            >
                                DOLE-OSHC CERTIFIED
                            </Text>
                        </View>
                    </View>

                    <Text
                        style={[
                            styles.assetName,
                            isDarkHud && styles.assetNameDark,
                        ]}
                    >
                        {assetName}
                    </Text>

                    <View
                        style={[
                            styles.clientDivider,
                            isDarkHud && styles.clientDividerDark,
                        ]}
                    />
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
                            Client: {clientName}
                        </Text>
                    </View>
                </View>

                {/* Operating Hours & Fluid Levels */}
                <View
                    style={[
                        styles.sectionCard,
                        isDarkHud && styles.sectionCardDark,
                    ]}
                >
                    <Text
                        style={[
                            styles.sectionTitle,
                            isDarkHud && styles.sectionTitleDark,
                        ]}
                    >
                        HOUR METER & FLUID LEVELS
                    </Text>
                    <View style={styles.inputsRow}>
                        <View style={styles.inputGroup}>
                            <Text
                                style={[
                                    styles.inputLabel,
                                    isDarkHud && styles.inputLabelDark,
                                ]}
                            >
                                Hour Meter (hrs)
                            </Text>
                            <TextInput
                                accessibilityLabel="Hour Meter in hours"
                                keyboardType="numeric"
                                onChangeText={setHourMeter}
                                placeholder="0.0"
                                placeholderTextColor={
                                    isDarkHud ? colors.hudTextDim : colors.muted
                                }
                                style={[
                                    styles.textInput,
                                    isDarkHud && styles.textInputDark,
                                ]}
                                testID="input-hour-meter"
                                value={hourMeter}
                            />
                        </View>
                        <View style={styles.inputGroup}>
                            <Text
                                style={[
                                    styles.inputLabel,
                                    isDarkHud && styles.inputLabelDark,
                                ]}
                            >
                                Fuel Level (%)
                            </Text>
                            <TextInput
                                accessibilityLabel="Fuel Level percentage"
                                keyboardType="numeric"
                                onChangeText={setFuelLevel}
                                placeholder="100"
                                placeholderTextColor={
                                    isDarkHud ? colors.hudTextDim : colors.muted
                                }
                                style={[
                                    styles.textInput,
                                    isDarkHud && styles.textInputDark,
                                ]}
                                testID="input-fuel-level"
                                value={fuelLevel}
                            />
                        </View>
                    </View>
                </View>

                {/* Return Damage Inspection Toggle (Return Mode Only) */}
                {!isCheckout ? (
                    <View
                        style={[
                            styles.sectionCard,
                            isDarkHud && styles.sectionCardDark,
                        ]}
                    >
                        <Text
                            style={[
                                styles.sectionTitle,
                                isDarkHud && styles.sectionTitleDark,
                            ]}
                        >
                            RETURN CONDITION & DAMAGE INSPECTION
                        </Text>
                        <Pressable
                            accessibilityLabel={
                                damageNoted
                                    ? 'Damage or Wear Logged'
                                    : 'No New Damage · Clean Return'
                            }
                            accessibilityRole="button"
                            accessibilityState={{ selected: damageNoted }}
                            onPress={() => setDamageNoted(!damageNoted)}
                            style={({ pressed }) => [
                                styles.damageToggle,
                                damageNoted
                                    ? isDarkHud
                                        ? styles.damageActiveDark
                                        : styles.damageActive
                                    : isDarkHud
                                      ? styles.damageCleanDark
                                      : styles.damageClean,
                                pressed && styles.pressed,
                            ]}
                            testID="toggle-damage-diff"
                        >
                            <Icon
                                color={
                                    damageNoted
                                        ? isDarkHud
                                            ? '#EF4444'
                                            : colors.redDark
                                        : isDarkHud
                                          ? '#10B981'
                                          : colors.greenDark
                                }
                                name={damageNoted ? 'alert' : 'check-circle'}
                                size={18}
                            />
                            <View style={styles.damageCopy}>
                                <Text
                                    style={[
                                        styles.damageTitle,
                                        isDarkHud && styles.damageTitleDark,
                                    ]}
                                >
                                    {damageNoted
                                        ? 'Damage or Wear Logged'
                                        : 'No New Damage · Clean Return'}
                                </Text>
                                <Text
                                    style={[
                                        styles.damageSubtitle,
                                        isDarkHud && styles.damageSubtitleDark,
                                    ]}
                                >
                                    {damageNoted
                                        ? 'Requires photo documentation & customer sign-off'
                                        : 'Equipment condition verified with zero safety defects'}
                                </Text>
                            </View>
                        </Pressable>
                    </View>
                ) : null}

                {/* Photo Evidence & Attachments */}
                <View
                    style={[
                        styles.sectionCard,
                        isDarkHud && styles.sectionCardDark,
                    ]}
                >
                    <Text
                        style={[
                            styles.sectionTitle,
                            isDarkHud && styles.sectionTitleDark,
                        ]}
                    >
                        {isCheckout
                            ? 'CHECKOUT INSPECTION PHOTOS'
                            : 'RETURN INSPECTION PHOTOS'}
                    </Text>
                    <PhotoAttachmentPicker
                        attachments={photos}
                        helperText={
                            isCheckout
                                ? 'Capture unit baseline condition, hour meter, and attachments.'
                                : 'Capture return condition, hour meter, and any wear or damage.'
                        }
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
                        title={
                            isCheckout
                                ? 'Baseline Inspection Photos'
                                : 'Return Condition Evidence Photos'
                        }
                    />
                </View>

                {/* Remarks & Notes */}
                <View
                    style={[
                        styles.sectionCard,
                        isDarkHud && styles.sectionCardDark,
                    ]}
                >
                    <Text
                        style={[
                            styles.sectionTitle,
                            isDarkHud && styles.sectionTitleDark,
                        ]}
                    >
                        REMARKS & NOTES
                    </Text>
                    <TextInput
                        accessibilityLabel="Inspection remarks and condition notes"
                        multiline
                        numberOfLines={3}
                        onChangeText={setConditionNotes}
                        placeholder={
                            isCheckout
                                ? 'Verify tire pressure, outriggers, fluid leaks, and boom condition...'
                                : 'Describe physical condition, paint scratches, hydraulic seals...'
                        }
                        placeholderTextColor={
                            isDarkHud ? colors.hudTextDim : colors.muted
                        }
                        style={[
                            styles.notesInput,
                            isDarkHud && styles.notesInputDark,
                        ]}
                        testID="input-condition-notes"
                        value={conditionNotes}
                    />
                </View>

                {/* Customer Sign-off Card */}
                <View
                    style={[
                        styles.sectionCard,
                        isDarkHud && styles.sectionCardDark,
                    ]}
                >
                    <Text
                        style={[
                            styles.sectionTitle,
                            isDarkHud && styles.sectionTitleDark,
                        ]}
                    >
                        CUSTOMER SIGN-OFF
                    </Text>
                    <View style={styles.signeeRow}>
                        <View style={styles.inputGroup}>
                            <Text
                                style={[
                                    styles.inputLabel,
                                    isDarkHud && styles.inputLabelDark,
                                ]}
                            >
                                Client Representative Name
                            </Text>
                            <TextInput
                                accessibilityLabel="Client Representative Name"
                                onChangeText={setSigneeName}
                                placeholder="Representative Name"
                                placeholderTextColor={
                                    isDarkHud ? colors.hudTextDim : colors.muted
                                }
                                style={[
                                    styles.textInput,
                                    isDarkHud && styles.textInputDark,
                                ]}
                                testID="input-signee-name"
                                value={signeeName}
                            />
                        </View>
                    </View>

                    <Pressable
                        accessibilityLabel="Capture Customer Signature"
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
                        testID="open-signature-button"
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
                                ? '✓ Customer Signature Captured'
                                : 'Capture Digital Signature'}
                        </Text>
                    </Pressable>
                </View>

                {/* Offline Outbox & Sync State Banner */}
                {activeSyncStatus !== 'idle' && (
                    <View
                        accessibilityRole="alert"
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
                                        ? 'Submitted Successfully'
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
                                    ? 'Uploading handover evidence to operations desk.'
                                    : activeSyncStatus === 'queued'
                                      ? 'Evidence securely stored in offline outbox. It will synchronize automatically when connection is restored.'
                                      : activeSyncStatus === 'success'
                                        ? 'Handover evidence recorded and synchronized with operations.'
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

                {/* Final Action Button */}
                <Pressable
                    accessibilityLabel={
                        isCheckout
                            ? 'Confirm Rental Checkout & Dispatch'
                            : 'Confirm Return Check-in & Close'
                    }
                    accessibilityRole="button"
                    accessibilityState={{ disabled: isSubmitting }}
                    disabled={isSubmitting}
                    onPress={handleConfirm}
                    style={({ pressed }) => [
                        styles.confirmBtn,
                        isDarkHud && styles.confirmBtnDark,
                        isSubmitting && styles.confirmBtnDisabled,
                        pressed && !isSubmitting && styles.pressed,
                    ]}
                    testID="confirm-handover-button"
                >
                    <Icon color="#FFFFFF" name="check-circle" size={20} />
                    <Text style={styles.confirmBtnText}>
                        {isSubmitting
                            ? 'SUBMITTING EVIDENCE…'
                            : isCheckout
                              ? 'CONFIRM RENTAL CHECKOUT & DISPATCH'
                              : 'CONFIRM RETURN CHECK-IN & CLOSE'}
                    </Text>
                </Pressable>
            </ScrollView>

            <DigitalSignatureModal
                clientName={clientName}
                jobReference={reservationReference}
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
    reservationPill: {
        backgroundColor: colors.amberLight,
        borderColor: colors.amberBorder,
        borderRadius: 8,
        borderWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    reservationPillDark: {
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        borderColor: 'rgba(245, 158, 11, 0.4)',
    },
    reservationPillText: {
        color: colors.amberDark,
        fontSize: 11,
        fontWeight: '700',
    },
    reservationPillTextDark: {
        color: '#FDE68A',
    },
    modeTabs: {
        backgroundColor: colors.surface,
        borderBottomColor: colors.border,
        borderBottomWidth: 1,
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 6,
    },
    modeTabsDark: {
        backgroundColor: colors.hudSurface,
        borderBottomColor: colors.hudBorder,
    },
    modeTab: {
        alignItems: 'center',
        borderRadius: 8,
        flex: 1,
        flexDirection: 'row',
        gap: 6,
        justifyContent: 'center',
        minHeight: 44,
        paddingVertical: 8,
    },
    modeTabDark: {
        backgroundColor: 'transparent',
    },
    modeTabActive: {
        backgroundColor: colors.amberLight,
    },
    modeTabActiveDark: {
        backgroundColor: 'rgba(245, 158, 11, 0.25)',
        borderColor: 'rgba(245, 158, 11, 0.5)',
        borderWidth: 1,
    },
    modeTabText: {
        color: colors.muted,
        fontSize: 13,
        fontWeight: '600',
    },
    modeTabTextDark: {
        color: colors.hudTextDim,
    },
    modeTabTextActive: {
        color: colors.amberDark,
        fontWeight: '700',
    },
    modeTabTextActiveDark: {
        color: '#FDE68A',
        fontWeight: '700',
    },
    scrollContent: {
        alignSelf: 'center',
        maxWidth: 720,
        padding: 16,
        paddingBottom: 36,
        width: '100%',
    },
    assetCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 14,
        padding: 16,
        ...shadows.sm,
    },
    assetCardDark: {
        backgroundColor: colors.hudSurface,
        borderColor: colors.hudBorder,
        elevation: 0,
        shadowOpacity: 0,
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
    assetCodeLabelDark: {
        color: colors.hudTextDim,
    },
    assetCode: {
        color: colors.amberDark,
        fontSize: 14,
        fontWeight: '800',
    },
    assetCodeDark: {
        color: '#FDE68A',
    },
    doleBadge: {
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
    doleBadgeDark: {
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        borderColor: 'rgba(16, 185, 129, 0.4)',
    },
    doleBadgeText: {
        color: colors.greenDark,
        fontSize: 10,
        fontWeight: '700',
    },
    doleBadgeTextDark: {
        color: '#34D399',
    },
    assetName: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '700',
        marginTop: 2,
    },
    assetNameDark: {
        color: colors.hudText,
    },
    clientDivider: {
        backgroundColor: colors.border,
        height: 1,
        marginVertical: 10,
    },
    clientDividerDark: {
        backgroundColor: colors.hudBorder,
    },
    clientRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6,
    },
    clientName: {
        color: colors.secondary,
        fontSize: 13,
    },
    clientNameDark: {
        color: colors.hudTextDim,
    },
    sectionCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 14,
        padding: 16,
        ...shadows.sm,
    },
    sectionCardDark: {
        backgroundColor: colors.hudSurface,
        borderColor: colors.hudBorder,
        elevation: 0,
        shadowOpacity: 0,
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
    inputsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    inputGroup: {
        flex: 1,
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
        fontSize: 14,
        fontWeight: '600',
        minHeight: 46,
        paddingHorizontal: 12,
    },
    textInputDark: {
        backgroundColor: '#0F172A',
        borderColor: colors.hudBorder,
        color: colors.hudText,
    },
    damageToggle: {
        alignItems: 'center',
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 12,
        padding: 14,
    },
    damageClean: {
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
    },
    damageCleanDark: {
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        borderColor: 'rgba(16, 185, 129, 0.4)',
    },
    damageActive: {
        backgroundColor: colors.redLight,
        borderColor: colors.redBorder,
    },
    damageActiveDark: {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        borderColor: 'rgba(239, 68, 68, 0.5)',
    },
    damageCopy: {
        flex: 1,
    },
    damageTitle: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '700',
    },
    damageTitleDark: {
        color: colors.hudText,
    },
    damageSubtitle: {
        color: colors.muted,
        fontSize: 11,
        marginTop: 2,
    },
    damageSubtitleDark: {
        color: colors.hudTextDim,
    },
    notesInput: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        color: colors.text,
        fontSize: 13,
        minHeight: 72,
        padding: 12,
        textAlignVertical: 'top',
    },
    notesInputDark: {
        backgroundColor: '#0F172A',
        borderColor: colors.hudBorder,
        color: colors.hudText,
    },
    signeeRow: {
        marginBottom: 12,
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
    pressed: {
        opacity: 0.82,
        transform: [{ scale: 0.96 }],
    },
    tabPressed: {
        opacity: 0.85,
        transform: [{ scale: 0.97 }],
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
