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
    Animated,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    Vibration,
    View,
} from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import {
    formatCoordinates,
    placeLabel,
    usePlaceName,
} from '../../services/placeNames';
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
import type { IconName } from '../common/Icon';
import { colors } from '../nativeStyles';
import { EmergencyContactActions } from './emergency-contact-actions';
import {
    EMERGENCY_CATEGORIES,
    SosCategorySelector,
    SITUATION_CHIPS,
} from './sos-category-selector';

const HOLD_DURATION_MS = 2_000;
const HOLD_TICK_MS = 50;
const LOCATION_REFRESH_MS = 10_000;
// A newer fix replaces the current one unless it is much coarser; within this
// window the more accurate of the two wins.
const LOCATION_PREFER_WINDOW_MS = 30_000;

function preferLocationFix(
    current: SosLocationSnapshot | null,
    next: SosLocationSnapshot,
): SosLocationSnapshot {
    if (!current) {
        return next;
    }

    const ageGap =
        Date.parse(next.captured_at) - Date.parse(current.captured_at);
    const currentAccuracy = current.accuracy_metres ?? Number.POSITIVE_INFINITY;
    const nextAccuracy = next.accuracy_metres ?? Number.POSITIVE_INFINITY;

    if (
        Number.isFinite(ageGap) &&
        ageGap < LOCATION_PREFER_WINDOW_MS &&
        currentAccuracy < nextAccuracy
    ) {
        return current;
    }

    return next;
}

type BeaconTone = 'critical' | 'pending' | 'success' | 'neutral';

interface BeaconCopy {
    eyebrow: string;
    title: string;
    body: string;
    tone: BeaconTone;
    icon: IconName;
}

// One entry per post-activation delivery state, so every state the server
// can report has explicit, operator-readable copy.
const BEACON_COPY: Record<
    Exclude<SosDeliveryState, 'preparing'>,
    BeaconCopy
> = {
    sending: {
        eyebrow: 'BROADCASTING EMERGENCY DISTRESS BEACON…',
        title: 'Transmitting to Operations Manager…',
        body: 'Sending your location, equipment and job details to the Central Safety Desk.',
        tone: 'pending',
        icon: 'sync',
    },
    delivered: {
        eyebrow: 'LIVE EMERGENCY SIGNAL ACTIVE',
        title: 'Help Dispatch Transmitted',
        body: 'The Operations Manager and Central Safety Desk have your alert and location. Move somewhere safe if you can.',
        tone: 'critical',
        icon: 'check-circle',
    },
    acknowledged: {
        eyebrow: 'EMERGENCY ACKNOWLEDGED BY SAFETY DESK',
        title: 'Response Team Dispatched',
        body: 'The Operations Manager and Safety Desk have acknowledged your alert. Help is being coordinated.',
        tone: 'success',
        icon: 'shield-check',
    },
    escalated: {
        eyebrow: 'EMERGENCY ESCALATED',
        title: 'Escalated to Senior Safety Staff',
        body: 'Your alert was not acknowledged in time, so it has been escalated. Call the desk below if you can.',
        tone: 'critical',
        icon: 'alert',
    },
    retrying: {
        eyebrow: 'EMERGENCY ALERT QUEUED · RETRYING',
        title: 'Retrying Transmission to Operations Manager',
        body: 'Your alert is queued and retrying in the background. Call the Operations Desk below if you can.',
        tone: 'pending',
        icon: 'sync',
    },
    not_delivered_offline: {
        eyebrow: 'EMERGENCY SAVED OFFLINE',
        title: 'Alert Saved Locally on Device',
        body: 'It will send automatically when signal returns. Use the phone line below if you can.',
        tone: 'critical',
        icon: 'cloud',
    },
    expired: {
        eyebrow: 'EMERGENCY NOT DELIVERED',
        title: 'Alert Could Not Be Confirmed',
        body: 'The server did not confirm this alert in time. Call the Operations Desk directly.',
        tone: 'critical',
        icon: 'alert',
    },
    resolved: {
        eyebrow: 'INCIDENT RESOLVED',
        title: 'Emergency Cleared by Safety Desk',
        body: 'The Central Safety Desk marked this incident resolved. Follow the standard stand-down procedure.',
        tone: 'success',
        icon: 'check-circle',
    },
    cancelled: {
        eyebrow: 'INCIDENT CANCELLED',
        title: 'Emergency Signal Cancelled',
        body: 'This distress alert has been cancelled.',
        tone: 'neutral',
        icon: 'close',
    },
};

