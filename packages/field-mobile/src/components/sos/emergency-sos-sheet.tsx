import React, {
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    AccessibilityInfo,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    Vibration,
    View,
} from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import type {
    ActivateSosIncidentPayload,
    DispatchJob,
    SosDeliveryState,
    SosEmergencyAction,
    SosIncident,
    SosIncidentCategory,
    SosLocationSnapshot,
} from '../../types/index';
import { Icon } from '../common/Icon';
import { colors } from '../nativeStyles';
import { EmergencyContactActions } from './emergency-contact-actions';
import {
    EMERGENCY_CATEGORIES,
    SosCategorySelector,
    SITUATION_CHIPS,
} from './sos-category-selector';

const HOLD_DURATION_MS = 2_000;
const HOLD_TICK_MS = 50;

export interface EmergencySosSheetProps {
    visible: boolean;
    jobs: DispatchJob[];
    activeIncident?: SosIncident | null;
    deliveryState: SosDeliveryState;
    isOnline: boolean | null;
    actions: SosEmergencyAction[];
    onClose: () => void;
    onActivate: (payload: ActivateSosIncidentPayload) => Promise<void>;
    onClassify: (category: SosIncidentCategory, note?: string) => Promise<void>;
    onGetLocation?: () => Promise<{
        latitude: number;
        longitude: number;
        accuracyMetres?: number | null;
    } | null>;
}

