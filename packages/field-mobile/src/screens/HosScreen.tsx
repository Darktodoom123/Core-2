import React, { useMemo, useState } from 'react';
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { Icon } from '../components/common/Icon';
import type { IconName } from '../components/common/Icon';
import { EndShiftSafeguardModal } from '../components/sheets/EndShiftSafeguardModal';
import { ReliefHandoverModal } from '../components/sheets/ReliefHandoverModal';
import { useTheme } from '../theme';
import type { DutyStatus, ShiftInfo, StandbyReason } from '../types/index';

export interface HosScreenProps {
    operatorName?: string;
    userRole?: string;
    shiftInfo?: ShiftInfo;
    linkedAssetCode?: string | null;
    maxDriveHours?: number;
    maxShiftHours?: number;
    cycleHoursLimit?: number;
    onBack?: () => void;
    onUpdateDutyStatus?: (
        dutyStatus: DutyStatus,
        standbyReason?: StandbyReason,
        remarks?: string,
    ) => void;
    onReleaseUnit?: (assetCode: string) => void;
}

interface DutyStatusOptionConfig {
    status: DutyStatus;
    badge: string;
    title: string;
    subtitle: string;
    iconName: IconName;
    accentColor: string;
}

const DUTY_STATUS_OPTIONS: DutyStatusOptionConfig[] = [
    {
        status: 'operating',
        badge: 'OPR',
        title: 'On Duty — Crane / Machine Operating',
        subtitle: 'Active site lifting, rigging, crane operations, excavation',
        iconName: 'crane',
        accentColor: '#F59E0B',
    },
    {
        status: 'driving',
        badge: 'DRV',
        title: 'On Duty — Driving / Transit',
        subtitle: 'Transporting crane, lowbed carrier, or escort vehicle',
        iconName: 'truck',
        accentColor: '#3B82F6',
    },
    {
        status: 'standby',
        badge: 'SBY',
        title: 'On Duty — Standby / Delay (Demurrage)',
        subtitle: 'Waiting on client, concrete trucks, permits, or weather',
        iconName: 'clock',
        accentColor: '#F97316',
    },
    {
        status: 'on_break',
        badge: 'BRK',
        title: 'On Break — 30-min Meal / Rest Period',
        subtitle: 'Mandatory 30-minute rest or lunch pause',
        iconName: 'tools',
        accentColor: '#10B981',
    },
    {
        status: 'off_duty',
        badge: 'OFF',
        title: 'Off Duty — Shift Complete',
        subtitle: 'Clocked out from work, 10-hour daily rest reset',
        iconName: 'power',
        accentColor: '#94A3B8',
    },
];

const STANDBY_REASONS: Array<{ reason: StandbyReason; label: string }> = [
    {
        reason: 'client_delay',
        label: 'Client Site Delay (Billable Demurrage)',
    },
    {
        reason: 'waiting_on_concrete',
        label: 'Waiting on Concrete Mixer Pour',
    },
    {
        reason: 'weather_hold',
        label: 'Weather Hold (High Wind Anemometer Cutoff)',
    },
    {
        reason: 'site_access_blocked',
        label: 'Site Access / Road Ingress Blocked',
    },
    {
        reason: 'rigging_adjustment',
        label: 'Rigging & Outrigger Ground Re-checking',
    },
    {
        reason: 'mechanical_inspection',
        label: 'Mechanical Safety Walkaround Inspection',
    },
    {
        reason: 'other',
        label: 'Other Operational Standby Reason',
    },
];

interface ShiftLogEvent {
    id: string;
    status: DutyStatus;
    startTime: string;
    endTime: string;
    durationFormatted: string;
    details: string;
    location: string;
}