const BEACON_TONE_COLOR: Record<BeaconTone, string> = {
    critical: '#B91C1C',
    pending: '#806000',
    success: '#047857',
    neutral: '#334155',
};

const BEACON_TONE_DARK_COLOR: Record<BeaconTone, string> = {
    critical: '#EF4444',
    pending: '#FFBF00',
    success: '#10B981',
    neutral: '#64748B',
};

type PillTone = 'ok' | 'warn' | 'bad' | 'neutral';

const PILL_TONES: Record<PillTone, { bg: string; fg: string; darkFg: string }> =
    {
        ok: { bg: '#ECFDF5', fg: '#047857', darkFg: '#34D399' },
        warn: { bg: '#FFF3C4', fg: '#6B5000', darkFg: '#FFBF00' },
        bad: { bg: '#FEF2F2', fg: '#B91C1C', darkFg: '#F87171' },
        neutral: { bg: '#E2E8F0', fg: '#334155', darkFg: '#CBD5E1' },
    };

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
        observedAt?: string | null;
    } | null>;
}

export const EmergencySosSheet: React.FC<EmergencySosSheetProps> = ({
    visible,
    jobs,
    activeIncident,
    deliveryState,
    isOnline,
    actions = [],
    onClose,
    onActivate,
    onClassify,
    onGetLocation,
}) => {
    const { isDarkHud } = useTheme();
    const [cachedLocation, setCachedLocation] =
        useState<SosLocationSnapshot | null>(null);
    const [locationFailed, setLocationFailed] = useState(false);
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
    const [pulse] = useState(() => new Animated.Value(1));

    const selectedCategoryConfig = useMemo(
        () =>
            EMERGENCY_CATEGORIES.find((c) => c.value === selectedCategory) ??
            null,
        [selectedCategory],
    );

    const selectedJob = useMemo(
        () => jobs.find((job) => job.id === selectedJobId) ?? null,
        [jobs, selectedJobId],
    );
    const selectedAssetCode =
        selectedJob?.asset_assignments?.find(
            (assignment) => assignment.operational_asset_id === selectedAssetId,
        )?.asset_code ?? null;
    const jobContextLabel = selectedJob
        ? `${selectedJob.reference}${selectedAssetCode ? ` · ${selectedAssetCode}` : ''}`
        : null;

    const locationStatus: 'ready' | 'locating' | 'unavailable' = cachedLocation
        ? 'ready'
        : onGetLocation && !locationFailed
          ? 'locating'
          : 'unavailable';
    const nearestPlace = usePlaceName(
        cachedLocation?.latitude,
        cachedLocation?.longitude,
    );
    const accuracyText =
        cachedLocation?.accuracy_metres != null
            ? `±${Math.round(cachedLocation.accuracy_metres)} m`
            : null;
    const locationLabel =
        locationStatus === 'ready'
            ? nearestPlace.status === 'resolved'
                ? [nearestPlace.primary, accuracyText]
                      .filter(Boolean)
                      .join(' · ')
                : accuracyText
                  ? `GPS ${accuracyText}`
                  : 'GPS locked'
            : locationStatus === 'locating'
              ? 'Locating…'
              : 'No GPS fix';

    const hasTerminalIncident =
        activeIncident?.status === 'resolved' ||
        activeIncident?.status === 'cancelled';
    const isPreparing = !activeIncident && deliveryState === 'preparing';
    const isTerminalState =
        hasTerminalIncident ||
        deliveryState === 'resolved' ||
        deliveryState === 'cancelled';
    const beacon =
        deliveryState !== 'preparing' ? BEACON_COPY[deliveryState] : null;
    const beaconIsLive =
        beacon !== null &&
        (beacon.tone === 'critical' || beacon.tone === 'pending') &&
        !isTerminalState;

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
        let inFlight = false;

        // Keep the fix current while the operator fills in details, so the
        // alert carries where they are now, not where they opened the sheet.
        const refresh = () => {
            if (inFlight) {
                return;
            }

            inFlight = true;
            void onGetLocation()
                .then((loc) => {
                    if (!isMounted) {
                        return;
                    }

                    if (loc) {
                        const next: SosLocationSnapshot = {
                            latitude: loc.latitude,
                            longitude: loc.longitude,
                            accuracy_metres: loc.accuracyMetres ?? null,
                            captured_at:
                                loc.observedAt ?? new Date().toISOString(),
                        };
                        setCachedLocation((previous) =>
                            preferLocationFix(previous, next),
                        );
                        setLocationFailed(false);
                    } else {
                        setLocationFailed(true);
                    }
                })
                .catch(() => {
                    // Pre-warming is opportunistic; errors will not block emergency broadcast
                    if (isMounted) {
                        setLocationFailed(true);
                    }
                })
                .finally(() => {
                    inFlight = false;
                });
        };

        refresh();
        const timer = setInterval(refresh, LOCATION_REFRESH_MS);

        return () => {
            isMounted = false;
            clearInterval(timer);
        };
    }, [activeIncident, onGetLocation, visible]);

    useEffect(() => {
        if (!beaconIsLive || reduceMotion) {
            pulse.setValue(1);

            return;
        }

        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, {
                    duration: 700,
                    toValue: 0.25,
                    useNativeDriver: true,
                }),
                Animated.timing(pulse, {
                    duration: 700,
                    toValue: 1,
                    useNativeDriver: true,
                }),
            ]),
        );
        loop.start();

        return () => {
            loop.stop();
        };
    }, [beaconIsLive, pulse, reduceMotion]);

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
    const bottomInset = insets?.bottom ?? 0;

    const beaconColor = beacon
        ? (isDarkHud ? BEACON_TONE_DARK_COLOR : BEACON_TONE_COLOR)[beacon.tone]
        : null;
    const secondsLeft = Math.max(1, Math.ceil((1 - holdProgress) * 2));

    const renderPill = (
        icon: IconName,
        label: string,
        tone: PillTone,
        testID: string,
    ) => {
        const palette = PILL_TONES[tone];

        return (
            <View
                style={[
                    styles.pill,
                    isDarkHud
                        ? styles.darkPill
                        : { backgroundColor: palette.bg },
                ]}
                testID={testID}
            >
                <Icon
                    color={isDarkHud ? palette.darkFg : palette.fg}
                    name={icon}
                    size={13}
                />
                <Text
                    numberOfLines={1}
                    style={[
                        styles.pillText,
                        { color: isDarkHud ? palette.darkFg : palette.fg },
                    ]}
                >
                    {label}
                </Text>
            </View>
        );
    };

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
                    <View style={styles.headerMark}>
                        <Icon color="#FFFFFF" name="alert" size={20} />
                    </View>
                    <View style={styles.headerCopy}>
                        <Text
                            selectable
                            style={[
                                styles.eyebrow,
                                isDarkHud && styles.darkEyebrow,
                            ]}
                        >
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
                        style={({ pressed }) => [
                            styles.closeButton,
                            isDarkHud && styles.darkCloseButton,
                            pressed && styles.pressed,
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
                    {/* What the alert will carry, visible before sending */}
                    {isPreparing ? (
                        <View
                            accessibilityLabel={`Alert readiness: ${
                                isOnline === false
                                    ? 'offline, alert will queue'
                                    : isOnline
                                      ? 'online'
                                      : 'checking signal'
                            }, ${locationLabel}${
                                jobContextLabel ? `, ${jobContextLabel}` : ''
                            }`}
                            accessible
                            style={styles.pillRow}
                            testID="sos-readiness-strip"
                        >
                            {renderPill(
                                isOnline === false ? 'cloud' : 'sync',
                                isOnline === false
                                    ? 'Offline · will queue'
                                    : isOnline
                                      ? 'Online'
                                      : 'Checking signal',
                                isOnline === false
                                    ? 'bad'
                                    : isOnline
                                      ? 'ok'
                                      : 'neutral',
                                'sos-pill-connection',
                            )}
                            {renderPill(
                                'location',
                                locationLabel,
                                locationStatus === 'ready' ? 'ok' : 'warn',
                                'sos-pill-location',
                            )}
                            {jobContextLabel
                                ? renderPill(
                                      'crane',
                                      jobContextLabel,
                                      'neutral',
                                      'sos-pill-job',
                                  )
                                : null}
                        </View>
                    ) : null}

                    {/* Status & Beacon Banner: single source of truth after activation */}
                    {beacon && beaconColor ? (
                        <View
                            accessible
                            accessibilityLiveRegion="assertive"
                            accessibilityRole="summary"
                            style={[
                                styles.beaconBanner,
                                isDarkHud
                                    ? [
                                          styles.darkBeaconBanner,
                                          { borderColor: beaconColor },
                                      ]
                                    : { backgroundColor: beaconColor },
                            ]}
                            testID="sos-delivery-status"
                        >
                            <View style={styles.beaconHeader}>
                                <Animated.View
                                    style={[
                                        styles.pulseDot,
                                        {
                                            backgroundColor: isDarkHud
                                                ? beaconColor
                                                : '#FFFFFF',
                                            opacity: pulse,
                                        },
                                    ]}
                                />
                                <Text
                                    style={[
                                        styles.beaconEyebrow,
                                        isDarkHud && { color: beaconColor },
                                    ]}
                                >
                                    {beacon.eyebrow}
                                </Text>
                            </View>
                            <View style={styles.beaconTitleRow}>
                                <Icon
                                    color={isDarkHud ? beaconColor : '#FFFFFF'}
                                    name={beacon.icon}
                                    size={22}
                                />
                                <Text
                                    style={[
                                        styles.beaconTitle,
                                        isDarkHud && styles.darkTitle,
                                    ]}
                                >
                                    {beacon.title}
                                </Text>
                            </View>
                            <Text
                                style={[
                                    styles.beaconBody,
                                    isDarkHud && styles.darkBeaconBody,
                                ]}
                            >
                                {beacon.body}
                            </Text>
                        </View>
                    ) : null}

                    {/* Central Safety Desk Card - only shown for active incident with responder or when configured phone/sms actions exist after broadcast */}
                    {((activeIncident && !hasTerminalIncident) ||
                        ((actions?.length ?? 0) > 0 &&
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

                {/* Pinned action footer: the send control is always reachable */}
                {isPreparing ? (
                    <View
                        style={[
                            styles.footer,
                            isDarkHud && styles.darkFooter,
                            { paddingBottom: Math.max(bottomInset, 12) + 4 },
                        ]}
                    >
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
                            onAccessibilityAction={handleAccessibilityAction}
                            onPressIn={startHold}
                            onPressOut={endHold}
                            pressRetentionOffset={{
                                top: 50,
                                bottom: 50,
                                left: 50,
                                right: 50,
                            }}
                            style={[
                                styles.holdButton,
                                isHolding && styles.holdButtonActive,
                                isActivating && styles.holdButtonBusy,
                            ]}
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
                            <View
                                pointerEvents="none"
                                style={styles.holdButtonInner}
                            >
                                <View style={styles.holdButtonIcon}>
                                    {isHolding ? (
                                        <Text style={styles.holdCountdown}>
                                            {secondsLeft}
                                        </Text>
                                    ) : (
                                        <Icon
                                            color="#FFFFFF"
                                            name={
                                                isActivating ? 'sync' : 'alert'
                                            }
                                            size={22}
                                        />
                                    )}
                                </View>
                                <View style={styles.holdButtonCopy}>
                                    <Text style={styles.holdButtonEyebrow}>
                                        {isHolding
                                            ? 'KEEP HOLDING · RELEASE TO CANCEL'
                                            : 'HOLD 2 SECONDS TO BROADCAST'}
                                    </Text>
                                    <Text style={styles.holdButtonText}>
                                        {isActivating
                                            ? 'Broadcasting to Operations Manager…'
                                            : isHolding
                                              ? `Sending in ${secondsLeft}s…`
                                              : 'Send to Operations Manager'}
                                    </Text>
                                </View>
                            </View>
                        </Pressable>
                        <Text
                            style={[
                                styles.footerHint,
                                isDarkHud && styles.darkHelper,
                                isOnline === false && styles.footerHintAlert,
                                isOnline === false &&
                                    isDarkHud &&
                                    styles.darkFooterHintAlert,
                            ]}
                        >
                            {isOnline === false
                                ? 'No signal. The alert will be saved and sent automatically when you reconnect.'
                                : "A quick tap won't send. You'll confirm before the alert goes out."}
                        </Text>
                    </View>
                ) : isTerminalState ? (
                    <View
                        style={[
                            styles.footer,
                            isDarkHud && styles.darkFooter,
                            { paddingBottom: Math.max(bottomInset, 12) + 4 },
                        ]}
                    >
                        <Pressable
                            accessibilityLabel="Close Emergency SOS"
                            accessibilityRole="button"
                            onPress={onClose}
                            style={({ pressed }) => [
                                styles.doneButton,
                                isDarkHud && styles.darkDoneButton,
                                pressed && styles.pressed,
                            ]}
                            testID="sos-done-btn"
                        >
                            <Text
                                style={[
                                    styles.doneButtonText,
                                    isDarkHud && styles.darkDoneButtonText,
                                ]}
                            >
                                Done
                            </Text>
                        </Pressable>
                    </View>
                ) : null}

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
                                <View
                                    style={[
                                        styles.confirmIconCircle,
                                        isDarkHud &&
                                            styles.darkConfirmIconCircle,
                                    ]}
                                >
                                    <Icon
                                        color={
                                            isDarkHud ? '#F87171' : '#DC2626'
                                        }
                                        name="alert"
                                        size={26}
                                    />
                                </View>
                                <Text
                                    accessibilityRole="header"
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
                                        TYPE
                                    </Text>
                                    <Text
                                        style={[
                                            styles.confirmSummaryValue,
                                            isDarkHud && styles.darkOptionText,
                                        ]}
                                    >
                                        {selectedCategoryConfig?.title ??
                                            'Unclassified emergency'}
                                    </Text>
                                </View>

                                {selectedChips.length > 0 && (
                                    <View style={styles.confirmSummaryRow}>
                                        <Text
                                            style={styles.confirmSummaryLabel}
                                        >
                                            HAZARDS
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
                                            NOTES
                                        </Text>
                                        <Text
                                            numberOfLines={3}
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

                                <View style={styles.confirmSummaryRow}>
                                    <Text style={styles.confirmSummaryLabel}>
                                        LOCATION
                                    </Text>
                                    <Text
                                        style={[
                                            styles.confirmSummaryValue,
                                            isDarkHud && styles.darkOptionText,
                                        ]}
                                        testID="sos-confirm-location"
                                    >
                                        {cachedLocation
                                            ? nearestPlace.status === 'resolved'
                                                ? (placeLabel(nearestPlace) ??
                                                  nearestPlace.primary)
                                                : nearestPlace.status ===
                                                    'pending'
                                                  ? 'Finding address…'
                                                  : 'Address unavailable'
                                            : 'No GPS fix yet'}
                                    </Text>
                                    {cachedLocation ? (
                                        <Text
                                            style={[
                                                styles.confirmSummaryCoords,
                                                isDarkHud && styles.darkHelper,
                                            ]}
                                        >
                                            {formatCoordinates(
                                                cachedLocation.latitude,
                                                cachedLocation.longitude,
                                            )}
                                            {accuracyText
                                                ? ` · ${accuracyText}`
                                                : ''}
                                        </Text>
                                    ) : null}
                                </View>

                                <View style={styles.confirmSummaryRow}>
                                    <Text style={styles.confirmSummaryLabel}>
                                        JOB
                                    </Text>
                                    <Text
                                        style={[
                                            styles.confirmSummaryValue,
                                            isDarkHud && styles.darkOptionText,
                                        ]}
                                    >
                                        {jobContextLabel ?? 'No active job'}
                                    </Text>
                                </View>
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
                                    style={({ pressed }) => [
                                        styles.confirmCancelBtn,
                                        isDarkHud &&
                                            styles.darkConfirmCancelBtn,
                                        pressed && styles.pressed,
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
                                    style={({ pressed }) => [
                                        styles.confirmSendBtn,
                                        pressed && styles.pressed,
                                    ]}
                                    testID="confirm-broadcast-btn"
                                >
                                    <Icon
                                        color="#FFFFFF"
                                        name="alert"
                                        size={18}
                                    />
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
        gap: 12,
        paddingBottom: 14,
        paddingHorizontal: 16,
    },
    headerMark: {
        alignItems: 'center',
        backgroundColor: '#DC2626',
        borderRadius: 12,
        height: 40,
        justifyContent: 'center',
        width: 40,
    },
    headerCopy: {
        flex: 1,
        gap: 1,
    },
    eyebrow: {
        color: colors.redDark,
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 1.1,
    },
    darkEyebrow: {
        color: '#F87171',
    },
    title: {
        color: colors.text,
        fontSize: 22,
        fontWeight: '800',
    },
    closeButton: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderRadius: 24,
        height: 44,
        justifyContent: 'center',
        width: 44,
    },
    pressed: {
        opacity: 0.8,
    },
    content: {
        alignSelf: 'center',
        gap: 16,
        maxWidth: 680,
        padding: 16,
        paddingBottom: 24,
        width: '100%',
    },
    pillRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    pill: {
        alignItems: 'center',
        borderRadius: 999,
        flexDirection: 'row',
        gap: 6,
        maxWidth: '100%',
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    darkPill: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
        borderWidth: 1,
    },
    pillText: {
        flexShrink: 1,
        fontSize: 12,
        fontVariant: ['tabular-nums'],
        fontWeight: '700',
    },
    footer: {
        backgroundColor: colors.surface,
        borderTopColor: colors.border,
        borderTopWidth: 1,
        gap: 8,
        paddingHorizontal: 16,
        paddingTop: 12,
    },
    darkFooter: {
        backgroundColor: '#0F172A',
        borderTopColor: '#334155',
    },
    footerHint: {
        color: colors.secondary,
        fontSize: 12,
        lineHeight: 17,
        textAlign: 'center',
    },
    footerHintAlert: {
        color: colors.redDark,
        fontWeight: '700',
    },
    darkFooterHintAlert: {
        color: '#FCA5A5',
    },
    holdButton: {
        backgroundColor: '#DC2626',
        borderColor: '#B91C1C',
        borderRadius: 18,
        borderWidth: 2,
        elevation: 6,
        justifyContent: 'center',
        minHeight: 72,
        overflow: 'hidden',
        position: 'relative',
        shadowColor: '#DC2626',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        width: '100%',
    },
    holdButtonActive: {
        borderColor: '#7F1D1D',
        transform: [{ scale: 0.985 }],
    },
    holdButtonBusy: {
        opacity: 0.85,
    },
    holdProgress: {
        backgroundColor: '#7F1D1D',
        bottom: 0,
        left: 0,
        position: 'absolute',
        top: 0,
    },
    holdButtonInner: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    holdButtonIcon: {
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.18)',
        borderRadius: 20,
        height: 40,
        justifyContent: 'center',
        width: 40,
    },
    holdCountdown: {
        color: '#FFFFFF',
        fontSize: 20,
        fontVariant: ['tabular-nums'],
        fontWeight: '900',
    },
    holdButtonCopy: {
        flex: 1,
        gap: 2,
    },
    holdButtonEyebrow: {
        color: '#FEE2E2',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 0.6,
    },
    holdButtonText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '900',
    },
    doneButton: {
        alignItems: 'center',
        backgroundColor: colors.text,
        borderRadius: 14,
        justifyContent: 'center',
        minHeight: 52,
    },
    darkDoneButton: {
        backgroundColor: '#FFBF00',
    },
    doneButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '800',
    },
    darkDoneButtonText: {
        color: '#0F172A',
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
    },
    darkHelper: {
        color: '#94A3B8',
    },
    darkOptionText: {
        color: '#F8FAFC',
    },
    beaconBanner: {
        borderRadius: 16,
        gap: 8,
        padding: 16,
    },
    darkBeaconBanner: {
        backgroundColor: '#1E293B',
        borderWidth: 2,
    },
    beaconHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    pulseDot: {
        borderRadius: 5,
        height: 10,
        width: 10,
    },
    beaconEyebrow: {
        color: '#FFFFFF',
        flexShrink: 1,
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 1,
        opacity: 0.92,
    },
    beaconTitleRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 10,
    },
    beaconTitle: {
        color: '#FFFFFF',
        flex: 1,
        fontSize: 19,
        fontWeight: '900',
        lineHeight: 24,
    },
    beaconBody: {
        color: '#FFFFFF',
        fontSize: 14,
        lineHeight: 20,
        opacity: 0.92,
    },
    darkBeaconBody: {
        color: '#CBD5E1',
        opacity: 1,
    },
    safetyDeskCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 16,
        borderWidth: 1,
        gap: 14,
        padding: 16,
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
        backgroundColor: '#047857',
        borderRadius: 20,
        height: 40,
        justifyContent: 'center',
        width: 40,
    },
    safetyDeskCopy: {
        flex: 1,
        gap: 2,
    },
    safetyDeskTitle: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '800',
    },
    safetyDeskSub: {
        color: colors.secondary,
        fontSize: 13,
        lineHeight: 18,
    },
    confirmModalOverlay: {
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
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
        borderRadius: 28,
        height: 56,
        justifyContent: 'center',
        marginBottom: 4,
        width: 56,
    },
    darkConfirmIconCircle: {
        backgroundColor: 'rgba(239, 68, 68, 0.18)',
    },
    confirmModalTitle: {
        color: '#0F172A',
        fontSize: 20,
        fontWeight: '900',
        textAlign: 'center',
    },
    confirmModalSubtitle: {
        color: '#64748B',
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
    },
    confirmSummaryBox: {
        backgroundColor: '#F8FAFC',
        borderColor: '#E2E8F0',
        borderRadius: 12,
        borderWidth: 1,
        gap: 12,
        padding: 14,
    },
    darkConfirmSummaryBox: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
    },
    confirmSummaryRow: {
        gap: 3,
    },
    confirmSummaryLabel: {
        color: '#64748B',
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 0.8,
    },
    confirmSummaryValue: {
        color: '#0F172A',
        fontSize: 15,
        fontWeight: '700',
        lineHeight: 20,
    },
    confirmSummaryCoords: {
        color: '#64748B',
        fontFamily: 'monospace',
        fontSize: 12,
        fontVariant: ['tabular-nums'],
    },
    confirmModalActions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 4,
    },
    confirmCancelBtn: {
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        borderRadius: 14,
        flex: 1,
        justifyContent: 'center',
        minHeight: 52,
        paddingHorizontal: 12,
    },
    darkConfirmCancelBtn: {
        backgroundColor: '#334155',
    },
    confirmCancelText: {
        color: '#334155',
        fontSize: 15,
        fontWeight: '800',
    },
    confirmSendBtn: {
        alignItems: 'center',
        backgroundColor: '#DC2626',
        borderRadius: 14,
        flex: 1.4,
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
        minHeight: 52,
        paddingHorizontal: 12,
    },
    confirmSendText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '900',
    },
});