export const EmergencySosSheet: React.FC<EmergencySosSheetProps> = ({
    visible,
    jobs,
    activeIncident,
    deliveryState,
    actions,
    onClose,
    onActivate,
    onClassify,
    onGetLocation,
}) => {
    const { isDarkHud } = useTheme();
    const [cachedLocation, setCachedLocation] =
        useState<SosLocationSnapshot | null>(null);
    const [selectedJobId, setSelectedJobId] = useState<number | null>(
        jobs[0]?.id ?? null,
    );
    const [selectedAssetId, setSelectedAssetId] = useState<number | null>(
        jobs[0]?.asset_assignments?.[0]?.operational_asset_id ?? null,
    );
    const [selectedCategory, setSelectedCategory] =
        useState<SosIncidentCategory>(
            activeIncident?.category ?? 'unclassified',
        );
    const [selectedChips, setSelectedChips] = useState<string[]>([]);
    const [situationNote, setSituationNote] = useState<string>(
        activeIncident?.worker_note ?? activeIncident?.note ?? '',
    );
    const [isUpdatingNote, setIsUpdatingNote] = useState(false);
    const [holdProgress, setHoldProgress] = useState(0);
    const [isActivating, setIsActivating] = useState(false);
    const [isHolding, setIsHolding] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [reduceMotion, setReduceMotion] = useState(false);
    const holdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const holdCompletedRef = useRef(false);
    const contextInitializedRef = useRef(jobs.length > 0);

    const selectedCategoryConfig = useMemo(
        () =>
            EMERGENCY_CATEGORIES.find((c) => c.value === selectedCategory) ??
            EMERGENCY_CATEGORIES[0],
        [selectedCategory],
    );

    const hasTerminalIncident =
        activeIncident?.status === 'resolved' ||
        activeIncident?.status === 'cancelled';

    useEffect(() => {
        if (activeIncident?.category) {
            const category = activeIncident.category;

            queueMicrotask(() => {
                setSelectedCategory(category);
            });
        }

        if (activeIncident?.worker_note || activeIncident?.note) {
            const note =
                activeIncident.worker_note || activeIncident.note || '';

            queueMicrotask(() => {
                setSituationNote((prev) => prev || note);
            });
        }
    }, [
        activeIncident?.category,
        activeIncident?.note,
        activeIncident?.worker_note,
    ]);

    useEffect(() => {
        if (!visible || !onGetLocation || activeIncident) {
            return;
        }

        let isMounted = true;
        void onGetLocation()
            .then((loc) => {
                if (isMounted && loc) {
                    setCachedLocation({
                        latitude: loc.latitude,
                        longitude: loc.longitude,
                        accuracy_metres: loc.accuracyMetres ?? null,
                        captured_at: new Date().toISOString(),
                    });
                }
            })
            .catch(() => {
                // Pre-warming is opportunistic; errors will not block emergency broadcast
            });

        return () => {
            isMounted = false;
        };
    }, [activeIncident, onGetLocation, visible]);

    const handleToggleChip = useCallback(
        (chipId: string) => {
            const isCurrentlySelected = selectedChips.includes(chipId);
            const nextChips = isCurrentlySelected
                ? selectedChips.filter((id) => id !== chipId)
                : [...selectedChips, chipId];
            setSelectedChips(nextChips);

            const chip = SITUATION_CHIPS.find((c) => c.id === chipId);

            if (chip && !isCurrentlySelected) {
                const tag = `[${chip.label}]`;
                const updated = situationNote.includes(tag)
                    ? situationNote
                    : situationNote.trim()
                      ? `${situationNote.trim()} ${tag}`
                      : tag;

                setSituationNote(updated);

                if (activeIncident && !hasTerminalIncident) {
                    void onClassify(selectedCategory, updated);
                }
            }
        },
        [
            activeIncident,
            hasTerminalIncident,
            onClassify,
            selectedCategory,
            selectedChips,
            situationNote,
        ],
    );

    const handleCategoryChange = useCallback(
        (nextCategory: SosIncidentCategory) => {
            setSelectedCategory(nextCategory);

            if (activeIncident && !hasTerminalIncident) {
                void onClassify(
                    nextCategory,
                    situationNote.trim() || undefined,
                );
            }
        },
        [activeIncident, hasTerminalIncident, onClassify, situationNote],
    );

    const handleTransmitNotes = useCallback(async () => {
        if (!situationNote.trim() || isUpdatingNote) {
            return;
        }

        setIsUpdatingNote(true);

        try {
            if (activeIncident && !hasTerminalIncident) {
                await onClassify(selectedCategory, situationNote.trim());
            }
        } finally {
            setIsUpdatingNote(false);
        }
    }, [
        activeIncident,
        hasTerminalIncident,
        isUpdatingNote,
        onClassify,
        selectedCategory,
        situationNote,
    ]);

    useEffect(() => {
        let mounted = true;
        void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
            if (mounted) {
                setReduceMotion(enabled);
            }
        });

        const subscription = AccessibilityInfo.addEventListener(
            'reduceMotionChanged',
            setReduceMotion,
        );

        return () => {
            mounted = false;
            subscription.remove();
        };
    }, []);

    useEffect(() => {
        if (!contextInitializedRef.current && jobs.length > 0) {
            contextInitializedRef.current = true;
            setSelectedJobId(jobs[0].id);
            setSelectedAssetId(
                jobs[0].asset_assignments?.[0]?.operational_asset_id ?? null,
            );
        }
    }, [jobs]);

    const clearHold = useCallback(() => {
        if (holdTimerRef.current) {
            clearInterval(holdTimerRef.current);
            holdTimerRef.current = null;
        }
    }, []);

    const completeHold = useCallback(() => {
        if (holdCompletedRef.current || isActivating || activeIncident) {
            return;
        }

        holdCompletedRef.current = true;
        clearHold();
        setHoldProgress(1);
        setIsHolding(false);
        Vibration.vibrate(90);
        setShowConfirmModal(true);
    }, [activeIncident, clearHold, isActivating]);

    const handleConfirmedBroadcast = useCallback(() => {
        setShowConfirmModal(false);
        setIsActivating(true);
        Vibration.vibrate(90);

        void onActivate({
            category: selectedCategory,
            device_activated_at: new Date().toISOString(),
            dispatch_job_id: selectedJobId,
            operational_asset_id: selectedAssetId,
            location: cachedLocation ?? null,
            note: situationNote.trim() || null,
        }).finally(() => {
            setIsActivating(false);
            setHoldProgress(0);
            holdCompletedRef.current = false;
        });
    }, [
        cachedLocation,
        onActivate,
        selectedAssetId,
        selectedCategory,
        selectedJobId,
        situationNote,
    ]);

    const handleCancelConfirmation = useCallback(() => {
        setShowConfirmModal(false);
        setHoldProgress(0);
        holdCompletedRef.current = false;
    }, []);

    const startHold = useCallback(() => {
        if (isActivating || activeIncident || holdTimerRef.current) {
            return;
        }

        setIsHolding(true);
        holdCompletedRef.current = false;
        setHoldProgress(0);
        const startedAt = Date.now();
        holdTimerRef.current = setInterval(() => {
            const progress = Math.min(
                1,
                (Date.now() - startedAt) / HOLD_DURATION_MS,
            );
            setHoldProgress(progress);

            if (progress >= 1) {
                completeHold();
            }
        }, HOLD_TICK_MS);
    }, [activeIncident, completeHold, isActivating]);

    const endHold = useCallback(() => {
        setIsHolding(false);
        clearHold();

        if (!holdCompletedRef.current) {
            setHoldProgress(0);
        }
    }, [clearHold]);

    useEffect(() => clearHold, [clearHold]);

    const handleAccessibilityAction = () => {
        // A screen-reader activation is a deliberate action. It receives the
        // same two-second progress window rather than bypassing the safety hold.
        startHold();
    };

    const insets = useContext(SafeAreaInsetsContext);
    const topInset = insets?.top ?? 0;

    return (
        <Modal
            accessibilityViewIsModal
            animationType={reduceMotion ? 'none' : 'slide'}
            onRequestClose={onClose}
            transparent={false}
            visible={visible}
        >
            <View
                style={[styles.root, isDarkHud && styles.darkRoot]}
                testID="emergency-sos-sheet"
            >
                <View
                    style={[
                        styles.header,
                        isDarkHud && styles.darkHeader,
                        { paddingTop: Math.max(topInset, 16) + 6 },
                    ]}
                >
                    <View style={styles.headerCopy}>
                        <Text selectable style={styles.eyebrow}>
                            EMERGENCY DISPATCH
                        </Text>
                        <Text
                            accessibilityRole="header"
                            selectable
                            style={[
                                styles.title,
                                isDarkHud && styles.darkTitle,
                            ]}
                        >
                            Emergency SOS
                        </Text>
                    </View>
                    <Pressable
                        accessibilityLabel="Close Emergency SOS"
                        accessibilityRole="button"
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        onPress={onClose}
                        style={[
                            styles.closeButton,
                            isDarkHud && styles.darkCloseButton,
                        ]}
                    >
                        <Icon
                            color={isDarkHud ? '#F8FAFC' : colors.text}
                            name="close"
                            size={22}
                        />
                    </Pressable>
                </View>

                <ScrollView
                    contentContainerStyle={styles.content}
                    contentInsetAdjustmentBehavior="automatic"
                    keyboardDismissMode="on-drag"
                    keyboardShouldPersistTaps="handled"
                    scrollEnabled={!isHolding}
                >
                    {/* Status & Beacon Banner: Unified single source of truth */}
                    {deliveryState !== 'preparing' &&
                    (activeIncident ||
                        deliveryState === 'sending' ||
                        deliveryState === 'delivered' ||
                        deliveryState === 'retrying' ||
                        deliveryState === 'not_delivered_offline' ||
                        deliveryState === 'acknowledged' ||
                        deliveryState === 'escalated' ||
                        deliveryState === 'resolved' ||
                        deliveryState === 'cancelled') ? (
                        <View
                            accessible
                            accessibilityLiveRegion="assertive"
                            accessibilityRole="summary"
                            style={[
                                styles.beaconBanner,
                                isDarkHud && styles.darkBeaconBanner,
                                deliveryState === 'retrying' &&
                                    styles.beaconBannerRetrying,
                                deliveryState === 'not_delivered_offline' &&
                                    styles.beaconBannerOffline,
                                deliveryState === 'sending' &&
                                    styles.beaconBannerSending,
                            ]}
                            testID="sos-delivery-status"
                        >
                            <View style={styles.beaconHeader}>
                                <View
                                    style={[
                                        styles.pulseDot,
                                        (deliveryState === 'retrying' ||
                                            deliveryState === 'sending') &&
                                            styles.pulseDotAmber,
                                    ]}
                                />
                                <Text style={styles.beaconEyebrow}>
                                    {deliveryState === 'retrying'
                                        ? 'EMERGENCY ALERT QUEUED · RETRYING'
                                        : deliveryState ===
                                            'not_delivered_offline'
                                          ? 'EMERGENCY SAVED OFFLINE'
                                          : deliveryState === 'sending'
                                            ? 'BROADCASTING EMERGENCY DISTRESS BEACON…'
                                            : deliveryState === 'acknowledged'
                                              ? 'EMERGENCY ACKNOWLEDGED BY SAFETY DESK'
                                              : deliveryState === 'resolved'
                                                ? 'INCIDENT RESOLVED'
                                                : deliveryState === 'cancelled'
                                                  ? 'INCIDENT CANCELLED'
                                                  : 'LIVE EMERGENCY SIGNAL ACTIVE'}
                                </Text>
                            </View>
                            <Text style={styles.beaconTitle}>
                                {deliveryState === 'retrying'
                                    ? 'Retrying Transmission to Operations Manager'
                                    : deliveryState === 'not_delivered_offline'
                                      ? 'Alert Saved Locally on Device'
                                      : deliveryState === 'sending'
                                        ? 'Transmitting to Operations Manager…'
                                        : deliveryState === 'acknowledged'
                                          ? 'Response Team Dispatched'
                                          : deliveryState === 'resolved'
                                            ? 'Emergency Cleared by Safety Desk'
                                            : deliveryState === 'cancelled'
                                              ? 'Emergency Signal Cancelled'
                                              : 'Help Dispatch Transmitted'}
                            </Text>
                            <Text style={styles.beaconBody}>
                                {deliveryState === 'retrying'
                                    ? 'Your emergency signal is queued and retrying in background. Direct hotline to Operations Desk is open below.'
                                    : deliveryState === 'not_delivered_offline'
                                      ? 'Saved locally. Transmission will complete once connection returns, or use emergency phone line below.'
                                      : deliveryState === 'sending'
                                        ? 'Relaying emergency coordinates, vehicle/crane telemetry, and dispatch context to Central Safety Desk…'
                                        : deliveryState === 'acknowledged'
                                          ? 'Operations Manager and Safety Desk have acknowledged your emergency distress beacon.'
                                          : deliveryState === 'resolved'
                                            ? 'Central Safety Desk marked this incident resolved. Standby for standard stand-down protocol.'
                                            : deliveryState === 'cancelled'
                                              ? 'Distress alert has been cancelled.'
                                              : 'Your coordinates and emergency signal have been relayed to the Operations Manager & Central Safety Desk.'}
                            </Text>
                        </View>
                    ) : null}

                    {/* Central Safety Desk Card - only shown for active incident with responder or when configured phone/sms actions exist after broadcast */}
                    {((activeIncident &&
                        activeIncident.status !== 'resolved' &&
                        activeIncident.status !== 'cancelled') ||
                        (actions.length > 0 &&
                            deliveryState !== 'preparing')) && (
                        <View
                            style={[
                                styles.safetyDeskCard,
                                isDarkHud && styles.darkSafetyDeskCard,
                            ]}
                        >
                            <View style={styles.safetyDeskHeader}>
                                <View style={styles.safetyDeskBadge}>
                                    <Icon
                                        color="#FFFFFF"
                                        name="shield-check"
                                        size={20}
                                    />
                                </View>
                                <View style={styles.safetyDeskCopy}>
                                    <Text
                                        selectable
                                        style={[
                                            styles.safetyDeskTitle,
                                            isDarkHud && styles.darkTitle,
                                        ]}
                                    >
                                        Central Safety Desk (Live Channel)
                                    </Text>
                                    <Text
                                        selectable
                                        style={[
                                            styles.safetyDeskSub,
                                            isDarkHud && styles.darkHelper,
                                        ]}
                                    >
                                        {activeIncident?.responder?.name
                                            ? `Assigned Responder: ${activeIncident.responder.name}`
                                            : 'Operations Manager & safety supervisors monitoring 24/7'}
                                    </Text>
                                </View>
                            </View>
                            <EmergencyContactActions actions={actions} />
                        </View>
                    )}

                    {/* Emergency Classification and Notes */}
                    {!hasTerminalIncident ? (
                        <SosCategorySelector
                            disabled={isActivating}
                            isUpdatingNote={isUpdatingNote}
                            note={situationNote}
                            onChange={handleCategoryChange}
                            onNoteChange={setSituationNote}
                            onToggleChip={handleToggleChip}
                            onTransmitNotes={
                                activeIncident ? handleTransmitNotes : undefined
                            }
                            selectedChips={selectedChips}
                            value={selectedCategory}
                        />
                    ) : null}

                    {!activeIncident && deliveryState === 'preparing' ? (
                        <View
                            style={[
                                styles.holdSection,
                                isDarkHud && styles.darkHoldSection,
                            ]}
                        >
                            <Text
                                selectable
                                style={[
                                    styles.holdInstruction,
                                    isDarkHud && styles.darkHoldInstruction,
                                ]}
                            >
                                Hold for 2 seconds to broadcast emergency to
                                Operations Manager:
                            </Text>
                            <Pressable
                                accessibilityActions={[
                                    {
                                        label: 'Hold for two seconds to activate Emergency SOS and send to Operations Manager',
                                        name: 'activate',
                                    },
                                ]}
                                accessibilityHint="Keep this control pressed for two seconds until the progress reaches 100 percent. A normal tap does not activate SOS."
                                accessibilityLabel="Activate Emergency SOS"
                                accessibilityRole="button"
                                accessibilityState={{
                                    busy: isActivating,
                                    disabled: isActivating,
                                }}
                                accessibilityValue={{
                                    max: 100,
                                    min: 0,
                                    now: Math.round(holdProgress * 100),
                                    text: `${Math.round(holdProgress * 100)} percent held`,
                                }}
                                disabled={isActivating}
                                hitSlop={{
                                    top: 8,
                                    bottom: 8,
                                    left: 8,
                                    right: 8,
                                }}
                                onAccessibilityAction={
                                    handleAccessibilityAction
                                }
                                onPressIn={startHold}
                                onPressOut={endHold}
                                pressRetentionOffset={{
                                    top: 50,
                                    bottom: 50,
                                    left: 50,
                                    right: 50,
                                }}
                                style={styles.holdButton}
                                testID="activate-emergency-sos"
                            >
                                <View
                                    pointerEvents="none"
                                    style={[
                                        styles.holdProgress,
                                        {
                                            width: `${holdProgress * 100}%`,
                                        },
                                    ]}
                                />
                                <Text
                                    pointerEvents="none"
                                    style={styles.holdButtonEyebrow}
                                >
                                    HOLD 2 SECONDS TO BROADCAST
                                </Text>
                                <Text
                                    pointerEvents="none"
                                    style={styles.holdButtonText}
                                >
                                    {isActivating
                                        ? 'Broadcasting to Operations Manager…'
                                        : holdProgress > 0
                                          ? `Hold ${Math.ceil((1 - holdProgress) * 2)}s to Confirm & Send`
                                          : 'Send to Operations Manager'}
                                </Text>
                            </Pressable>
                            <View
                                style={[
                                    styles.progressTrack,
                                    isDarkHud && styles.darkProgressTrack,
                                ]}
                            >
                                <View
                                    style={[
                                        styles.progressBar,
                                        {
                                            width: `${holdProgress * 100}%`,
                                        },
                                    ]}
                                />
                            </View>
                        </View>
                    ) : null}

                    {activeIncident?.dispatch ? (
                        <Text
                            selectable
                            style={[
                                styles.serverContext,
                                isDarkHud && styles.darkHelper,
                            ]}
                        >
                            Server context: {activeIncident.dispatch.reference}
                            {activeIncident.asset
                                ? ` · ${activeIncident.asset.code}`
                                : ''}
                        </Text>
                    ) : null}
                </ScrollView>

                {/* Confirmation Dialog after 2-Second Hold */}
                <Modal
                    animationType="fade"
                    onRequestClose={handleCancelConfirmation}
                    transparent={true}
                    visible={showConfirmModal}
                >
                    <View
                        style={styles.confirmModalOverlay}
                        testID="confirm-broadcast-modal"
                    >
                        <View
                            style={[
                                styles.confirmModalContent,
                                isDarkHud && styles.darkConfirmModalContent,
                            ]}
                        >
                            <View style={styles.confirmModalHeader}>
                                <View style={styles.confirmIconCircle}>
                                    <Icon
                                        color="#DC2626"
                                        name="alert"
                                        size={24}
                                    />
                                </View>
                                <Text
                                    style={[
                                        styles.confirmModalTitle,
                                        isDarkHud && styles.darkTitle,
                                    ]}
                                >
                                    Confirm Emergency Broadcast
                                </Text>
                                <Text
                                    style={[
                                        styles.confirmModalSubtitle,
                                        isDarkHud && styles.darkHelper,
                                    ]}
                                >
                                    Broadcast this emergency alert to the
                                    Operations Manager and Central Safety Desk?
                                </Text>
                            </View>

                            {/* Summary of what will be transmitted */}
                            <View
                                style={[
                                    styles.confirmSummaryBox,
                                    isDarkHud && styles.darkConfirmSummaryBox,
                                ]}
                            >
                                <View style={styles.confirmSummaryRow}>
                                    <Text style={styles.confirmSummaryLabel}>
                                        CLASSIFICATION:
                                    </Text>
                                    <Text
                                        style={[
                                            styles.confirmSummaryValue,
                                            isDarkHud && styles.darkOptionText,
                                        ]}
                                    >
                                        {selectedCategoryConfig.title}
                                    </Text>
                                </View>

                                {selectedChips.length > 0 && (
                                    <View style={styles.confirmSummaryRow}>
                                        <Text
                                            style={styles.confirmSummaryLabel}
                                        >
                                            HAZARDS:
                                        </Text>
                                        <Text
                                            style={[
                                                styles.confirmSummaryValue,
                                                isDarkHud &&
                                                    styles.darkOptionText,
                                            ]}
                                        >
                                            {selectedChips
                                                .map(
                                                    (id) =>
                                                        SITUATION_CHIPS.find(
                                                            (c) => c.id === id,
                                                        )?.label,
                                                )
                                                .filter(Boolean)
                                                .join(', ')}
                                        </Text>
                                    </View>
                                )}

                                {situationNote.trim().length > 0 && (
                                    <View style={styles.confirmSummaryRow}>
                                        <Text
                                            style={styles.confirmSummaryLabel}
                                        >
                                            NOTES:
                                        </Text>
                                        <Text
                                            numberOfLines={2}
                                            style={[
                                                styles.confirmSummaryValue,
                                                isDarkHud &&
                                                    styles.darkOptionText,
                                            ]}
                                        >
                                            {situationNote.trim()}
                                        </Text>
                                    </View>
                                )}
                            </View>

                            <View style={styles.confirmModalActions}>
                                <Pressable
                                    accessibilityLabel="Cancel and review emergency details"
                                    accessibilityRole="button"
                                    hitSlop={{
                                        top: 6,
                                        bottom: 6,
                                        left: 6,
                                        right: 6,
                                    }}
                                    onPress={handleCancelConfirmation}
                                    style={[
                                        styles.confirmCancelBtn,
                                        isDarkHud &&
                                            styles.darkConfirmCancelBtn,
                                    ]}
                                    testID="cancel-broadcast-btn"
                                >
                                    <Text
                                        style={[
                                            styles.confirmCancelText,
                                            isDarkHud && styles.darkOptionText,
                                        ]}
                                    >
                                        Cancel & Edit
                                    </Text>
                                </Pressable>
                                <Pressable
                                    accessibilityLabel="Confirm and broadcast emergency to Operations Manager"
                                    accessibilityRole="button"
                                    hitSlop={{
                                        top: 6,
                                        bottom: 6,
                                        left: 6,
                                        right: 6,
                                    }}
                                    onPress={handleConfirmedBroadcast}
                                    style={styles.confirmSendBtn}
                                    testID="confirm-broadcast-btn"
                                >
                                    <Text style={styles.confirmSendText}>
                                        Confirm & Broadcast
                                    </Text>
                                </Pressable>
                            </View>
                        </View>
                    </View>
                </Modal>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    root: {
        backgroundColor: colors.background,
        flex: 1,
    },
    header: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderBottomColor: colors.border,
        borderBottomWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    headerCopy: {
        gap: 2,
    },
    eyebrow: {
        color: colors.redDark,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 1.1,
    },
    title: {
        color: colors.text,
        fontSize: 24,
        fontWeight: '800',
    },
    closeButton: {
        alignItems: 'center',
        height: 48,
        justifyContent: 'center',
        width: 48,
    },
    content: {
        alignSelf: 'center',
        gap: 16,
        maxWidth: 680,
        padding: 16,
        paddingBottom: 40,
        width: '100%',
    },
    intro: {
        color: colors.text,
        fontSize: 16,
        lineHeight: 24,
    },
    contextSection: {
        gap: 8,
    },
    sectionTitle: {
        color: colors.text,
        fontSize: 17,
        fontWeight: '800',
    },
    helper: {
        color: colors.secondary,
        fontSize: 13,
        lineHeight: 19,
    },
    contextOptions: {
        gap: 8,
    },
    contextOption: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 10,
        borderWidth: 1,
        minHeight: 48,
        justifyContent: 'center',
        paddingHorizontal: 12,
    },
    contextOptionSelected: {
        backgroundColor: colors.redLight,
        borderColor: colors.red,
    },
    contextText: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '600',
    },
    assetOptions: {
        gap: 8,
        paddingLeft: 12,
    },
    assetLabel: {
        color: colors.secondary,
        fontSize: 13,
        fontWeight: '700',
    },
    assetOption: {
        borderColor: colors.border,
        borderRadius: 9,
        borderWidth: 1,
        minHeight: 44,
        justifyContent: 'center',
        paddingHorizontal: 10,
    },
    assetOptionSelected: {
        backgroundColor: colors.redLight,
        borderColor: colors.red,
    },
    holdSection: {
        alignItems: 'center',
        gap: 10,
        marginTop: 6,
        width: '100%',
    },
    holdInstruction: {
        color: '#475569',
        fontSize: 13,
        fontWeight: '700',
        lineHeight: 18,
        maxWidth: 320,
        textAlign: 'center',
    },
    holdButton: {
        alignItems: 'center',
        backgroundColor: '#DC2626',
        borderColor: '#B91C1C',
        borderRadius: 18,
        borderWidth: 2,
        elevation: 6,
        justifyContent: 'center',
        minHeight: 66,
        overflow: 'hidden',
        paddingHorizontal: 16,
        paddingVertical: 12,
        position: 'relative',
        shadowColor: '#DC2626',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        width: '100%',
    },
    holdButtonEyebrow: {
        color: '#FFFFFF',
        fontSize: 11.5,
        fontWeight: '900',
        letterSpacing: 0.6,
        marginBottom: 3,
        opacity: 0.95,
        textAlign: 'center',
    },
    holdButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '900',
        textAlign: 'center',
        zIndex: 1,
    },
    holdProgress: {
        backgroundColor: '#B91C1C',
        bottom: 0,
        left: 0,
        opacity: 0.6,
        position: 'absolute',
        top: 0,
    },
    progressTrack: {
        backgroundColor: '#E2E8F0',
        borderRadius: 999,
        height: 6,
        overflow: 'hidden',
        width: '100%',
    },
    darkProgressTrack: {
        backgroundColor: '#334155',
    },
    progressBar: {
        backgroundColor: '#DC2626',
        borderRadius: 999,
        height: '100%',
    },
    serverContext: {
        color: colors.secondary,
        fontSize: 13,
        lineHeight: 18,
    },
    darkRoot: {
        backgroundColor: '#090D16',
    },
    darkHeader: {
        backgroundColor: '#1E293B',
        borderBottomColor: '#334155',
    },
    darkTitle: {
        color: '#F8FAFC',
    },
    darkCloseButton: {
        backgroundColor: '#334155',
        borderRadius: 24,
    },
    darkIntro: {
        color: '#94A3B8',
    },
    darkSectionTitle: {
        color: '#F8FAFC',
    },
    darkHelper: {
        color: '#94A3B8',
    },
    darkContextOption: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
    },
    darkContextOptionSelected: {
        backgroundColor: 'rgba(220, 38, 38, 0.25)',
        borderColor: '#EF4444',
    },
    darkContextText: {
        color: '#F8FAFC',
    },
    darkOptionText: {
        color: '#F8FAFC',
    },
    beaconBanner: {
        backgroundColor: '#DC2626',
        borderRadius: 14,
        gap: 6,
        padding: 16,
    },
    darkBeaconBanner: {
        backgroundColor: '#1E293B',
        borderColor: '#EF4444',
        borderWidth: 2,
    },
    beaconHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    pulseDot: {
        backgroundColor: '#F87171',
        borderRadius: 4,
        height: 8,
        width: 8,
    },
    beaconEyebrow: {
        color: '#FEE2E2',
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 1.1,
    },
    beaconTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '900',
    },
    beaconBody: {
        color: '#FEE2E2',
        fontSize: 13,
        lineHeight: 18,
    },
    safetyDeskCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 14,
        borderWidth: 1,
        gap: 12,
        padding: 14,
    },
    darkSafetyDeskCard: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    safetyDeskHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 12,
    },
    safetyDeskBadge: {
        alignItems: 'center',
        backgroundColor: '#10B981',
        borderRadius: 20,
        height: 38,
        justifyContent: 'center',
        width: 38,
    },
    safetyDeskCopy: {
        flex: 1,
        gap: 2,
    },
    safetyDeskTitle: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '800',
    },
    safetyDeskSub: {
        color: colors.secondary,
        fontSize: 12,
    },
    darkHoldSection: {
        backgroundColor: 'transparent',
    },
    darkHoldInstruction: {
        color: '#94A3B8',
    },
    preparingBanner: {
        alignItems: 'center',
        backgroundColor: '#FFFBEB',
        borderColor: '#F59E0B',
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 10,
        padding: 12,
    },
    darkPreparingBanner: {
        backgroundColor: '#1E293B',
        borderColor: '#D97706',
    },
    preparingMark: {
        alignItems: 'center',
        backgroundColor: '#FEF3C7',
        borderRadius: 14,
        height: 28,
        justifyContent: 'center',
        width: 28,
    },
    preparingCopy: {
        flex: 1,
        gap: 2,
    },
    preparingTitle: {
        color: '#92400E',
        fontSize: 14,
        fontWeight: '800',
    },
    darkPreparingTitle: {
        color: '#FBBF24',
    },
    preparingDetail: {
        color: '#78350F',
        fontSize: 12,
        lineHeight: 16,
    },
    darkPreparingDetail: {
        color: '#94A3B8',
    },
    beaconBannerSending: {
        backgroundColor: '#B45309',
    },
    beaconBannerRetrying: {
        backgroundColor: '#9A3412',
    },
    beaconBannerOffline: {
        backgroundColor: '#991B1B',
    },
    pulseDotAmber: {
        backgroundColor: '#FDE047',
    },
    confirmModalOverlay: {
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        flex: 1,
        justifyContent: 'center',
        padding: 20,
    },
    confirmModalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        elevation: 10,
        gap: 16,
        maxWidth: 420,
        padding: 20,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
        width: '100%',
    },
    darkConfirmModalContent: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
        borderWidth: 1.5,
    },
    confirmModalHeader: {
        alignItems: 'center',
        gap: 6,
    },
    confirmIconCircle: {
        alignItems: 'center',
        backgroundColor: '#FEE2E2',
        borderRadius: 24,
        height: 48,
        justifyContent: 'center',
        marginBottom: 4,
        width: 48,
    },
    confirmModalTitle: {
        color: '#0F172A',
        fontSize: 18,
        fontWeight: '900',
        textAlign: 'center',
    },
    confirmModalSubtitle: {
        color: '#64748B',
        fontSize: 13,
        lineHeight: 18,
        textAlign: 'center',
    },
    confirmSummaryBox: {
        backgroundColor: '#F8FAFC',
        borderColor: '#E2E8F0',
        borderRadius: 12,
        borderWidth: 1,
        gap: 8,
        padding: 12,
    },
    darkConfirmSummaryBox: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
    },
    confirmSummaryRow: {
        gap: 2,
    },
    confirmSummaryLabel: {
        color: '#94A3B8',
        fontSize: 10.5,
        fontWeight: '900',
        letterSpacing: 0.6,
    },
    confirmSummaryValue: {
        color: '#0F172A',
        fontSize: 13,
        fontWeight: '700',
    },
    confirmModalActions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 4,
    },
    confirmCancelBtn: {
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        borderRadius: 12,
        flex: 1,
        justifyContent: 'center',
        minHeight: 46,
        paddingHorizontal: 12,
    },
    darkConfirmCancelBtn: {
        backgroundColor: '#334155',
    },
    confirmCancelText: {
        color: '#475569',
        fontSize: 13,
        fontWeight: '800',
    },
    confirmSendBtn: {
        alignItems: 'center',
        backgroundColor: '#DC2626',
        borderRadius: 12,
        flex: 1.4,
        justifyContent: 'center',
        minHeight: 46,
        paddingHorizontal: 12,
    },
    confirmSendText: {
        color: '#FFFFFF',
        fontSize: 13.5,
        fontWeight: '900',
    },
});
