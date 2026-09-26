import React, { useEffect, useMemo, useState } from 'react';
import {
    Animated,
    Easing,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Icon } from '../components/common/Icon';
import { TileScreenHeader } from '../components/layout/tile-screen-header';
import { EndShiftSafeguardModal } from '../components/sheets/EndShiftSafeguardModal';
import { ReliefHandoverModal } from '../components/sheets/ReliefHandoverModal';
import { useHosCompliance } from '../hooks/useHosCompliance';
import type { FieldApiClient } from '../services/apiClient';
import { useTheme } from '../theme';
import type { DutyStatus, ShiftInfo, StandbyReason } from '../types/index';
import { HosCertifyCard } from './hos/hos-certify-card';
import { HosClocksCard } from './hos/hos-clocks-card';
import { DUTY_STATUS_OPTIONS, EMPTY_TIMELINE_DAY } from './hos/hos-constants';
import { HosContinuousRestBanner } from './hos/hos-continuous-rest-banner';
import { HosDutyStatusSelector } from './hos/hos-duty-status-selector';
import { HosEndShiftCard } from './hos/hos-end-shift-card';
import { TIMELINE_HISTORY_DAYS } from './hos/hos-fixtures';
import { HosShiftLimitBanner } from './hos/hos-shift-limit-banner';
import { HosShiftLog } from './hos/hos-shift-log';
import { HosStandbyReasonSelector } from './hos/hos-standby-reason-selector';
import { HosTimelineCard } from './hos/hos-timeline-card';
import type { TimelineDayHistory } from './hos/hos-types';

export type {
    DutyStatusOptionConfig,
    ShiftLogEvent,
    TimelineDayHistory,
    TimelineSegment,
} from './hos/hos-types';
export { INITIAL_LOG_EVENTS, TIMELINE_HISTORY_DAYS } from './hos/hos-fixtures';

export interface HosScreenProps {
    operatorName?: string;
    userRole?: string;
    shiftInfo?: ShiftInfo;
    linkedAssetCode?: string | null;
    maxDriveHours?: number;
    maxShiftHours?: number;
    cycleHoursLimit?: number;
    timelineHistory?: TimelineDayHistory[];
    apiClient?: FieldApiClient;
    activeJobId?: number;
    onBack?: () => void;
    onUpdateDutyStatus?: (
        dutyStatus: DutyStatus,
        standbyReason?: StandbyReason,
        remarks?: string,
    ) => Promise<boolean | void> | boolean | void;
    pendingDutyStatus?: DutyStatus | null;
    pendingDutyState?: 'queued' | 'syncing' | 'failed' | null;
    pendingDutyEvents?: Array<{
        id: string;
        status: DutyStatus;
        state: string;
        occurredAt: string | null;
    }>;
    onReleaseUnit?: (assetCode: string) => void;
    onToggleShift?: (nextStatus: 'on_shift' | 'off_shift') => void;
    onEndShift?: () => void;
}

