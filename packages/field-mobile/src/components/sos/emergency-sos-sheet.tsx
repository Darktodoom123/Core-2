import React, {
    useCallback,
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
import { EmergencyContactActions } from './emergency-contact-actions';
import { SosCategorySelector } from './sos-category-selector';
import { SosDeliveryStatus } from './sos-delivery-status';
import { Icon } from '../common/Icon';
import { colors } from '../nativeStyles';
import type {
    ActivateSosIncidentPayload,
    DispatchJob,
    SosDeliveryState,
    SosEmergencyAction,
    SosIncident,
    SosIncidentCategory,
} from '../../types/index';

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
    onClassify: (category: SosIncidentCategory) => Promise<void>;
}

function contextLabel(job: DispatchJob): string {
    return `${job.reference} · ${job.site}`;
}

export const EmergencySosSheet: React.FC<EmergencySosSheetProps> = ({
    visible,
    jobs,
    activeIncident,
    deliveryState,
    isOnline,
    actions,
    onClose,
    onActivate,
    onClassify,
}) => {
    const [selectedJobId, setSelectedJobId] = useState<number | null>(
        jobs[0]?.id ?? null,
    );
    const [selectedAssetId, setSelectedAssetId] = useState<number | null>(
        jobs[0]?.asset_assignments?.[0]?.operational_asset_id ?? null,
    );
    const [category, setCategory] = useState<SosIncidentCategory>(
        activeIncident?.category ?? 'unclassified',
    );
    const [holdProgress, setHoldProgress] = useState(0);
    const [isActivating, setIsActivating] = useState(false);
    const [reduceMotion, setReduceMotion] = useState(false);
    const holdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const holdCompletedRef = useRef(false);
    const contextInitializedRef = useRef(jobs.length > 0);

    const selectedJob = useMemo(
        () => jobs.find((job) => job.id === selectedJobId) ?? null,
        [jobs, selectedJobId],
    );

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
        if (!activeIncident) {
            setCategory('unclassified');
        } else {
            setCategory(activeIncident.category);
        }
    }, [activeIncident]);

    useEffect(() => {
        if (!contextInitializedRef.current && jobs.length > 0) {
            contextInitializedRef.current = true;
            setSelectedJobId(jobs[0].id);
            setSelectedAssetId(
                jobs[0].asset_assignments?.[0]?.operational_asset_id ?? null,
            );
        }
    }, [jobs]);

    useEffect(() => {
        if (selectedJob) {
            setSelectedAssetId(
                selectedJob.asset_assignments?.[0]?.operational_asset_id ??
                    null,
            );
        }
    }, [selectedJob]);

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
        setIsActivating(true);
        Vibration.vibrate(90);

        void onActivate({
            category: 'unclassified',
            device_activated_at: new Date().toISOString(),
            dispatch_job_id: selectedJobId,
            operational_asset_id: selectedAssetId,
            location: null,
        }).finally(() => {
            setIsActivating(false);
        });
    }, [
        activeIncident,
        clearHold,
        isActivating,
        onActivate,
        selectedAssetId,
        selectedJobId,
    ]);

    const startHold = useCallback(() => {
        if (isActivating || activeIncident || holdTimerRef.current) {
            return;
        }

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

    const statusDetail =
        deliveryState === 'not_delivered_offline'
            ? 'The alert is saved on this device, but no server acceptance exists.'
            : deliveryState === 'delivered'
              ? 'Core 2 has confirmed receipt. Help is not claimed until a responder acknowledges.'
              : isOnline === false
                ? 'No connection. Use call or text now while the saved alert waits to retry.'
                : null;

    const hasTerminalIncident =
        activeIncident?.status === 'resolved' ||
        activeIncident?.status === 'cancelled';

    return (
        <Modal
            accessibilityViewIsModal
            animationType={reduceMotion ? 'none' : 'slide'}
            onRequestClose={onClose}
            transparent={false}
            visible={visible}
        >
            <View style={styles.root} testID="emergency-sos-sheet">
                <View style={styles.header}>
                    <View style={styles.headerCopy}>
                        <Text selectable style={styles.eyebrow}>
                            SAFETY ACTION
                        </Text>
                        <Text
                            accessibilityRole="header"
                            selectable
                            style={styles.title}
                        >
                            Emergency SOS
                        </Text>
                    </View>
                    <Pressable
                        accessibilityLabel="Close Emergency SOS"
                        accessibilityRole="button"
                        onPress={onClose}
                        style={styles.closeButton}
                    >
                        <Icon color={colors.text} name="close" size={22} />
                    </Pressable>
                </View>

                <ScrollView
                    contentContainerStyle={styles.content}
                    contentInsetAdjustmentBehavior="automatic"
                >
                    <Text selectable style={styles.intro}>
                        Use SOS for immediate danger, an accident, or a critical
                        asset malfunction. Core 2 shares available dispatch,
                        asset, and one-time location context.
                    </Text>

                    <SosDeliveryStatus
                        detail={statusDetail}
                        state={deliveryState}
                    />

                    {!activeIncident && deliveryState === 'preparing' ? (
                        <View style={styles.contextSection}>
                            <Text selectable style={styles.sectionTitle}>
                                Attach context (optional)
                            </Text>
                            <Text selectable style={styles.helper}>
                                SOS remains available without a dispatch or
                                asset. Choose only an active assignment you
                                recognize.
                            </Text>
                            <View style={styles.contextOptions}>
                                <Pressable
                                    accessibilityLabel="No dispatch context"
                                    accessibilityRole="radio"
                                    accessibilityState={{
                                        selected: selectedJobId === null,
                                    }}
                                    onPress={() => {
                                        setSelectedJobId(null);
                                        setSelectedAssetId(null);
                                    }}
                                    style={[
                                        styles.contextOption,
                                        selectedJobId === null &&
                                            styles.contextOptionSelected,
                                    ]}
                                >
                                    <Text selectable style={styles.contextText}>
                                        No dispatch context
                                    </Text>
                                </Pressable>
                                {jobs.map((job) => {
                                    const selected = selectedJobId === job.id;

                                    return (
                                        <Pressable
                                            accessibilityLabel={`Attach ${job.reference}`}
                                            accessibilityRole="radio"
                                            accessibilityState={{ selected }}
                                            key={job.id}
                                            onPress={() =>
                                                setSelectedJobId(job.id)
                                            }
                                            style={[
                                                styles.contextOption,
                                                selected &&
                                                    styles.contextOptionSelected,
                                            ]}
                                        >
                                            <Text
                                                selectable
                                                style={styles.contextText}
                                            >
                                                {contextLabel(job)}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                            {selectedJob?.asset_assignments?.length ? (
                                <View style={styles.assetOptions}>
                                    <Text selectable style={styles.assetLabel}>
                                        Asset (optional)
                                    </Text>
                                    {selectedJob.asset_assignments.map(
                                        (asset) => (
                                            <Pressable
                                                accessibilityLabel={`Attach asset ${asset.asset_code}`}
                                                accessibilityRole="radio"
                                                accessibilityState={{
                                                    selected:
                                                        selectedAssetId ===
                                                        asset.operational_asset_id,
                                                }}
                                                key={asset.id}
                                                onPress={() =>
                                                    setSelectedAssetId(
                                                        asset.operational_asset_id,
                                                    )
                                                }
                                                style={[
                                                    styles.assetOption,
                                                    selectedAssetId ===
                                                        asset.operational_asset_id &&
                                                        styles.assetOptionSelected,
                                                ]}
                                            >
                                                <Text
                                                    selectable
                                                    style={styles.contextText}
                                                >
                                                    {asset.asset_code} ·{' '}
                                                    {asset.asset_name}
                                                </Text>
                                            </Pressable>
                                        ),
                                    )}
                                </View>
                            ) : null}
                        </View>
                    ) : null}

                    {!activeIncident && deliveryState === 'preparing' ? (
                        <View style={styles.holdSection}>
                            <Text selectable style={styles.holdInstruction}>
                                Press and hold for two seconds to activate.
                            </Text>
                            <Text selectable style={styles.helper}>
                                A normal tap will not send an alert. Location
                                permission, GPS timeout, or no connection will
                                not block the attempt.
                            </Text>
                            <Pressable
                                accessibilityActions={[
                                    {
                                        label: 'Hold for two seconds to activate Emergency SOS',
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
                                disabled={isActivating}
                                onAccessibilityAction={
                                    handleAccessibilityAction
                                }
                                onPressIn={startHold}
                                onPressOut={endHold}
                                style={styles.holdButton}
                                testID="activate-emergency-sos"
                            >
                                <View
                                    style={[
                                        styles.holdProgress,
                                        {
                                            width: `${holdProgress * 100}%`,
                                        },
                                    ]}
                                />
                                <Text selectable style={styles.holdButtonText}>
                                    {isActivating
                                        ? 'Sending SOS…'
                                        : holdProgress > 0
                                          ? `Hold ${Math.ceil((1 - holdProgress) * 2)}s more`
                                          : 'Activate Emergency SOS'}
                                </Text>
                            </Pressable>
                        </View>
                    ) : null}

                    {activeIncident && !hasTerminalIncident ? (
                        <SosCategorySelector
                            disabled={deliveryState === 'sending'}
                            onChange={(nextCategory) => {
                                setCategory(nextCategory);
                                void onClassify(nextCategory);
                            }}
                            value={category}
                        />
                    ) : null}

                    {!activeIncident &&
                    (deliveryState === 'not_delivered_offline' ||
                        deliveryState === 'expired') ? (
                        <EmergencyContactActions actions={actions} />
                    ) : null}

                    {activeIncident?.dispatch ? (
                        <Text selectable style={styles.serverContext}>
                            Server context: {activeIncident.dispatch.reference}
                            {activeIncident.asset
                                ? ` · ${activeIncident.asset.code}`
                                : ''}
                        </Text>
                    ) : null}
                </ScrollView>
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
        backgroundColor: colors.surface,
        borderColor: colors.redBorder,
        borderRadius: 14,
        borderWidth: 1,
        gap: 10,
        padding: 14,
    },
    holdInstruction: {
        color: colors.redDark,
        fontSize: 17,
        fontWeight: '800',
    },
    holdButton: {
        alignItems: 'center',
        backgroundColor: colors.redDark,
        borderRadius: 12,
        justifyContent: 'center',
        minHeight: 60,
        overflow: 'hidden',
        position: 'relative',
    },
    holdProgress: {
        backgroundColor: colors.red,
        bottom: 0,
        left: 0,
        opacity: 0.9,
        position: 'absolute',
        top: 0,
    },
    holdButtonText: {
        color: colors.white,
        fontSize: 16,
        fontWeight: '800',
        zIndex: 1,
    },
    serverContext: {
        color: colors.secondary,
        fontSize: 13,
        lineHeight: 18,
    },
});