const INITIAL_LOG_EVENTS: ShiftLogEvent[] = [
    {
        id: 'log-1',
        status: 'driving',
        startTime: '08:00 AM',
        endTime: '09:30 AM',
        durationFormatted: '1h 30m',
        details: 'Transit via Port Access Highway with 50T Mobile Crane',
        location: 'Manila North Harbor Corridor',
    },
    {
        id: 'log-2',
        status: 'operating',
        startTime: '09:30 AM',
        endTime: '12:00 PM',
        durationFormatted: '2h 30m',
        details: 'Outriggers deployed, foundation steel rebar tandem lifts',
        location: 'Block 4 Tower Site, Taguig',
    },
    {
        id: 'log-3',
        status: 'on_break',
        startTime: '12:00 PM',
        endTime: '12:30 PM',
        durationFormatted: '0h 30m',
        details: 'Mandatory midday meal & rest period',
        location: 'Site Welfare Area',
    },
    {
        id: 'log-4',
        status: 'operating',
        startTime: '12:30 PM',
        endTime: 'Current',
        durationFormatted: '1h 30m',
        details: 'Structural pre-cast slab placement in progress',
        location: 'Block 4 Tower Site, Taguig',
    },
];

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
    onBack,
    onUpdateDutyStatus,
    onReleaseUnit,
}) => {
    const { isDarkHud } = useTheme();
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

    const hoursElapsed = shiftInfo.hoursElapsed ?? 4.5;
    const driveHoursElapsed = 3.5;
    const cycleHoursElapsed = 52.5;

    // DOLE 10-Hour Shift Limit Compliance Checks
    const isDoleWarning = hoursElapsed >= 9.0 && hoursElapsed < 10.0;
    const isDoleCapExceeded = hoursElapsed >= 10.0;

    // Remaining ELD calculations
    const driveRemainingHours = Math.max(0, maxDriveHours - driveHoursElapsed);
    const shiftRemainingHours = Math.max(0, maxShiftHours - hoursElapsed);
    const cycleRemainingHours = Math.max(
        0,
        cycleHoursLimit - cycleHoursElapsed,
    );
    const breakCountdownHours = Math.max(0, 8.0 - hoursElapsed);

    const shiftProgressPercent = Math.min(
        100,
        Math.round((hoursElapsed / maxShiftHours) * 100),
    );

    const formatHoursMinutes = (hoursFloat: number): string => {
        const totalMinutes = Math.round(hoursFloat * 60);
        const hrs = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;

        return `${hrs}h ${mins.toString().padStart(2, '0')}m`;
    };

    const executeDutyUpdate = (statusToSet: DutyStatus = selectedStatus) => {
        setIsSaved(true);
        onUpdateDutyStatus?.(
            statusToSet,
            statusToSet === 'standby' ? standbyReason : undefined,
            remarks.trim() ? remarks.trim() : undefined,
        );
    };

    const handleConfirm = () => {
        if (selectedStatus === 'off_duty' && linkedAssetCode) {
            setSafeguardModalOpen(true);

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
            {/* 1. Fixed Top Header Bar matching DVIR & Samsara Cockpit */}
            <View style={[styles.headerBar, isDarkHud && styles.darkHeaderBar]}>
                {/* Top Action Row: Tactile Back Button & Duty Status Capsule Badge */}
                <View style={styles.headerTopRow}>
                    <Pressable
                        accessibilityHint="Returns to previous screen"
                        accessibilityLabel="Close and return"
                        accessibilityRole="button"
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        onPress={() => {
                            if (onBack) {
                                onBack();
                            }
                        }}
                        style={({ pressed }) => [
                            styles.closeHeaderBtn,
                            isDarkHud && styles.darkCloseHeaderBtn,
                            pressed && styles.closeHeaderBtnPressed,
                        ]}
                        testID="hos-back-btn"
                    >
                        <Icon
                            color={isDarkHud ? '#F8FAFC' : '#0F172A'}
                            name="back"
                            size={20}
                        />
                    </Pressable>

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
                </View>

                {/* Main Header Titles & Telemetry Shelf */}
                <View style={styles.headerTitleBlock}>
                    <Text
                        style={[
                            styles.pageCategory,
                            isDarkHud && styles.darkPageCategory,
                        ]}
                    >
                        HOURS OF SERVICE (HoS) · ELD COCKPIT
                    </Text>
                    <Text
                        accessibilityRole="header"
                        style={[
                            styles.screenTitle,
                            isDarkHud && styles.darkScreenTitle,
                        ]}
                    >
                        Duty Status &amp; Shift Management
                    </Text>
                    <View
                        style={[
                            styles.telemetryShelf,
                            isDarkHud && styles.darkTelemetryShelf,
                        ]}
                    >
                        <Text
                            style={[
                                styles.headerSubtitle,
                                isDarkHud && styles.darkHeaderSubtitle,
                            ]}
                        >
                            Operator: {operatorName} · Shift Started:{' '}
                            {shiftInfo?.startedAt ?? '08:00 AM'} (
                            {hoursElapsed.toFixed(1)}h Elapsed)
                        </Text>
                    </View>
                </View>
            </View>

            {/* 2. Scrollable Cockpit Content */}
            <ScrollView
                accessibilityLabel="Hours of service duty status and clocks"
                contentContainerStyle={styles.contentContainer}
                style={styles.scrollView}
            >
                {/* DOLE 10-Hour Shift Limit Compliance Warning / Hard Stop Banner */}
                {isDoleWarning || isDoleCapExceeded ? (
                    <View
                        accessibilityRole="alert"
                        style={[
                            styles.doleWarningBanner,
                            isDoleCapExceeded && styles.doleCapBanner,
                            isDarkHud &&
                                (isDoleCapExceeded
                                    ? styles.darkDoleCapBanner
                                    : styles.darkDoleWarningBanner),
                        ]}
                        testID="dole-shift-limit-banner"
                    >
                        <View style={styles.doleWarningContent}>
                            <Icon
                                color={
                                    isDoleCapExceeded
                                        ? '#EF4444'
                                        : isDarkHud
                                          ? '#F59E0B'
                                          : '#D97706'
                                }
                                name="alert"
                                size={18}
                            />
                            <Text
                                style={[
                                    styles.doleWarningText,
                                    isDoleCapExceeded && styles.doleCapText,
                                    isDarkHud &&
                                        (isDoleCapExceeded
                                            ? styles.darkDoleCapText
                                            : styles.darkDoleWarningText),
                                ]}
                            >
                                {isDoleCapExceeded
                                    ? '10h Maximum Operating Cap Exceeded — Mandatory Rest Period.'
                                    : 'Approaching 10h Operating Limit — Prepare for Handover or Shift Closure.'}
                            </Text>
                        </View>
                        <Pressable
                            accessibilityLabel="Handover equipment to relief operator"
                            accessibilityRole="button"
                            onPress={() => setReliefHandoverOpen(true)}
                            style={[
                                styles.doleHandoverBtn,
                                isDarkHud && styles.darkDoleHandoverBtn,
                            ]}
                            testID="hos-relief-handover-btn"
                        >
                            <Text
                                style={[
                                    styles.doleHandoverBtnText,
                                    isDarkHud && styles.darkDoleHandoverBtnText,
                                ]}
                            >
                                Relief Handover
                            </Text>
                        </Pressable>
                    </View>
                ) : null}

                {/* 3. Live ELD Clocks Card */}
                <View
                    style={[
                        styles.clocksCard,
                        isDarkHud && styles.darkClocksCard,
                    ]}
                    testID="hos-eld-clocks-card"
                >
                    <View style={styles.cardHeader}>
                        <View style={styles.badgeRow}>
                            <Icon
                                color={isDarkHud ? '#34D399' : '#059669'}
                                name="clock"
                                size={18}
                            />
                            <Text
                                style={[
                                    styles.clocksCardHeading,
                                    isDarkHud && styles.darkClocksCardHeading,
                                ]}
                            >
                                LIVE ELD DUTY CLOCKS
                            </Text>
                        </View>
                        <Text
                            style={[
                                styles.cycleText,
                                isDarkHud && styles.darkCycleText,
                            ]}
                        >
                            {userRole.toUpperCase()}
                        </Text>
                    </View>

                    {/* 4-Cell Dials Grid */}
                    <View style={styles.clocksGrid}>
                        {/* Dial 1: Drive / Operating Remaining */}
                        <View
                            style={[
                                styles.clockCell,
                                isDarkHud && styles.darkClockCell,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.clockCellLabel,
                                    isDarkHud && styles.darkClockCellLabel,
                                ]}
                            >
                                Drive / Operating
                            </Text>
                            <Text
                                style={[
                                    styles.clockCellValueGreen,
                                    isDarkHud && styles.darkClockCellValueGreen,
                                ]}
                            >
                                {formatHoursMinutes(driveRemainingHours)}
                            </Text>
                            <Text
                                style={[
                                    styles.clockCellSub,
                                    isDarkHud && styles.darkClockCellSub,
                                ]}
                            >
                                of {maxDriveHours}h limit
                            </Text>
                        </View>

                        {/* Dial 2: Shift Window Remaining */}
                        <View
                            style={[
                                styles.clockCell,
                                isDarkHud && styles.darkClockCell,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.clockCellLabel,
                                    isDarkHud && styles.darkClockCellLabel,
                                ]}
                            >
                                Shift Window
                            </Text>
                            <Text
                                style={[
                                    styles.clockCellValueBlue,
                                    isDarkHud && styles.darkClockCellValueBlue,
                                ]}
                            >
                                {formatHoursMinutes(shiftRemainingHours)}
                            </Text>
                            <Text
                                style={[
                                    styles.clockCellSub,
                                    isDarkHud && styles.darkClockCellSub,
                                ]}
                            >
                                of {maxShiftHours}h daily
                            </Text>
                        </View>

                        {/* Dial 3: 70-Hr Cycle Remaining */}
                        <View
                            style={[
                                styles.clockCell,
                                isDarkHud && styles.darkClockCell,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.clockCellLabel,
                                    isDarkHud && styles.darkClockCellLabel,
                                ]}
                            >
                                70-Hr 8-Day Cycle
                            </Text>
                            <Text
                                style={[
                                    styles.clockCellValueAmber,
                                    isDarkHud && styles.darkClockCellValueAmber,
                                ]}
                            >
                                {formatHoursMinutes(cycleRemainingHours)}
                            </Text>
                            <Text
                                style={[
                                    styles.clockCellSub,
                                    isDarkHud && styles.darkClockCellSub,
                                ]}
                            >
                                {cycleHoursElapsed.toFixed(1)}h logged
                            </Text>
                        </View>

                        {/* Dial 4: Mandatory Rest Break Countdown */}
                        <View
                            style={[
                                styles.clockCell,
                                isDarkHud && styles.darkClockCell,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.clockCellLabel,
                                    isDarkHud && styles.darkClockCellLabel,
                                ]}
                            >
                                Break Countdown
                            </Text>
                            <Text
                                style={[
                                    styles.clockCellValuePurple,
                                    isDarkHud &&
                                        styles.darkClockCellValuePurple,
                                ]}
                            >
                                {formatHoursMinutes(breakCountdownHours)}
                            </Text>
                            <Text
                                style={[
                                    styles.clockCellSub,
                                    isDarkHud && styles.darkClockCellSub,
                                ]}
                            >
                                until 30m rest
                            </Text>
                        </View>
                    </View>

                    {/* Shift Progress Gauge Bar */}
                    <View style={styles.gaugeContainer}>
                        <View style={styles.gaugeMetaRow}>
                            <Text
                                style={[
                                    styles.gaugeMetaLabel,
                                    isDarkHud && styles.darkGaugeMetaLabel,
                                ]}
                            >
                                Daily Shift Elapsed: {hoursElapsed.toFixed(1)} /{' '}
                                {maxShiftHours}h
                            </Text>
                            <Text
                                style={[
                                    styles.gaugeMetaPercent,
                                    isDarkHud && styles.darkGaugeMetaPercent,
                                ]}
                            >
                                {shiftProgressPercent}% Used
                            </Text>
                        </View>
                        <View
                            style={[
                                styles.gaugeTrack,
                                isDarkHud && styles.darkGaugeTrack,
                            ]}
                        >
                            <View
                                style={[
                                    styles.gaugeFill,
                                    { width: `${shiftProgressPercent}%` },
                                    shiftProgressPercent > 85
                                        ? styles.gaugeFillRed
                                        : shiftProgressPercent > 70
                                          ? styles.gaugeFillAmber
                                          : styles.gaugeFillGreen,
                                ]}
                            />
                        </View>
                    </View>
                </View>

                {/* 4. Active Duty Status Selector */}
                <View
                    style={[
                        styles.sectionCard,
                        isDarkHud && styles.darkSectionCard,
                    ]}
                    testID="duty-status-selector"
                >
                    <Text
                        accessibilityRole="header"
                        style={[
                            styles.sectionTitle,
                            isDarkHud && styles.darkSectionTitle,
                        ]}
                    >
                        SELECT ACTIVE DUTY STATUS
                    </Text>
                    <Text
                        style={[
                            styles.sectionHelper,
                            isDarkHud && styles.darkSectionHelper,
                        ]}
                    >
                        Tap to switch duty status. Complies with DOLE-OSHC and
                        DOT ELD mandates.
                    </Text>

                    <View style={styles.dutyOptionsList}>
                        {DUTY_STATUS_OPTIONS.map((opt) => {
                            const isSelected = selectedStatus === opt.status;

                            return (
                                <Pressable
                                    key={opt.status}
                                    accessibilityLabel={`${opt.title}, ${opt.subtitle}`}
                                    accessibilityRole="button"
                                    onPress={() => {
                                        setSelectedStatus(opt.status);
                                        setIsSaved(false);
                                    }}
                                    style={[
                                        styles.dutyOptionCard,
                                        isDarkHud && styles.darkDutyOptionCard,
                                        isSelected &&
                                            (isDarkHud
                                                ? styles.darkDutyOptionCardSelected
                                                : styles.dutyOptionCardSelected),
                                    ]}
                                    testID={`duty-option-${opt.status}`}
                                >
                                    <View style={styles.optionLeft}>
                                        <View
                                            style={[
                                                styles.optionBadge,
                                                {
                                                    borderColor:
                                                        opt.accentColor,
                                                },
                                                isSelected && {
                                                    backgroundColor:
                                                        opt.accentColor,
                                                },
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.optionBadgeText,
                                                    isDarkHud &&
                                                        styles.darkOptionBadgeText,
                                                    isSelected &&
                                                        (isDarkHud
                                                            ? styles.darkOptionBadgeTextActive
                                                            : styles.optionBadgeTextActive),
                                                ]}
                                            >
                                                {opt.badge}
                                            </Text>
                                        </View>
                                        <View style={styles.optionCopy}>
                                            <Text
                                                style={[
                                                    styles.optionTitle,
                                                    isDarkHud &&
                                                        styles.darkOptionTitle,
                                                    isSelected &&
                                                        (isDarkHud
                                                            ? styles.darkOptionTitleSelected
                                                            : styles.optionTitleSelected),
                                                ]}
                                            >
                                                {opt.title}
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.optionSubtitle,
                                                    isDarkHud &&
                                                        styles.darkOptionSubtitle,
                                                ]}
                                            >
                                                {opt.subtitle}
                                            </Text>
                                        </View>
                                    </View>

                                    <View
                                        style={[
                                            styles.radioButton,
                                            isDarkHud && styles.darkRadioButton,
                                            isSelected &&
                                                (isDarkHud
                                                    ? styles.darkRadioButtonSelected
                                                    : styles.radioButtonSelected),
                                        ]}
                                    >
                                        {isSelected ? (
                                            <View
                                                style={[
                                                    styles.radioButtonInner,
                                                    isDarkHud &&
                                                        styles.darkRadioButtonInner,
                                                ]}
                                            />
                                        ) : null}
                                    </View>
                                </Pressable>
                            );
                        })}
                    </View>
                </View>

                {/* 5. Standby & Demurrage Reason Selector (when Standby is chosen) */}
                {selectedStatus === 'standby' ? (
                    <View
                        style={[
                            styles.sectionCard,
                            isDarkHud && styles.darkSectionCard,
                        ]}
                        testID="standby-reason-section"
                    >
                        <Text
                            accessibilityRole="header"
                            style={[
                                styles.sectionTitle,
                                isDarkHud && styles.darkSectionTitle,
                            ]}
                        >
                            STANDBY &amp; DEMURRAGE REASON
                        </Text>
                        <Text
                            style={[
                                styles.sectionHelper,
                                isDarkHud && styles.darkSectionHelper,
                            ]}
                        >
                            Required for client billable delay attribution and
                            contractual demurrage logs.
                        </Text>

                        <View style={styles.standbyChipsGrid}>
                            {STANDBY_REASONS.map((r) => {
                                const isSelected = standbyReason === r.reason;

                                return (
                                    <Pressable
                                        key={r.reason}
                                        accessibilityLabel={r.label}
                                        accessibilityRole="button"
                                        onPress={() => {
                                            setStandbyReason(r.reason);
                                            setIsSaved(false);
                                        }}
                                        style={[
                                            styles.standbyChip,
                                            isDarkHud && styles.darkStandbyChip,
                                            isSelected &&
                                                (isDarkHud
                                                    ? styles.darkStandbyChipSelected
                                                    : styles.standbyChipSelected),
                                        ]}
                                        testID={`standby-reason-${r.reason}`}
                                    >
                                        <Text
                                            style={[
                                                styles.standbyChipText,
                                                isDarkHud &&
                                                    styles.darkStandbyChipText,
                                                isSelected &&
                                                    (isDarkHud
                                                        ? styles.darkStandbyChipTextSelected
                                                        : styles.standbyChipTextSelected),
                                            ]}
                                        >
                                            {r.label}
                                        </Text>
                                        {isSelected ? (
                                            <Text
                                                style={[
                                                    styles.standbyCheckGlyph,
                                                    isDarkHud &&
                                                        styles.darkStandbyCheckGlyph,
                                                ]}
                                            >
                                                ✓
                                            </Text>
                                        ) : null}
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>
                ) : null}

                {/* 6. Remarks & Duty Transition Submission Card */}
                <View
                    style={[
                        styles.sectionCard,
                        isDarkHud && styles.darkSectionCard,
                    ]}
                >
                    <Text
                        style={[
                            styles.inputLabel,
                            isDarkHud && styles.darkInputLabel,
                        ]}
                    >
                        Duty Transition Remarks &amp; Notes
                    </Text>
                    <TextInput
                        accessibilityLabel="Duty transition remarks"
                        multiline
                        numberOfLines={3}
                        onChangeText={(txt) => {
                            setRemarks(txt);
                            setIsSaved(false);
                        }}
                        placeholder="e.g. Lift completed at Taguig site; transitioning to road transit back to yard."
                        placeholderTextColor={isDarkHud ? '#64748B' : '#94A3B8'}
                        style={[styles.input, isDarkHud && styles.darkInput]}
                        value={remarks}
                        testID="hos-remarks-input"
                    />

                    {/* Legal Operator Certification */}
                    <Pressable
                        accessibilityLabel="Legal certification of hours of service"
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: isCertified }}
                        onPress={() => setIsCertified((prev) => !prev)}
                        style={styles.certCheckRow}
                        testID="hos-cert-check"
                    >
                        <View
                            style={[
                                styles.certBox,
                                isDarkHud && styles.darkCertBox,
                                isCertified &&
                                    (isDarkHud
                                        ? styles.darkCertBoxChecked
                                        : styles.certBoxChecked),
                            ]}
                        >
                            {isCertified ? (
                                <Text
                                    style={[
                                        styles.certCheckMark,
                                        isDarkHud && styles.darkCertCheckMark,
                                    ]}
                                >
                                    ✓
                                </Text>
                            ) : null}
                        </View>
                        <Text
                            style={[
                                styles.certCheckLabel,
                                isDarkHud && styles.darkCertCheckLabel,
                            ]}
                        >
                            I certify that these duty status entries and hours
                            of service are true, complete, and accurate for this
                            shift.
                        </Text>
                    </Pressable>

                    {/* Update & Certify Duty Status Action Button / Stamp */}
                    {!isSaved ? (
                        <Pressable
                            accessibilityLabel="Update and certify duty status"
                            accessibilityRole="button"
                            disabled={!isCertified}
                            onPress={handleConfirm}
                            style={({ pressed }) => [
                                styles.actionButton,
                                isDarkHud && styles.darkActionButton,
                                !isCertified &&
                                    (isDarkHud
                                        ? styles.darkActionButtonDisabled
                                        : styles.actionButtonDisabled),
                                pressed && styles.pressed,
                            ]}
                            testID="confirm-hos-btn"
                        >
                            <Text
                                style={[
                                    styles.actionBtnText,
                                    isDarkHud &&
                                        isCertified &&
                                        styles.darkActionBtnText,
                                ]}
                            >
                                ✓ Update &amp; Certify Duty Status
                            </Text>
                        </Pressable>
                    ) : (
                        <View
                            style={[
                                styles.signedStamp,
                                isDarkHud && styles.darkSignedStamp,
                            ]}
                            testID="hos-confirmed-stamp"
                        >
                            <Text
                                style={[
                                    styles.signedStampTitle,
                                    isDarkHud && styles.darkSignedStampTitle,
                                ]}
                            >
                                ✓ DUTY STATUS UPDATED &amp; CERTIFIED
                            </Text>
                            <Text
                                style={[
                                    styles.signedStampSub,
                                    isDarkHud && styles.darkSignedStampSub,
                                ]}
                            >
                                Active: {activeConfig.title} (
                                {new Date().toLocaleTimeString()})
                            </Text>
                        </View>
                    )}
                </View>

                {/* 7. 24-Hour Duty Timeline Graph (Samsara / ELD Visual Graph) */}
                <View
                    style={[
                        styles.sectionCard,
                        isDarkHud && styles.darkSectionCard,
                    ]}
                    testID="hos-timeline-graph"
                >
                    <Text
                        accessibilityRole="header"
                        style={[
                            styles.sectionTitle,
                            isDarkHud && styles.darkSectionTitle,
                        ]}
                    >
                        24-HOUR DUTY TIMELINE (TODAY)
                    </Text>
                    <Text
                        style={[
                            styles.sectionHelper,
                            isDarkHud && styles.darkSectionHelper,
                        ]}
                    >
                        Visual ELD graph of 24-hour shift status progression
                        (00:00 to 24:00).
                    </Text>

                    <View
                        style={[
                            styles.graphContainer,
                            isDarkHud && styles.darkGraphContainer,
                        ]}
                    >
                        {/* Row: OFF Duty */}
                        <View style={styles.graphRow}>
                            <Text
                                style={[
                                    styles.graphRowHeader,
                                    isDarkHud && styles.darkGraphRowHeader,
                                ]}
                            >
                                OFF
                            </Text>
                            <View
                                style={[
                                    styles.graphRowTrack,
                                    isDarkHud && styles.darkGraphRowTrack,
                                ]}
                            >
                                <View
                                    style={[
                                        styles.graphSegment,
                                        {
                                            left: '0%',
                                            width: '33.3%',
                                            backgroundColor: isDarkHud
                                                ? '#475569'
                                                : '#64748B',
                                        },
                                    ]}
                                />
                            </View>
                        </View>

                        {/* Row: On Break */}
                        <View style={styles.graphRow}>
                            <Text
                                style={[
                                    styles.graphRowHeader,
                                    isDarkHud && styles.darkGraphRowHeader,
                                ]}
                            >
                                BRK
                            </Text>
                            <View
                                style={[
                                    styles.graphRowTrack,
                                    isDarkHud && styles.darkGraphRowTrack,
                                ]}
                            >
                                <View
                                    style={[
                                        styles.graphSegment,
                                        {
                                            left: '50%',
                                            width: '2.1%',
                                            backgroundColor: isDarkHud
                                                ? '#10B981'
                                                : '#059669',
                                        },
                                    ]}
                                />
                            </View>
                        </View>

                        {/* Row: Driving */}
                        <View style={styles.graphRow}>
                            <Text
                                style={[
                                    styles.graphRowHeader,
                                    isDarkHud && styles.darkGraphRowHeader,
                                ]}
                            >
                                DRV
                            </Text>
                            <View
                                style={[
                                    styles.graphRowTrack,
                                    isDarkHud && styles.darkGraphRowTrack,
                                ]}
                            >
                                <View
                                    style={[
                                        styles.graphSegment,
                                        {
                                            left: '33.3%',
                                            width: '6.2%',
                                            backgroundColor: isDarkHud
                                                ? '#3B82F6'
                                                : '#2563EB',
                                        },
                                    ]}
                                />
                            </View>
                        </View>

                        {/* Row: Operating / On Duty */}
                        <View style={styles.graphRow}>
                            <Text
                                style={[
                                    styles.graphRowHeader,
                                    isDarkHud && styles.darkGraphRowHeader,
                                ]}
                            >
                                ON
                            </Text>
                            <View
                                style={[
                                    styles.graphRowTrack,
                                    isDarkHud && styles.darkGraphRowTrack,
                                ]}
                            >
                                <View
                                    style={[
                                        styles.graphSegment,
                                        {
                                            left: '39.5%',
                                            width: '10.5%',
                                            backgroundColor: isDarkHud
                                                ? '#F59E0B'
                                                : '#D97706',
                                        },
                                    ]}
                                />
                                <View
                                    style={[
                                        styles.graphSegment,
                                        {
                                            left: '52.1%',
                                            width: '6.2%',
                                            backgroundColor: isDarkHud
                                                ? '#F59E0B'
                                                : '#D97706',
                                        },
                                    ]}
                                />
                            </View>
                        </View>

                        {/* Timeline Hour Scale */}
                        <View
                            style={[
                                styles.graphTimeScale,
                                isDarkHud && styles.darkGraphTimeScale,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.timeMark,
                                    isDarkHud && styles.darkTimeMark,
                                ]}
                            >
                                00:00
                            </Text>
                            <Text
                                style={[
                                    styles.timeMark,
                                    isDarkHud && styles.darkTimeMark,
                                ]}
                            >
                                06:00
                            </Text>
                            <Text
                                style={[
                                    styles.timeMark,
                                    isDarkHud && styles.darkTimeMark,
                                ]}
                            >
                                12:00
                            </Text>
                            <Text
                                style={[
                                    styles.timeMark,
                                    isDarkHud && styles.darkTimeMark,
                                ]}
                            >
                                18:00
                            </Text>
                            <Text
                                style={[
                                    styles.timeMark,
                                    isDarkHud && styles.darkTimeMark,
                                ]}
                            >
                                24:00
                            </Text>
                        </View>
                    </View>
                </View>

                {/* 8. Chronological Shift Log Events History */}
                <View
                    style={[
                        styles.sectionCard,
                        isDarkHud && styles.darkSectionCard,
                    ]}
                    testID="hos-activity-logs"
                >
                    <Text
                        accessibilityRole="header"
                        style={[
                            styles.sectionTitle,
                            isDarkHud && styles.darkSectionTitle,
                        ]}
                    >
                        TODAY'S SHIFT ACTIVITY LOG
                    </Text>
                    <Text
                        style={[
                            styles.sectionHelper,
                            isDarkHud && styles.darkSectionHelper,
                        ]}
                    >
                        Timestamped change-of-duty event logs with GPS location
                        audits.
                    </Text>

                    <View style={styles.logEventsList}>
                        {INITIAL_LOG_EVENTS.map((evt) => (
                            <View
                                key={evt.id}
                                style={[
                                    styles.logEventCard,
                                    isDarkHud && styles.darkLogEventCard,
                                ]}
                            >
                                <View style={styles.logEventHeader}>
                                    <View style={styles.logBadgeRow}>
                                        <View
                                            style={[
                                                styles.logStatusBadge,
                                                evt.status === 'operating'
                                                    ? isDarkHud
                                                        ? styles.darkLogStatusOperating
                                                        : styles.logStatusOperating
                                                    : evt.status === 'driving'
                                                      ? isDarkHud
                                                          ? styles.darkLogStatusDriving
                                                          : styles.logStatusDriving
                                                      : evt.status ===
                                                          'on_break'
                                                        ? isDarkHud
                                                            ? styles.darkLogStatusBreak
                                                            : styles.logStatusBreak
                                                        : isDarkHud
                                                          ? styles.darkLogStatusOff
                                                          : styles.logStatusOff,
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.logStatusText,
                                                    isDarkHud &&
                                                        styles.darkLogStatusText,
                                                ]}
                                            >
                                                {evt.status.toUpperCase()}
                                            </Text>
                                        </View>
                                        <Text
                                            style={[
                                                styles.logTimeRange,
                                                isDarkHud &&
                                                    styles.darkLogTimeRange,
                                            ]}
                                        >
                                            {evt.startTime} – {evt.endTime}
                                        </Text>
                                    </View>
                                    <Text
                                        style={[
                                            styles.logDuration,
                                            isDarkHud && styles.darkLogDuration,
                                        ]}
                                    >
                                        {evt.durationFormatted}
                                    </Text>
                                </View>

                                <Text
                                    style={[
                                        styles.logDetails,
                                        isDarkHud && styles.darkLogDetails,
                                    ]}
                                >
                                    {evt.details}
                                </Text>
                                <Text
                                    style={[
                                        styles.logLocation,
                                        isDarkHud && styles.darkLogLocation,
                                    ]}
                                >
                                    📍 {evt.location}
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>
            </ScrollView>

            {/* End Shift Safeguard Intercept Modal */}
            <EndShiftSafeguardModal
                assetCode={linkedAssetCode || 'CRN-101'}
                onCancel={() => setSafeguardModalOpen(false)}
                onConfirmReleaseAndClockOut={() => {
                    setSafeguardModalOpen(false);
                    onReleaseUnit?.(linkedAssetCode || 'CRN-101');
                    executeDutyUpdate();
                }}
                visible={safeguardModalOpen}
            />

            {/* Smart Dual Hot-Seating Relief Handover Modal */}
            <ReliefHandoverModal
                assetCode={linkedAssetCode || 'CRN-101'}
                handoverPin="8421"
                mode="outgoing_offer"
                onClose={() => setReliefHandoverOpen(false)}
                onInitiatePushHandover={() => {
                    // Push notification alert dispatched to scheduled incoming relief operator
                }}
                reliefOperatorName="Carlos Reyes (Night Shift)"
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
    headerBar: {
        backgroundColor: '#FFFFFF',
        borderBottomColor: '#E2E8F0',
        borderBottomWidth: 1,
        paddingBottom: 12,
        paddingHorizontal: 16,
        paddingTop: 12,
    },
    darkHeaderBar: {
        backgroundColor: '#1E293B',
        borderBottomColor: '#334155',
    },
    headerTopRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    closeHeaderBtn: {
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E8F0',
        borderRadius: 12,
        borderWidth: 1.5,
        elevation: 2,
        height: 40,
        justifyContent: 'center',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
        width: 40,
    },
    darkCloseHeaderBtn: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
        shadowColor: '#000000',
        shadowOpacity: 0.3,
    },
    closeHeaderBtnPressed: {
        opacity: 0.75,
        transform: [{ scale: 0.94 }],
    },
    headerTitleBlock: {
        width: '100%',
    },
    pageCategory: {
        color: '#D97706',
        fontSize: 10.5,
        fontWeight: '900',
        letterSpacing: 0.7,
        marginBottom: 2,
    },
    darkPageCategory: {
        color: '#F59E0B',
    },
    screenTitle: {
        color: '#0F172A',
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: -0.3,
    },
    darkScreenTitle: {
        color: '#F8FAFC',
    },
    telemetryShelf: {
        backgroundColor: '#F8FAFC',
        borderColor: '#E2E8F0',
        borderRadius: 8,
        borderWidth: 1,
        marginTop: 6,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    darkTelemetryShelf: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
    },
    headerSubtitle: {
        color: '#64748B',
        fontSize: 11.5,
        fontWeight: '600',
        lineHeight: 16,
    },
    darkHeaderSubtitle: {
        color: '#94A3B8',
    },
    dutyPillBadge: {
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderColor: '#E2E8F0',
        borderRadius: 9999,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 4.5,
    },
    darkDutyPillBadge: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
    },
    dutyBadgeDot: {
        borderRadius: 3.5,
        height: 7,
        width: 7,
    },
    dutyPillBadgeText: {
        color: '#0F172A',
        fontSize: 11,
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
    clocksCard: {
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E8F0',
        borderRadius: 14,
        borderWidth: 1,
        elevation: 2,
        marginBottom: 16,
        padding: 16,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
    },
    darkClocksCard: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
        shadowColor: '#000000',
        shadowOpacity: 0.25,
        shadowRadius: 6,
    },
    cardHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    badgeRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6,
    },
    clocksCardHeading: {
        color: '#059669',
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    darkClocksCardHeading: {
        color: '#34D399',
    },
    cycleText: {
        color: '#64748B',
        fontSize: 11,
        fontWeight: '700',
    },
    darkCycleText: {
        color: '#94A3B8',
    },
    clocksGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 14,
    },
    clockCell: {
        backgroundColor: '#F8FAFC',
        borderColor: '#E2E8F0',
        borderRadius: 10,
        borderWidth: 1,
        flex: 1,
        minWidth: '45%',
        padding: 12,
    },
    darkClockCell: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
    },
    clockCellLabel: {
        color: '#64748B',
        fontSize: 11,
        fontWeight: '700',
        marginBottom: 4,
    },
    darkClockCellLabel: {
        color: '#94A3B8',
    },
    clockCellValueGreen: {
        color: '#059669',
        fontSize: 18,
        fontWeight: '900',
    },
    darkClockCellValueGreen: {
        color: '#34D399',
    },
    clockCellValueBlue: {
        color: '#2563EB',
        fontSize: 18,
        fontWeight: '900',
    },
    darkClockCellValueBlue: {
        color: '#60A5FA',
    },
    clockCellValueAmber: {
        color: '#D97706',
        fontSize: 18,
        fontWeight: '900',
    },
    darkClockCellValueAmber: {
        color: '#FBBF24',
    },
    clockCellValuePurple: {
        color: '#7C3AED',
        fontSize: 18,
        fontWeight: '900',
    },
    darkClockCellValuePurple: {
        color: '#C084FC',
    },
    clockCellSub: {
        color: '#94A3B8',
        fontSize: 10,
        fontWeight: '600',
        marginTop: 2,
    },
    darkClockCellSub: {
        color: '#64748B',
    },
    gaugeContainer: {
        marginTop: 2,
    },
    gaugeMetaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    gaugeMetaLabel: {
        color: '#64748B',
        fontSize: 12,
        fontWeight: '600',
    },
    darkGaugeMetaLabel: {
        color: '#94A3B8',
    },
    gaugeMetaPercent: {
        color: '#0F172A',
        fontSize: 12,
        fontWeight: '800',
    },
    darkGaugeMetaPercent: {
        color: '#F8FAFC',
    },
    gaugeTrack: {
        backgroundColor: '#E2E8F0',
        borderRadius: 6,
        height: 8,
        overflow: 'hidden',
        width: '100%',
    },
    darkGaugeTrack: {
        backgroundColor: '#0F172A',
    },
    gaugeFill: {
        borderRadius: 6,
        height: '100%',
    },
    gaugeFillGreen: {
        backgroundColor: '#10B981',
    },
    gaugeFillAmber: {
        backgroundColor: '#F59E0B',
    },
    gaugeFillRed: {
        backgroundColor: '#EF4444',
    },
    sectionCard: {
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E8F0',
        borderRadius: 14,
        borderWidth: 1,
        elevation: 2,
        marginBottom: 16,
        padding: 16,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
    },
    darkSectionCard: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
        shadowColor: '#000000',
        shadowOpacity: 0.25,
        shadowRadius: 6,
    },
    sectionTitle: {
        color: '#0F172A',
        fontSize: 15,
        fontWeight: '800',
        marginBottom: 4,
    },
    darkSectionTitle: {
        color: '#FFFFFF',
    },
    sectionHelper: {
        color: '#64748B',
        fontSize: 12,
        lineHeight: 17,
        marginBottom: 14,
    },
    darkSectionHelper: {
        color: '#94A3B8',
    },
    dutyOptionsList: {
        gap: 10,
    },
    dutyOptionCard: {
        alignItems: 'center',
        backgroundColor: 'transparent',
        borderColor: '#E2E8F0',
        borderRadius: 12,
        borderWidth: 1.5,
        flexDirection: 'row',
        justifyContent: 'space-between',
        minHeight: 60,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    darkDutyOptionCard: {
        backgroundColor: 'transparent',
        borderColor: '#334155',
    },
    dutyOptionCardSelected: {
        backgroundColor: 'transparent',
        borderColor: '#D97706',
        borderWidth: 2,
    },
    darkDutyOptionCardSelected: {
        backgroundColor: 'transparent',
        borderColor: '#F59E0B',
        borderWidth: 2,
    },
    optionLeft: {
        alignItems: 'center',
        flex: 1,
        flexDirection: 'row',
        gap: 12,
    },
    optionBadge: {
        alignItems: 'center',
        backgroundColor: 'transparent',
        borderRadius: 6,
        borderWidth: 1.5,
        height: 28,
        justifyContent: 'center',
        width: 38,
    },
    optionBadgeText: {
        color: '#0F172A',
        fontSize: 11,
        fontWeight: '900',
    },
    darkOptionBadgeText: {
        color: '#F8FAFC',
    },
    optionBadgeTextActive: {
        color: '#FFFFFF',
    },
    darkOptionBadgeTextActive: {
        color: '#FFFFFF',
    },
    optionCopy: {
        flex: 1,
    },
    optionTitle: {
        color: '#0F172A',
        fontSize: 13.5,
        fontWeight: '800',
    },
    darkOptionTitle: {
        color: '#FFFFFF',
    },
    optionTitleSelected: {
        color: '#B45309',
    },
    darkOptionTitleSelected: {
        color: '#FBBF24',
    },
    optionSubtitle: {
        color: '#64748B',
        fontSize: 11.5,
        marginTop: 2,
    },
    darkOptionSubtitle: {
        color: '#94A3B8',
    },
    radioButton: {
        alignItems: 'center',
        borderColor: '#94A3B8',
        borderRadius: 10,
        borderWidth: 2,
        height: 20,
        justifyContent: 'center',
        width: 20,
    },
    darkRadioButton: {
        borderColor: '#64748B',
    },
    radioButtonSelected: {
        borderColor: '#D97706',
    },
    darkRadioButtonSelected: {
        borderColor: '#F59E0B',
    },
    radioButtonInner: {
        backgroundColor: '#D97706',
        borderRadius: 5,
        height: 10,
        width: 10,
    },
    darkRadioButtonInner: {
        backgroundColor: '#F59E0B',
    },
    standbyChipsGrid: {
        gap: 8,
    },
    standbyChip: {
        alignItems: 'center',
        backgroundColor: 'transparent',
        borderColor: '#E2E8F0',
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        minHeight: 46,
        paddingHorizontal: 14,
        paddingVertical: 11,
    },
    darkStandbyChip: {
        backgroundColor: 'transparent',
        borderColor: '#334155',
    },
    standbyChipSelected: {
        backgroundColor: 'transparent',
        borderColor: '#D97706',
        borderWidth: 1.5,
    },
    darkStandbyChipSelected: {
        backgroundColor: 'transparent',
        borderColor: '#F59E0B',
        borderWidth: 1.5,
    },
    standbyChipText: {
        color: '#475569',
        flex: 1,
        fontSize: 12.5,
        fontWeight: '700',
    },
    darkStandbyChipText: {
        color: '#94A3B8',
    },
    standbyChipTextSelected: {
        color: '#B45309',
        fontWeight: '800',
    },
    darkStandbyChipTextSelected: {
        color: '#FBBF24',
        fontWeight: '800',
    },
    standbyCheckGlyph: {
        color: '#B45309',
        fontSize: 14,
        fontWeight: '900',
        marginLeft: 8,
    },
    darkStandbyCheckGlyph: {
        color: '#FBBF24',
    },
    inputLabel: {
        color: '#334155',
        fontSize: 13,
        fontWeight: '800',
        marginBottom: 8,
    },
    darkInputLabel: {
        color: '#CBD5E1',
    },
    input: {
        backgroundColor: '#FFFFFF',
        borderColor: '#CBD5E1',
        borderRadius: 10,
        borderWidth: 1,
        color: '#0F172A',
        fontSize: 13.5,
        marginBottom: 14,
        minHeight: 68,
        paddingHorizontal: 14,
        paddingVertical: 11,
        textAlignVertical: 'top',
    },
    darkInput: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
        color: '#FFFFFF',
    },
    graphContainer: {
        backgroundColor: '#F8FAFC',
        borderColor: '#E2E8F0',
        borderRadius: 10,
        borderWidth: 1,
        padding: 12,
    },
    darkGraphContainer: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
    },
    graphRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 10,
        marginVertical: 4,
    },
    graphRowHeader: {
        color: '#475569',
        fontSize: 10,
        fontWeight: '900',
        width: 28,
    },
    darkGraphRowHeader: {
        color: '#94A3B8',
    },
    graphRowTrack: {
        backgroundColor: '#E2E8F0',
        borderRadius: 4,
        flex: 1,
        height: 14,
        overflow: 'hidden',
        position: 'relative',
    },
    darkGraphRowTrack: {
        backgroundColor: '#0F172A',
    },
    graphSegment: {
        borderRadius: 2,
        height: '100%',
        position: 'absolute',
    },
    graphTimeScale: {
        borderTopColor: '#E2E8F0',
        borderTopWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
        paddingLeft: 38,
        paddingTop: 4,
    },
    darkGraphTimeScale: {
        borderTopColor: '#334155',
    },
    timeMark: {
        color: '#64748B',
        fontSize: 9,
        fontWeight: '700',
    },
    darkTimeMark: {
        color: '#64748B',
    },
    logEventsList: {
        gap: 8,
    },
    logEventCard: {
        backgroundColor: '#F8FAFC',
        borderColor: '#E2E8F0',
        borderRadius: 10,
        borderWidth: 1,
        marginBottom: 8,
        padding: 12,
    },
    darkLogEventCard: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
    },
    logEventHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    logBadgeRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    logStatusBadge: {
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    logStatusOperating: {
        backgroundColor: '#FEF3C7',
    },
    darkLogStatusOperating: {
        backgroundColor: '#451A03',
    },
    logStatusDriving: {
        backgroundColor: '#EFF6FF',
    },
    darkLogStatusDriving: {
        backgroundColor: '#172554',
    },
    logStatusBreak: {
        backgroundColor: '#ECFDF5',
    },
    darkLogStatusBreak: {
        backgroundColor: '#06281E',
    },
    logStatusOff: {
        backgroundColor: '#F1F5F9',
    },
    darkLogStatusOff: {
        backgroundColor: '#334155',
    },
    logStatusText: {
        color: '#0F172A',
        fontSize: 10,
        fontWeight: '900',
    },
    darkLogStatusText: {
        color: '#FFFFFF',
    },
    logTimeRange: {
        color: '#64748B',
        fontSize: 11.5,
        fontWeight: '700',
    },
    darkLogTimeRange: {
        color: '#94A3B8',
    },
    logDuration: {
        color: '#0F172A',
        fontSize: 11.5,
        fontWeight: '800',
    },
    darkLogDuration: {
        color: '#F8FAFC',
    },
    logDetails: {
        color: '#334155',
        fontSize: 12,
        lineHeight: 16,
        marginTop: 4,
    },
    darkLogDetails: {
        color: '#CBD5E1',
    },
    logLocation: {
        color: '#64748B',
        fontSize: 11,
        marginTop: 4,
    },
    darkLogLocation: {
        color: '#94A3B8',
    },
    certCheckRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 10,
        marginBottom: 14,
        minHeight: 44,
        paddingHorizontal: 2,
    },
    certBox: {
        alignItems: 'center',
        borderColor: '#94A3B8',
        borderRadius: 6,
        borderWidth: 2,
        height: 24,
        justifyContent: 'center',
        width: 24,
    },
    darkCertBox: {
        borderColor: '#475569',
    },
    certBoxChecked: {
        backgroundColor: '#D97706',
        borderColor: '#D97706',
    },
    darkCertBoxChecked: {
        backgroundColor: '#F59E0B',
        borderColor: '#F59E0B',
    },
    certCheckMark: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '900',
    },
    darkCertCheckMark: {
        color: '#090D16',
    },
    certCheckLabel: {
        color: '#475569',
        flex: 1,
        fontSize: 12,
        lineHeight: 16,
    },
    darkCertCheckLabel: {
        color: '#94A3B8',
    },
    actionButton: {
        alignItems: 'center',
        backgroundColor: '#D97706',
        borderRadius: 12,
        elevation: 3,
        justifyContent: 'center',
        minHeight: 52,
        shadowColor: '#D97706',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        width: '100%',
    },
    darkActionButton: {
        backgroundColor: '#F59E0B',
        shadowColor: '#F59E0B',
    },
    actionButtonDisabled: {
        backgroundColor: '#94A3B8',
        elevation: 0,
        opacity: 0.6,
        shadowOpacity: 0,
    },
    darkActionButtonDisabled: {
        backgroundColor: '#334155',
        elevation: 0,
        opacity: 0.6,
        shadowOpacity: 0,
    },
    actionBtnText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '800',
    },
    darkActionBtnText: {
        color: '#090D16',
    },
    signedStamp: {
        backgroundColor: '#ECFDF5',
        borderColor: '#059669',
        borderRadius: 10,
        borderWidth: 1.5,
        padding: 14,
    },
    darkSignedStamp: {
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        borderColor: '#10B981',
    },
    signedStampTitle: {
        color: '#065F46',
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    darkSignedStampTitle: {
        color: '#34D399',
    },
    signedStampSub: {
        color: '#047857',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 2,
    },
    darkSignedStampSub: {
        color: '#A7F3D0',
    },
    pressed: {
        opacity: 0.78,
    },
    doleWarningBanner: {
        alignItems: 'center',
        backgroundColor: '#FEF3C7',
        borderColor: '#F59E0B',
        borderRadius: 12,
        borderWidth: 1.5,
        flexDirection: 'row',
        gap: 10,
        justifyContent: 'space-between',
        marginBottom: 14,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    doleCapBanner: {
        backgroundColor: '#FEE2E2',
        borderColor: '#EF4444',
    },
    darkDoleWarningBanner: {
        backgroundColor: '#1E293B',
        borderColor: '#D97706',
    },
    darkDoleCapBanner: {
        backgroundColor: '#1E293B',
        borderColor: '#EF4444',
    },
    doleWarningContent: {
        alignItems: 'center',
        flex: 1,
        flexDirection: 'row',
        gap: 8,
    },
    doleWarningText: {
        color: '#92400E',
        flex: 1,
        fontSize: 12,
        fontWeight: '700',
        lineHeight: 16,
    },
    darkDoleWarningText: {
        color: '#FBBF24',
    },
    doleCapText: {
        color: '#991B1B',
    },
    darkDoleCapText: {
        color: '#F87171',
    },
    doleHandoverBtn: {
        backgroundColor: '#D97706',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    darkDoleHandoverBtn: {
        backgroundColor: '#F59E0B',
    },
    doleHandoverBtnText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '800',
    },
    darkDoleHandoverBtnText: {
        color: '#090D16',
    },
});
