import React, { useEffect, useMemo, useState } from 'react';
import {
    Animated,
    Easing,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { UNIT_TYPES } from '../components/inspection/defects/unit-type';
import { TileScreenHeader } from '../components/layout/tile-screen-header';
import { ReliefHandoverModal } from '../components/sheets/ReliefHandoverModal';
import { useHosCompliance } from '../hooks/useHosCompliance';
import type { FieldApiClient } from '../services/apiClient';
import { useTheme, useThemedStyles } from '../theme';
import type { ThemeColors } from '../theme';
import type { DutyStatus, ShiftInfo, StandbyReason } from '../types/index';
import type { DesignatedEquipmentType } from '../utils/equipmentClassification';
import { HosCertifyCard } from './hos/hos-certify-card';
import { HosClocksCard } from './hos/hos-clocks-card';
import {
    DOLE_CAP_HOURS,
    DUTY_STATUS_OPTIONS,
    EMPTY_TIMELINE_DAY,
} from './hos/hos-constants';
import { HosContinuousRestBanner } from './hos/hos-continuous-rest-banner';
import { HosDutyStatusSelector } from './hos/hos-duty-status-selector';
import { endShiftStepFor } from './hos/hos-end-shift';
import { HosEndShiftNotice } from './hos/hos-end-shift-notice';
import { HosShiftLimitBanner } from './hos/hos-shift-limit-banner';
import { HosShiftLog } from './hos/hos-shift-log';
import { HosStandbyReasonSelector } from './hos/hos-standby-reason-selector';
import { standbyReasonsFor } from './hos/hos-standby-reasons';
import { HosSyncBanner } from './hos/hos-sync-banner';
import type { HosSyncSummary } from './hos/hos-sync-summary';
import { HosTimelineCard } from './hos/hos-timeline-card';
import type { TimelineDayHistory } from './hos/hos-types';

export type {
    DutyStatusOptionConfig,
    ShiftLogEvent,
    TimelineDayHistory,
    TimelineSegment,
} from './hos/hos-types';

export interface HosScreenProps {
    operatorName?: string;
    shiftInfo?: ShiftInfo;
    linkedAssetCode?: string | null;
    /** The linked machine's type; decides which standby reasons apply. */
    linkedAssetType?: DesignatedEquipmentType | null;
    /** A post-trip DVIR was saved for the linked machine this shift. */
    postTripDone?: boolean;
    /** Opens the DVIR in post-trip mode for the linked machine. */
    onStartPostTrip?: () => void;
    timelineHistory?: TimelineDayHistory[];
    apiClient?: FieldApiClient;
    activeJobId?: number;
    onBack?: () => void;
    onUpdateDutyStatus?: (
        dutyStatus: DutyStatus,
        standbyReason?: StandbyReason,
        remarks?: string,
    ) => Promise<boolean | void> | boolean | void;
    pendingDutyState?: 'queued' | 'syncing' | 'failed' | null;
    /** Unsent or failed duty changes, from the outbox. */
    dutySync?: HosSyncSummary | null;
    onDiscardDutyChange?: (commandId: string) => void;
    onRetryDutyChange?: (commandId: string) => void;
    onReleaseUnit?: (assetCode: string) => void;
    onToggleShift?: (nextStatus: 'on_shift' | 'off_shift') => void;
    onEndShift?: () => void;
}

const OFF_SHIFT: ShiftInfo = {
    status: 'off_shift',
    dutyStatus: 'off_duty',
    startedAt: null,
    hoursElapsed: null,
};

export const HosScreen: React.FC<HosScreenProps> = ({
    operatorName = '',
    // Nothing is assumed: without server data the operator is off duty.
    shiftInfo = OFF_SHIFT,
    linkedAssetCode = null,
    linkedAssetType = null,
    postTripDone = false,
    onStartPostTrip,
    timelineHistory = [],
    apiClient,
    activeJobId,
    onBack,
    onUpdateDutyStatus,
    onReleaseUnit,
    onToggleShift,
    onEndShift,
    pendingDutyState = null,
    dutySync = null,
    onDiscardDutyChange,
    onRetryDutyChange,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const [selectedDayIndex, setSelectedDayIndex] = useState(0);
    const historyDays =
        timelineHistory && timelineHistory.length > 0
            ? timelineHistory
            : [EMPTY_TIMELINE_DAY];
    const selectedDay = historyDays[selectedDayIndex] ?? historyDays[0];

    const handlePrevDay = () => {
        if (selectedDayIndex < historyDays.length - 1) {
            setSelectedDayIndex((prev) => prev + 1);
        }
    };

    const handleNextDay = () => {
        if (selectedDayIndex > 0) {
            setSelectedDayIndex((prev) => prev - 1);
        }
    };

    const [overriddenStatus, setOverriddenStatus] = useState<{
        propStatus?: DutyStatus;
        localStatus: DutyStatus;
    } | null>(null);

    // What the server last accepted; the selection below is only a draft.
    const shiftActive =
        shiftInfo.status !== 'off_shift' && shiftInfo.dutyStatus !== 'off_duty';
    const currentStatus: DutyStatus = shiftActive
        ? (shiftInfo.dutyStatus ?? 'operating')
        : 'off_duty';
    const selectedStatus: DutyStatus =
        overriddenStatus && overriddenStatus.propStatus === shiftInfo.dutyStatus
            ? overriddenStatus.localStatus
            : currentStatus;

    const setSelectedStatus = (status: DutyStatus) => {
        setOverriddenStatus({
            propStatus: shiftInfo.dutyStatus,
            localStatus: status,
        });
    };
    // The operator picks a standby reason; none is chosen for them.
    const [standbyReason, setStandbyReason] = useState<StandbyReason | null>(
        null,
    );
    const standbyOptions = standbyReasonsFor(
        linkedAssetCode ? linkedAssetType : null,
    );
    const chosenReason = standbyOptions.some(
        (item) => item.reason === standbyReason,
    )
        ? standbyReason
        : null;
    const reasonMissing = selectedStatus === 'standby' && chosenReason === null;
    const [remarks, setRemarks] = useState('');
    // The operator ticks the certification themselves; it never starts ticked.
    const [isCertified, setIsCertified] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [reliefHandoverOpen, setReliefHandoverOpen] = useState(false);
    // Confirmation & Micro-interaction Animations (Apple HIG spring & hardware-accelerated transforms)
    const stampScale = useMemo(() => new Animated.Value(0.95), []);
    const stampOpacity = useMemo(() => new Animated.Value(0), []);
    const certCheckScale = useMemo(() => new Animated.Value(1), []);

    const handleToggleCert = () => {
        Animated.sequence([
            Animated.timing(certCheckScale, {
                toValue: 0.88,
                duration: 80,
                useNativeDriver: true,
            }),
            Animated.spring(certCheckScale, {
                toValue: 1,
                friction: 5,
                tension: 140,
                useNativeDriver: true,
            }),
        ]).start();
        setIsCertified((prev) => !prev);
    };

    useEffect(() => {
        if (isSaved) {
            Animated.parallel([
                Animated.timing(stampOpacity, {
                    toValue: 1,
                    duration: 200,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.spring(stampScale, {
                    toValue: 1,
                    friction: 6,
                    tension: 90,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            stampScale.setValue(0.95);
            stampOpacity.setValue(0);
        }
    }, [isSaved, stampOpacity, stampScale]);

    const hosCompliance = useHosCompliance(shiftInfo, { timelineHistory });
    const toHours = (minutes: number | null | undefined) =>
        minutes === null || minutes === undefined ? null : minutes / 60;
    const durationBreakdown: Array<[string, number | null]> = [
        ['Operating', toHours(shiftInfo.operatingMinutes)],
        ['Driving', toHours(shiftInfo.drivingMinutes)],
        ['Standby', toHours(shiftInfo.standbyMinutes)],
        ['Breaks', toHours(shiftInfo.breakMinutes)],
    ];

    const executeDutyUpdate = async (
        statusToSet: DutyStatus = selectedStatus,
    ) => {
        try {
            const accepted = await onUpdateDutyStatus?.(
                statusToSet,
                statusToSet === 'standby'
                    ? (chosenReason ?? undefined)
                    : undefined,
                remarks.trim() ? remarks.trim() : undefined,
            );

            if (accepted !== false) {
                setIsSaved(true);
            }
        } catch {
            setIsSaved(false);
        }
    };

    // Lifecycle step 7 then 8: a linked machine gets its post-trip DVIR,
    // is released, and only then does the shift end.
    const endShiftStep = endShiftStepFor(linkedAssetCode, postTripDone);

    const handleConfirm = () => {
        if (selectedStatus === 'off_duty') {
            if (endShiftStep === 'post_trip') {
                onStartPostTrip?.();

                return;
            }

            if (linkedAssetCode) {
                onReleaseUnit?.(linkedAssetCode);
            }

            setSelectedStatus('off_duty');
            executeDutyUpdate('off_duty');
            onToggleShift?.('off_shift');
            onEndShift?.();

            return;
        }

        executeDutyUpdate();
    };

    const activeConfig = useMemo(() => {
        return (
            DUTY_STATUS_OPTIONS.find((opt) => opt.status === selectedStatus) ??
            DUTY_STATUS_OPTIONS[0]
        );
    }, [selectedStatus]);
    const currentConfig =
        DUTY_STATUS_OPTIONS.find((opt) => opt.status === currentStatus) ??
        DUTY_STATUS_OPTIONS[DUTY_STATUS_OPTIONS.length - 1];
    const shiftLine = shiftActive
        ? `On shift since ${shiftInfo.startedAt ?? 'earlier today'}`
        : 'No shift running';

    return (
        <View style={[styles.screenRoot]} testID="hos-screen">
            {/* 1. Unified Minimalist Header Bar matching other tiles */}
            <TileScreenHeader
                backAccessibilityLabel="Back to dashboard"
                backTestID="hos-back-btn"
                category="Hours of Service"
                onBack={onBack}
                rightElement={
                    <View style={[styles.dutyPillBadge]}>
                        <View
                            style={[
                                styles.dutyBadgeDot,
                                {
                                    backgroundColor:
                                        theme[currentConfig.accentToken],
                                },
                            ]}
                        />
                        <Text style={[styles.dutyPillBadgeText]}>
                            {currentConfig.badge}
                        </Text>
                    </View>
                }
                subtitle={
                    operatorName ? `${operatorName} · ${shiftLine}` : shiftLine
                }
                title="Duty status"
            />

            {/* 2. Scrollable Cockpit Content */}
            <ScrollView
                accessibilityLabel="Hours of service duty status and clocks"
                contentContainerStyle={styles.contentContainer}
                style={styles.scrollView}
            >
                <HosSyncBanner
                    onDiscard={onDiscardDutyChange}
                    onRetry={onRetryDutyChange}
                    summary={dutySync}
                />

                {/* DOLE 4.5-Hour Continuous Operation Rest Prompter Banner */}
                {hosCompliance.breakSuggestion ? (
                    <HosContinuousRestBanner
                        breakSuggestion={hosCompliance.breakSuggestion}
                        hosCompliance={hosCompliance}
                        setOverriddenStatus={setOverriddenStatus}
                        shiftInfo={shiftInfo}
                    />
                ) : null}
                {/* DOLE 10-Hour Shift Limit Compliance Warning / Hard Stop Banner */}
                {hosCompliance.isDoleWarning ||
                hosCompliance.isDoleCapExceeded ? (
                    <HosShiftLimitBanner
                        isDoleCapExceeded={hosCompliance.isDoleCapExceeded}
                        setReliefHandoverOpen={setReliefHandoverOpen}
                    />
                ) : null}
                <HosClocksCard
                    durationBreakdown={durationBreakdown}
                    isDoleCapExceeded={hosCompliance.isDoleCapExceeded}
                    isDoleWarning={hosCompliance.isDoleWarning}
                    limitCounterHours={hosCompliance.limitCounterHours}
                    shiftActive={shiftActive}
                    startedAt={shiftInfo.startedAt ?? null}
                />
                {/* 4. Active Duty Status Selector */}
                <HosDutyStatusSelector
                    // DOLE-OSHC: the server refuses operating or driving
                    // past 10 hours, so the picker doesn't offer them.
                    blockedReason={`${DOLE_CAP_HOURS}h limit reached this shift`}
                    blockedStatuses={
                        hosCompliance.isDoleCapExceeded
                            ? ['operating', 'driving']
                            : []
                    }
                    currentStatus={currentStatus}
                    selectedStatus={selectedStatus}
                    setIsSaved={setIsSaved}
                    setSelectedStatus={setSelectedStatus}
                />
                {/* 5. Standby & Demurrage Reason Selector (when Standby is chosen) */}
                {selectedStatus === 'standby' ? (
                    <HosStandbyReasonSelector
                        machineLabel={
                            linkedAssetCode
                                ? linkedAssetType
                                    ? `${linkedAssetCode} · ${UNIT_TYPES[linkedAssetType].label}`
                                    : linkedAssetCode
                                : null
                        }
                        onChoose={(reason) => {
                            setStandbyReason(reason);
                            setIsSaved(false);
                        }}
                        options={standbyOptions}
                        standbyReason={chosenReason}
                    />
                ) : null}
                {selectedStatus === 'off_duty' && linkedAssetCode ? (
                    <HosEndShiftNotice
                        assetCode={linkedAssetCode}
                        step={endShiftStep}
                    />
                ) : null}
                {/* 6. Remarks & Duty Transition Submission Card */}
                <HosCertifyCard
                    activeConfig={activeConfig}
                    endShiftStep={endShiftStep}
                    linkedAssetCode={linkedAssetCode}
                    blockedLabel={
                        reasonMissing ? 'Choose a standby reason' : null
                    }
                    currentStatus={currentStatus}
                    certCheckScale={certCheckScale}
                    handleConfirm={handleConfirm}
                    handleToggleCert={handleToggleCert}
                    isCertified={isCertified}
                    isSaved={isSaved}
                    pendingDutyState={pendingDutyState}
                    remarks={remarks}
                    setIsSaved={setIsSaved}
                    setRemarks={setRemarks}
                    stampOpacity={stampOpacity}
                    stampScale={stampScale}
                />
                {/* Duty timeline for the selected day */}
                <HosTimelineCard
                    historyDays={historyDays}
                    selectedDay={selectedDay}
                    selectedDayIndex={selectedDayIndex}
                    setSelectedDayIndex={setSelectedDayIndex}
                    handlePrevDay={handlePrevDay}
                    handleNextDay={handleNextDay}
                />
                {/* 8. Chronological Shift Log Events History */}
                <HosShiftLog selectedDay={selectedDay} />
            </ScrollView>

            {/* Smart Dual Hot-Seating Relief Handover Modal */}
            <ReliefHandoverModal
                apiClient={apiClient}
                assetCode={linkedAssetCode ?? undefined}
                jobId={activeJobId ?? null}
                mode="outgoing_offer"
                onClose={() => setReliefHandoverOpen(false)}
                visible={reliefHandoverOpen}
            />
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        screenRoot: {
            backgroundColor: theme.canvas,
            flex: 1,
        },
        dutyPillBadge: {
            alignItems: 'center',
            backgroundColor: theme.surfaceHighlight,
            borderColor: theme.border,
            borderRadius: 9999,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 5,
        },
        dutyBadgeDot: {
            borderRadius: 4,
            height: 8,
            width: 8,
        },
        dutyPillBadgeText: {
            color: theme.textPrimary,
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 0.5,
        },
        scrollView: {
            flex: 1,
        },
        contentContainer: {
            alignSelf: 'center',
            maxWidth: 720,
            padding: 16,
            paddingBottom: 36,
            width: '100%',
        },
    });