export const HosScreen: React.FC<HosScreenProps> = ({
    operatorName = 'Alex Rivera',
    userRole = 'Certified Crane Operator',
    shiftInfo = {
        status: 'on_shift',
        dutyStatus: 'operating',
        startedAt: '08:00 AM',
        hoursElapsed: 4.5,
    },
    linkedAssetCode = 'CRN-101',
    maxDriveHours = 11,
    maxShiftHours = 14,
    cycleHoursLimit = 70,
    timelineHistory = TIMELINE_HISTORY_DAYS,
    apiClient,
    activeJobId,
    onBack,
    onUpdateDutyStatus,
    onReleaseUnit,
    onToggleShift,
    onEndShift,
    pendingDutyStatus = null,
    pendingDutyState = null,
    pendingDutyEvents = [],
}) => {
    const { isDarkHud } = useTheme();
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

    const selectedStatus: DutyStatus =
        overriddenStatus && overriddenStatus.propStatus === shiftInfo.dutyStatus
            ? overriddenStatus.localStatus
            : (shiftInfo.dutyStatus ?? 'operating');

    const setSelectedStatus = (status: DutyStatus) => {
        setOverriddenStatus({
            propStatus: shiftInfo.dutyStatus,
            localStatus: status,
        });
    };
    const [standbyReason, setStandbyReason] =
        useState<StandbyReason>('client_delay');
    const [remarks, setRemarks] = useState('');
    const [isCertified, setIsCertified] = useState(true);
    const [isSaved, setIsSaved] = useState(false);
    const [safeguardModalOpen, setSafeguardModalOpen] = useState(false);
    const [reliefHandoverOpen, setReliefHandoverOpen] = useState(false);
    const [handoverPin, setHandoverPin] = useState<string>('');
    const [handoverReliefName, setHandoverReliefName] = useState<string>(
        'Standby / Incoming Relief',
    );

    useEffect(() => {
        if (reliefHandoverOpen && activeJobId && apiClient) {
            apiClient
                .initiateEquipmentHandover(activeJobId)
                .then((res) => {
                    if (res?.pin) {
                        setHandoverPin(res.pin);
                    }

                    if (res?.relief_operator?.name) {
                        setHandoverReliefName(res.relief_operator.name);
                    }
                })
                .catch(() => {
                    if (!handoverPin) {
                        setHandoverPin('8421');
                    }
                });
        }
    }, [reliefHandoverOpen, activeJobId, apiClient, handoverPin]);

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
    const hoursElapsed = hosCompliance.hoursElapsed;
    const hasServerClock =
        shiftInfo.shiftElapsedMinutes !== null &&
        shiftInfo.shiftElapsedMinutes !== undefined;
    const limitCounterHours = hosCompliance.limitCounterHours;
    const cycleHoursElapsed =
        shiftInfo.cycleAccumulatedMinutes !== null &&
        shiftInfo.cycleAccumulatedMinutes !== undefined
            ? shiftInfo.cycleAccumulatedMinutes / 60
            : null;

    // DOLE 10-Hour Shift Limit Compliance Checks
    const isDoleWarning = hosCompliance.isDoleWarning;
    const isDoleCapExceeded = hosCompliance.isDoleCapExceeded;

    // Remaining ELD calculations
    const driveRemainingHours =
        shiftInfo.driveRemainingMinutes !== null &&
        shiftInfo.driveRemainingMinutes !== undefined
            ? shiftInfo.driveRemainingMinutes / 60
            : null;
    const shiftRemainingHours =
        shiftInfo.shiftWindowRemainingMinutes !== null &&
        shiftInfo.shiftWindowRemainingMinutes !== undefined
            ? shiftInfo.shiftWindowRemainingMinutes / 60
            : null;
    const cycleRemainingHours =
        shiftInfo.cycleRemainingMinutes !== null &&
        shiftInfo.cycleRemainingMinutes !== undefined
            ? shiftInfo.cycleRemainingMinutes / 60
            : null;
    const breakCountdownHours =
        shiftInfo.breakCountdownMinutes !== null &&
        shiftInfo.breakCountdownMinutes !== undefined
            ? shiftInfo.breakCountdownMinutes / 60
            : null;
    const shiftOperatingHours =
        shiftInfo.operatingMinutes !== null &&
        shiftInfo.operatingMinutes !== undefined
            ? shiftInfo.operatingMinutes / 60
            : null;
    const shiftDrivingHours =
        shiftInfo.drivingMinutes !== null &&
        shiftInfo.drivingMinutes !== undefined
            ? shiftInfo.drivingMinutes / 60
            : null;
    const shiftStandbyHours =
        shiftInfo.standbyMinutes !== null &&
        shiftInfo.standbyMinutes !== undefined
            ? shiftInfo.standbyMinutes / 60
            : null;
    const shiftBreakHours =
        shiftInfo.breakMinutes !== null && shiftInfo.breakMinutes !== undefined
            ? shiftInfo.breakMinutes / 60
            : null;
    const durationBreakdown: Array<[string, number | null]> = [
        ['Operating', shiftOperatingHours],
        ['Driving', shiftDrivingHours],
        ['Standby', shiftStandbyHours],
        ['Breaks', shiftBreakHours],
    ];

    const shiftProgressPercent =
        hasServerClock && hoursElapsed !== null
            ? Math.min(100, Math.round((hoursElapsed / maxShiftHours) * 100))
            : null;

    const executeDutyUpdate = async (
        statusToSet: DutyStatus = selectedStatus,
    ) => {
        try {
            const accepted = await onUpdateDutyStatus?.(
                statusToSet,
                statusToSet === 'standby' ? standbyReason : undefined,
                remarks.trim() ? remarks.trim() : undefined,
            );

            if (accepted !== false) {
                setIsSaved(true);
            }
        } catch {
            setIsSaved(false);
        }
    };

    const handleConfirm = () => {
        if (selectedStatus === 'off_duty') {
            if (linkedAssetCode) {
                setSafeguardModalOpen(true);

                return;
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

    return (
        <View
            style={[styles.screenRoot, isDarkHud && styles.darkScreenRoot]}
            testID="hos-screen"
        >
            {/* 1. Unified Minimalist Header Bar matching other tiles */}
            <TileScreenHeader
                backAccessibilityLabel="Back to dashboard"
                backTestID="hos-back-btn"
                category="Hours of Service"
                onBack={onBack}
                rightElement={
                    <View
                        style={[
                            styles.dutyPillBadge,
                            isDarkHud && styles.darkDutyPillBadge,
                        ]}
                    >
                        <View
                            style={[
                                styles.dutyBadgeDot,
                                { backgroundColor: activeConfig.accentColor },
                            ]}
                        />
                        <Text
                            style={[
                                styles.dutyPillBadgeText,
                                isDarkHud && styles.darkDutyPillBadgeText,
                            ]}
                        >
                            {activeConfig.badge}
                        </Text>
                    </View>
                }
                subtitle={`Operator: ${operatorName} · Shift Started: ${shiftInfo?.startedAt ?? 'Unavailable'} (${shiftInfo.hoursElapsed == null ? 'Unavailable' : `${shiftInfo.hoursElapsed.toFixed(1)}h`} Elapsed)`}
                title="Duty Status & Shift Management"
            />

            {/* 2. Scrollable Cockpit Content */}
            <ScrollView
                accessibilityLabel="Hours of service duty status and clocks"
                contentContainerStyle={styles.contentContainer}
                style={styles.scrollView}
            >
                {pendingDutyState && pendingDutyStatus ? (
                    <View
                        accessibilityRole={
                            pendingDutyState === 'failed' ? 'alert' : undefined
                        }
                        style={[
                            styles.syncStatusBanner,
                            isDarkHud && styles.darkSyncStatusBanner,
                            pendingDutyState === 'failed' &&
                                styles.syncStatusBannerFailed,
                            isDarkHud &&
                                pendingDutyState === 'failed' &&
                                styles.darkSyncStatusBannerFailed,
                        ]}
                        testID="hos-duty-sync-status"
                    >
                        <Icon
                            color={
                                pendingDutyState === 'failed'
                                    ? '#DC2626'
                                    : '#2563EB'
                            }
                            name={
                                pendingDutyState === 'failed'
                                    ? 'alert'
                                    : 'cloud'
                            }
                            size={17}
                        />
                        <Text
                            style={[
                                styles.syncStatusText,
                                isDarkHud && styles.darkSyncStatusText,
                                pendingDutyState === 'failed' &&
                                    styles.syncStatusTextFailed,
                            ]}
                        >
                            {pendingDutyState === 'failed'
                                ? 'Duty update was not accepted. Review the failed action in Outbox.'
                                : `Duty update pending sync: ${pendingDutyStatus.replace('_', ' ')}`}
                        </Text>
                    </View>
                ) : null}

                {pendingDutyEvents.length > 1 ? (
                    <View
                        accessibilityLabel={`${pendingDutyEvents.length} duty events waiting for synchronization`}
                        style={[
                            styles.syncStatusBanner,
                            isDarkHud && styles.darkSyncStatusBanner,
                        ]}
                        testID="hos-duty-sync-queue"
                    >
                        <Icon
                            color={isDarkHud ? '#93C5FD' : '#2563EB'}
                            name="list"
                            size={17}
                        />
                        <View style={{ flex: 1 }}>
                            <Text
                                style={[
                                    styles.syncStatusText,
                                    isDarkHud && styles.darkSyncStatusText,
                                ]}
                            >
                                Pending duty events are ordered locally; server
                                totals remain unchanged.
                            </Text>
                            {pendingDutyEvents.map((event, index) => (
                                <Text
                                    key={event.id}
                                    style={[
                                        styles.syncStatusText,
                                        isDarkHud && styles.darkSyncStatusText,
                                    ]}
                                >
                                    {index + 1}.{' '}
                                    {event.status.replace('_', ' ')} ·{' '}
                                    {event.state === 'failed'
                                        ? 'Rejected'
                                        : 'Pending'}
                                </Text>
                            ))}
                        </View>
                    </View>
                ) : null}

                {/* DOLE 4.5-Hour Continuous Operation Rest Prompter Banner */}
                {hosCompliance.breakSuggestion ? (
                    <HosContinuousRestBanner
                        breakSuggestion={hosCompliance.breakSuggestion}
                        hosCompliance={hosCompliance}
                        onUpdateDutyStatus={onUpdateDutyStatus}
                        setOverriddenStatus={setOverriddenStatus}
                        shiftInfo={shiftInfo}
                    />
                ) : null}
                {/* DOLE 10-Hour Shift Limit Compliance Warning / Hard Stop Banner */}
                {isDoleWarning || isDoleCapExceeded ? (
                    <HosShiftLimitBanner
                        isDoleCapExceeded={isDoleCapExceeded}
                        setReliefHandoverOpen={setReliefHandoverOpen}
                    />
                ) : null}
                {/* 3. Live ELD Clocks Card */}
                <HosClocksCard
                    breakCountdownHours={breakCountdownHours}
                    cycleHoursElapsed={cycleHoursElapsed}
                    cycleHoursLimit={cycleHoursLimit}
                    cycleRemainingHours={cycleRemainingHours}
                    driveRemainingHours={driveRemainingHours}
                    durationBreakdown={durationBreakdown}
                    hasServerClock={hasServerClock}
                    hoursElapsed={hoursElapsed}
                    limitCounterHours={limitCounterHours}
                    maxDriveHours={maxDriveHours}
                    maxShiftHours={maxShiftHours}
                    shiftInfo={shiftInfo}
                    shiftProgressPercent={shiftProgressPercent}
                    shiftRemainingHours={shiftRemainingHours}
                    userRole={userRole}
                />
                {/* 4. Active Duty Status Selector */}
                <HosDutyStatusSelector
                    selectedStatus={selectedStatus}
                    setIsSaved={setIsSaved}
                    setSelectedStatus={setSelectedStatus}
                />
                {/* 5. Standby & Demurrage Reason Selector (when Standby is chosen) */}
                {selectedStatus === 'standby' ? (
                    <HosStandbyReasonSelector
                        setIsSaved={setIsSaved}
                        setStandbyReason={setStandbyReason}
                        standbyReason={standbyReason}
                    />
                ) : null}
                {/* 6. Remarks & Duty Transition Submission Card */}
                <HosCertifyCard
                    activeConfig={activeConfig}
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
                {/* 6b. Compliant End Shift & Clock Out Safeguard Card */}
                <HosEndShiftCard
                    executeDutyUpdate={executeDutyUpdate}
                    linkedAssetCode={linkedAssetCode}
                    onEndShift={onEndShift}
                    onToggleShift={onToggleShift}
                    selectedStatus={selectedStatus}
                    setSafeguardModalOpen={setSafeguardModalOpen}
                    setSelectedStatus={setSelectedStatus}
                    shiftInfo={shiftInfo}
                />
                {/* 7. 24-Hour Duty Timeline Graph (Samsara / ELD Visual Graph) & 8-Day Cycle History */}
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

            {/* End Shift Safeguard Intercept Modal */}
            <EndShiftSafeguardModal
                assetCode={linkedAssetCode || 'CRN-101'}
                onCancel={() => setSafeguardModalOpen(false)}
                onConfirmReleaseAndClockOut={() => {
                    setSafeguardModalOpen(false);
                    onReleaseUnit?.(linkedAssetCode || 'CRN-101');
                    setSelectedStatus('off_duty');
                    executeDutyUpdate('off_duty');
                    onToggleShift?.('off_shift');
                    onEndShift?.();
                }}
                visible={safeguardModalOpen}
            />

            {/* Smart Dual Hot-Seating Relief Handover Modal */}
            <ReliefHandoverModal
                assetCode={linkedAssetCode || 'CRN-101'}
                handoverPin={handoverPin || '8421'}
                mode="outgoing_offer"
                onClose={() => setReliefHandoverOpen(false)}
                onInitiatePushHandover={() => {
                    // Push notification alert dispatched to scheduled incoming relief operator
                }}
                reliefOperatorName={handoverReliefName}
                visible={reliefHandoverOpen}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    screenRoot: {
        backgroundColor: '#F1F5F9',
        flex: 1,
    },
    darkScreenRoot: {
        backgroundColor: '#090D16',
    },
    dutyPillBadge: {
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderColor: '#E2E8F0',
        borderRadius: 9999,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 5,
    },
    darkDutyPillBadge: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
    },
    dutyBadgeDot: {
        borderRadius: 4,
        height: 8,
        width: 8,
    },
    dutyPillBadgeText: {
        color: '#0F172A',
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    darkDutyPillBadgeText: {
        color: '#F8FAFC',
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
    syncStatusBanner: {
        alignItems: 'center',
        backgroundColor: '#EFF6FF',
        borderColor: '#BFDBFE',
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 8,
        marginBottom: 14,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    darkSyncStatusBanner: {
        backgroundColor: '#172554',
        borderColor: '#1D4ED8',
    },
    syncStatusBannerFailed: {
        backgroundColor: '#FEF2F2',
        borderColor: '#FECACA',
    },
    darkSyncStatusBannerFailed: {
        backgroundColor: '#450A0A',
        borderColor: '#B91C1C',
    },
    syncStatusText: {
        color: '#1D4ED8',
        flex: 1,
        fontSize: 12,
        fontWeight: '700',
        lineHeight: 16,
    },
    darkSyncStatusText: {
        color: '#BFDBFE',
    },
    syncStatusTextFailed: {
        color: '#B91C1C',
    },
});
