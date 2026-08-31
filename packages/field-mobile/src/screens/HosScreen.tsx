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
import { useTheme } from '../theme';
import type { DutyStatus, ShiftInfo, StandbyReason } from '../types/index';

export interface HosScreenProps {
    operatorName?: string;
    userRole?: string;
    shiftInfo?: ShiftInfo;
    maxDriveHours?: number;
    maxShiftHours?: number;
    cycleHoursLimit?: number;
    onBack?: () => void;
    onUpdateDutyStatus?: (
        dutyStatus: DutyStatus,
        standbyReason?: StandbyReason,
        remarks?: string,
    ) => void;
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
    maxDriveHours = 11,
    maxShiftHours = 14,
    cycleHoursLimit = 70,
    onBack,
    onUpdateDutyStatus,
}) => {
    const { isDarkHud } = useTheme();
    const [selectedStatus, setSelectedStatus] = useState<DutyStatus>(
        shiftInfo.dutyStatus ?? 'operating',
    );
    const [standbyReason, setStandbyReason] =
        useState<StandbyReason>('client_delay');
    const [remarks, setRemarks] = useState('');
    const [isCertified, setIsCertified] = useState(true);
    const [isSaved, setIsSaved] = useState(false);

    const hoursElapsed = shiftInfo.hoursElapsed ?? 4.5;
    const driveHoursElapsed = 3.5;
    const cycleHoursElapsed = 52.5;

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

    const handleConfirm = () => {
        setIsSaved(true);
        onUpdateDutyStatus?.(
            selectedStatus,
            selectedStatus === 'standby' ? standbyReason : undefined,
            remarks.trim() ? remarks.trim() : undefined,
        );
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
            {/* 1. Fixed Top Header Bar matching DVIR */}
            <View style={[styles.headerBar, isDarkHud && styles.darkHeaderBar]}>
                <Pressable
                    accessibilityLabel="Close and return"
                    accessibilityRole="button"
                    onPress={() => {
                        if (onBack) {
                            onBack();
                        }
                    }}
                    style={styles.closeHeaderBtn}
                    testID="hos-back-btn"
                >
                    <Icon color="#94A3B8" name="back" size={22} />
                </Pressable>
                <View style={styles.headerCenter}>
                    <Text style={styles.pageCategory}>
                        HOURS OF SERVICE (HoS) · ELD COCKPIT
                    </Text>
                    <Text accessibilityRole="header" style={styles.screenTitle}>
                        Duty Status &amp; Shift Management
                    </Text>
                    <Text style={styles.headerSubtitle}>
                        Operator: {operatorName} · Shift Started:{' '}
                        {shiftInfo?.startedAt ?? '08:00 AM'} (
                        {hoursElapsed.toFixed(1)}h Elapsed)
                    </Text>
                </View>
                <View style={styles.dutyPillBadge}>
                    <View
                        style={[
                            styles.dutyBadgeDot,
                            { backgroundColor: activeConfig.accentColor },
                        ]}
                    />
                    <Text style={styles.dutyPillBadgeText}>
                        {activeConfig.badge}
                    </Text>
                </View>
            </View>

            {/* 2. Scrollable Cockpit Content */}
            <ScrollView
                accessibilityLabel="Hours of service duty status and clocks"
                contentContainerStyle={styles.contentContainer}
                style={styles.scrollView}
            >
                {/* 3. Live ELD Clocks Card */}
                <View style={styles.clocksCard} testID="hos-eld-clocks-card">
                    <View style={styles.cardHeader}>
                        <View style={styles.badgeRow}>
                            <Icon color="#10B981" name="clock" size={18} />
                            <Text style={styles.clocksCardHeading}>
                                LIVE ELD DUTY CLOCKS
                            </Text>
                        </View>
                        <Text style={styles.cycleText}>
                            {userRole.toUpperCase()}
                        </Text>
                    </View>

                    {/* 4-Cell Dials Grid */}
                    <View style={styles.clocksGrid}>
                        {/* Dial 1: Drive / Operating Remaining */}
                        <View style={styles.clockCell}>
                            <Text style={styles.clockCellLabel}>
                                Drive / Operating
                            </Text>
                            <Text style={styles.clockCellValueGreen}>
                                {formatHoursMinutes(driveRemainingHours)}
                            </Text>
                            <Text style={styles.clockCellSub}>
                                of {maxDriveHours}h limit
                            </Text>
                        </View>

                        {/* Dial 2: Shift Window Remaining */}
                        <View style={styles.clockCell}>
                            <Text style={styles.clockCellLabel}>
                                Shift Window
                            </Text>
                            <Text style={styles.clockCellValueBlue}>
                                {formatHoursMinutes(shiftRemainingHours)}
                            </Text>
                            <Text style={styles.clockCellSub}>
                                of {maxShiftHours}h daily
                            </Text>
                        </View>

                        {/* Dial 3: 70-Hr Cycle Remaining */}
                        <View style={styles.clockCell}>
                            <Text style={styles.clockCellLabel}>
                                70-Hr 8-Day Cycle
                            </Text>
                            <Text style={styles.clockCellValueAmber}>
                                {formatHoursMinutes(cycleRemainingHours)}
                            </Text>
                            <Text style={styles.clockCellSub}>
                                {cycleHoursElapsed.toFixed(1)}h logged
                            </Text>
                        </View>

                        {/* Dial 4: Mandatory Rest Break Countdown */}
                        <View style={styles.clockCell}>
                            <Text style={styles.clockCellLabel}>
                                Break Countdown
                            </Text>
                            <Text style={styles.clockCellValuePurple}>
                                {formatHoursMinutes(breakCountdownHours)}
                            </Text>
                            <Text style={styles.clockCellSub}>
                                until 30m rest
                            </Text>
                        </View>
                    </View>

                    {/* Shift Progress Gauge Bar */}
                    <View style={styles.gaugeContainer}>
                        <View style={styles.gaugeMetaRow}>
                            <Text style={styles.gaugeMetaLabel}>
                                Daily Shift Elapsed: {hoursElapsed.toFixed(1)} /{' '}
                                {maxShiftHours}h
                            </Text>
                            <Text style={styles.gaugeMetaPercent}>
                                {shiftProgressPercent}% Used
                            </Text>
                        </View>
                        <View style={styles.gaugeTrack}>
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
                <View style={styles.sectionCard} testID="duty-status-selector">
                    <Text
                        accessibilityRole="header"
                        style={styles.sectionTitle}
                    >
                        SELECT ACTIVE DUTY STATUS
                    </Text>
                    <Text style={styles.sectionHelper}>
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
                                        isSelected &&
                                            styles.dutyOptionCardSelected,
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
                                                    isSelected &&
                                                        styles.optionBadgeTextActive,
                                                ]}
                                            >
                                                {opt.badge}
                                            </Text>
                                        </View>
                                        <View style={styles.optionCopy}>
                                            <Text
                                                style={[
                                                    styles.optionTitle,
                                                    isSelected &&
                                                        styles.optionTitleSelected,
                                                ]}
                                            >
                                                {opt.title}
                                            </Text>
                                            <Text style={styles.optionSubtitle}>
                                                {opt.subtitle}
                                            </Text>
                                        </View>
                                    </View>

                                    <View
                                        style={[
                                            styles.radioButton,
                                            isSelected &&
                                                styles.radioButtonSelected,
                                        ]}
                                    >
                                        {isSelected ? (
                                            <View
                                                style={styles.radioButtonInner}
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
                        style={styles.sectionCard}
                        testID="standby-reason-section"
                    >
                        <Text
                            accessibilityRole="header"
                            style={styles.sectionTitle}
                        >
                            STANDBY &amp; DEMURRAGE REASON
                        </Text>
                        <Text style={styles.sectionHelper}>
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
                                            isSelected &&
                                                styles.standbyChipSelected,
                                        ]}
                                        testID={`standby-reason-${r.reason}`}
                                    >
                                        <Text
                                            style={[
                                                styles.standbyChipText,
                                                isSelected &&
                                                    styles.standbyChipTextSelected,
                                            ]}
                                        >
                                            {r.label}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>
                ) : null}

                {/* 6. Remarks / Location Input */}
                <View style={styles.sectionCard}>
                    <Text style={styles.inputLabel}>
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
                        placeholderTextColor="#64748B"
                        style={styles.input}
                        value={remarks}
                        testID="hos-remarks-input"
                    />
                </View>

                {/* 7. 24-Hour Duty Timeline Graph (Samsara / ELD Visual Graph) */}
                <View style={styles.sectionCard} testID="hos-timeline-graph">
                    <Text
                        accessibilityRole="header"
                        style={styles.sectionTitle}
                    >
                        24-HOUR DUTY TIMELINE (TODAY)
                    </Text>
                    <Text style={styles.sectionHelper}>
                        Visual ELD graph of 24-hour shift status progression
                        (00:00 to 24:00).
                    </Text>

                    <View style={styles.graphContainer}>
                        {/* Row: OFF Duty */}
                        <View style={styles.graphRow}>
                            <Text style={styles.graphRowHeader}>OFF</Text>
                            <View style={styles.graphRowTrack}>
                                <View
                                    style={[
                                        styles.graphSegment,
                                        {
                                            left: '0%',
                                            width: '33.3%',
                                            backgroundColor: '#475569',
                                        },
                                    ]}
                                />
                            </View>
                        </View>

                        {/* Row: On Break */}
                        <View style={styles.graphRow}>
                            <Text style={styles.graphRowHeader}>BRK</Text>
                            <View style={styles.graphRowTrack}>
                                <View
                                    style={[
                                        styles.graphSegment,
                                        {
                                            left: '50%',
                                            width: '2.1%',
                                            backgroundColor: '#10B981',
                                        },
                                    ]}
                                />
                            </View>
                        </View>

                        {/* Row: Driving */}
                        <View style={styles.graphRow}>
                            <Text style={styles.graphRowHeader}>DRV</Text>
                            <View style={styles.graphRowTrack}>
                                <View
                                    style={[
                                        styles.graphSegment,
                                        {
                                            left: '33.3%',
                                            width: '6.2%',
                                            backgroundColor: '#3B82F6',
                                        },
                                    ]}
                                />
                            </View>
                        </View>

                        {/* Row: Operating / On Duty */}
                        <View style={styles.graphRow}>
                            <Text style={styles.graphRowHeader}>ON</Text>
                            <View style={styles.graphRowTrack}>
                                <View
                                    style={[
                                        styles.graphSegment,
                                        {
                                            left: '39.5%',
                                            width: '10.5%',
                                            backgroundColor: '#F59E0B',
                                        },
                                    ]}
                                />
                                <View
                                    style={[
                                        styles.graphSegment,
                                        {
                                            left: '52.1%',
                                            width: '6.2%',
                                            backgroundColor: '#F59E0B',
                                        },
                                    ]}
                                />
                            </View>
                        </View>

                        {/* Timeline Hour Scale */}
                        <View style={styles.graphTimeScale}>
                            <Text style={styles.timeMark}>00:00</Text>
                            <Text style={styles.timeMark}>06:00</Text>
                            <Text style={styles.timeMark}>12:00</Text>
                            <Text style={styles.timeMark}>18:00</Text>
                            <Text style={styles.timeMark}>24:00</Text>
                        </View>
                    </View>
                </View>

                {/* 8. Chronological Shift Log Events History */}
                <View style={styles.sectionCard} testID="hos-activity-logs">
                    <Text
                        accessibilityRole="header"
                        style={styles.sectionTitle}
                    >
                        TODAY'S SHIFT ACTIVITY LOG
                    </Text>
                    <Text style={styles.sectionHelper}>
                        Timestamped change-of-duty event logs with GPS location
                        audits.
                    </Text>

                    <View style={styles.logEventsList}>
                        {INITIAL_LOG_EVENTS.map((evt) => (
                            <View key={evt.id} style={styles.logEventCard}>
                                <View style={styles.logEventHeader}>
                                    <View style={styles.logBadgeRow}>
                                        <View
                                            style={[
                                                styles.logStatusBadge,
                                                evt.status === 'operating'
                                                    ? styles.logStatusOperating
                                                    : evt.status === 'driving'
                                                      ? styles.logStatusDriving
                                                      : evt.status ===
                                                          'on_break'
                                                        ? styles.logStatusBreak
                                                        : styles.logStatusOff,
                                            ]}
                                        >
                                            <Text style={styles.logStatusText}>
                                                {evt.status.toUpperCase()}
                                            </Text>
                                        </View>
                                        <Text style={styles.logTimeRange}>
                                            {evt.startTime} – {evt.endTime}
                                        </Text>
                                    </View>
                                    <Text style={styles.logDuration}>
                                        {evt.durationFormatted}
                                    </Text>
                                </View>

                                <Text style={styles.logDetails}>
                                    {evt.details}
                                </Text>
                                <Text style={styles.logLocation}>
                                    📍 {evt.location}
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* 9. Legal Operator Certification */}
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
                            isCertified && styles.certBoxChecked,
                        ]}
                    >
                        {isCertified ? (
                            <Text style={styles.certCheckMark}>✓</Text>
                        ) : null}
                    </View>
                    <Text style={styles.certCheckLabel}>
                        I certify that these duty status entries and hours of
                        service are true, complete, and accurate for this shift.
                    </Text>
                </Pressable>

                {/* 10. Confirmation & Action Button */}
                {!isSaved ? (
                    <Pressable
                        accessibilityLabel="Update and certify duty status"
                        accessibilityRole="button"
                        disabled={!isCertified}
                        onPress={handleConfirm}
                        style={({ pressed }) => [
                            styles.actionButton,
                            !isCertified && styles.actionButtonDisabled,
                            pressed && styles.pressed,
                        ]}
                        testID="confirm-hos-btn"
                    >
                        <Text style={styles.actionBtnText}>
                            ✓ Update &amp; Certify Duty Status
                        </Text>
                    </Pressable>
                ) : (
                    <View
                        style={styles.signedStamp}
                        testID="hos-confirmed-stamp"
                    >
                        <Text style={styles.signedStampTitle}>
                            ✓ DUTY STATUS UPDATED &amp; CERTIFIED
                        </Text>
                        <Text style={styles.signedStampSub}>
                            Active: {activeConfig.title} (
                            {new Date().toLocaleTimeString()})
                        </Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    screenRoot: {
        backgroundColor: '#090E1A',
        flex: 1,
    },
    darkScreenRoot: {
        backgroundColor: '#090E1A',
    },
    headerBar: {
        alignItems: 'center',
        backgroundColor: '#0F172A',
        borderBottomColor: '#1E293B',
        borderBottomWidth: 1,
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    darkHeaderBar: {
        backgroundColor: '#0F172A',
        borderBottomColor: '#1E293B',
    },
    closeHeaderBtn: {
        alignItems: 'center',
        height: 38,
        justifyContent: 'center',
        width: 38,
    },
    headerCenter: {
        flex: 1,
    },
    pageCategory: {
        color: '#F59E0B',
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 0.8,
    },
    screenTitle: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '800',
    },
    headerSubtitle: {
        color: '#94A3B8',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 1,
    },
    dutyPillBadge: {
        alignItems: 'center',
        backgroundColor: '#101A2E',
        borderColor: '#1E3254',
        borderRadius: 8,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    dutyBadgeDot: {
        borderRadius: 4,
        height: 8,
        width: 8,
    },
    dutyPillBadgeText: {
        color: '#F8FAFC',
        fontSize: 12,
        fontWeight: '900',
    },
    scrollView: {
        flex: 1,
    },
    contentContainer: {
        alignSelf: 'center',
        backgroundColor: '#090E1A',
        maxWidth: 720,
        padding: 16,
        paddingBottom: 36,
        width: '100%',
    },
    clocksCard: {
        backgroundColor: '#0F172A',
        borderColor: '#1E293B',
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 16,
        padding: 16,
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
        color: '#10B981',
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    cycleText: {
        color: '#94A3B8',
        fontSize: 11,
        fontWeight: '700',
    },
    clocksGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 14,
    },
    clockCell: {
        backgroundColor: '#162238',
        borderColor: '#1E3A8A',
        borderRadius: 8,
        borderWidth: 1,
        flex: 1,
        minWidth: '45%',
        padding: 12,
    },
    clockCellLabel: {
        color: '#94A3B8',
        fontSize: 11,
        fontWeight: '700',
        marginBottom: 4,
    },
    clockCellValueGreen: {
        color: '#10B981',
        fontSize: 18,
        fontWeight: '900',
    },
    clockCellValueBlue: {
        color: '#60A5FA',
        fontSize: 18,
        fontWeight: '900',
    },
    clockCellValueAmber: {
        color: '#FBBF24',
        fontSize: 18,
        fontWeight: '900',
    },
    clockCellValuePurple: {
        color: '#C084FC',
        fontSize: 18,
        fontWeight: '900',
    },
    clockCellSub: {
        color: '#64748B',
        fontSize: 10,
        fontWeight: '600',
        marginTop: 2,
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
        color: '#94A3B8',
        fontSize: 12,
        fontWeight: '600',
    },
    gaugeMetaPercent: {
        color: '#F8FAFC',
        fontSize: 12,
        fontWeight: '800',
    },
    gaugeTrack: {
        backgroundColor: '#162238',
        borderRadius: 6,
        height: 8,
        overflow: 'hidden',
        width: '100%',
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
        backgroundColor: '#0F172A',
        borderColor: '#1E293B',
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 16,
        padding: 16,
    },
    sectionTitle: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '800',
        marginBottom: 4,
    },
    sectionHelper: {
        color: '#94A3B8',
        fontSize: 13,
        lineHeight: 18,
        marginBottom: 14,
    },
    dutyOptionsList: {
        gap: 10,
    },
    dutyOptionCard: {
        alignItems: 'center',
        backgroundColor: '#101A2E',
        borderColor: '#1E3254',
        borderRadius: 10,
        borderWidth: 1.5,
        flexDirection: 'row',
        justifyContent: 'space-between',
        minHeight: 56,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    dutyOptionCardSelected: {
        backgroundColor: '#172554',
        borderColor: '#2563EB',
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
        color: '#F8FAFC',
        fontSize: 11,
        fontWeight: '900',
    },
    optionBadgeTextActive: {
        color: '#FFFFFF',
    },
    optionCopy: {
        flex: 1,
    },
    optionTitle: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
    },
    optionTitleSelected: {
        color: '#60A5FA',
    },
    optionSubtitle: {
        color: '#94A3B8',
        fontSize: 12,
        marginTop: 2,
    },
    radioButton: {
        alignItems: 'center',
        borderColor: '#64748B',
        borderRadius: 10,
        borderWidth: 2,
        height: 20,
        justifyContent: 'center',
        width: 20,
    },
    radioButtonSelected: {
        borderColor: '#2563EB',
    },
    radioButtonInner: {
        backgroundColor: '#2563EB',
        borderRadius: 5,
        height: 10,
        width: 10,
    },
    standbyChipsGrid: {
        gap: 8,
    },
    standbyChip: {
        backgroundColor: '#101A2E',
        borderColor: '#1E3254',
        borderRadius: 8,
        borderWidth: 1,
        minHeight: 44,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    standbyChipSelected: {
        backgroundColor: '#451A03',
        borderColor: '#D97706',
        borderWidth: 1.5,
    },
    standbyChipText: {
        color: '#94A3B8',
        fontSize: 13,
        fontWeight: '700',
    },
    standbyChipTextSelected: {
        color: '#FBBF24',
        fontWeight: '800',
    },
    inputLabel: {
        color: '#CBD5E1',
        fontSize: 13,
        fontWeight: '800',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#162238',
        borderColor: '#1E3A8A',
        borderRadius: 8,
        borderWidth: 1,
        color: '#FFFFFF',
        fontSize: 14,
        minHeight: 64,
        paddingHorizontal: 12,
        paddingVertical: 10,
        textAlignVertical: 'top',
    },
    graphContainer: {
        backgroundColor: '#162238',
        borderColor: '#1E3A8A',
        borderRadius: 8,
        borderWidth: 1,
        padding: 12,
    },
    graphRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 10,
        marginVertical: 4,
    },
    graphRowHeader: {
        color: '#94A3B8',
        fontSize: 10,
        fontWeight: '900',
        width: 28,
    },
    graphRowTrack: {
        backgroundColor: '#0F172A',
        borderRadius: 4,
        flex: 1,
        height: 14,
        overflow: 'hidden',
        position: 'relative',
    },
    graphSegment: {
        borderRadius: 2,
        height: '100%',
        position: 'absolute',
    },
    graphTimeScale: {
        borderTopColor: '#1E293B',
        borderTopWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
        paddingLeft: 38,
        paddingTop: 4,
    },
    timeMark: {
        color: '#64748B',
        fontSize: 9,
        fontWeight: '700',
    },
    logEventsList: {
        gap: 8,
    },
    logEventCard: {
        backgroundColor: '#101A2E',
        borderColor: '#1E293B',
        borderRadius: 8,
        borderWidth: 1,
        padding: 12,
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
        backgroundColor: '#451A03',
    },
    logStatusDriving: {
        backgroundColor: '#172554',
    },
    logStatusBreak: {
        backgroundColor: '#06281E',
    },
    logStatusOff: {
        backgroundColor: '#334155',
    },
    logStatusText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '900',
    },
    logTimeRange: {
        color: '#94A3B8',
        fontSize: 12,
        fontWeight: '700',
    },
    logDuration: {
        color: '#F8FAFC',
        fontSize: 12,
        fontWeight: '800',
    },
    logDetails: {
        color: '#CBD5E1',
        fontSize: 12,
        lineHeight: 16,
        marginTop: 2,
    },
    logLocation: {
        color: '#64748B',
        fontSize: 11,
        marginTop: 4,
    },
    certCheckRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
        paddingHorizontal: 4,
    },
    certBox: {
        alignItems: 'center',
        borderColor: '#64748B',
        borderRadius: 6,
        borderWidth: 2,
        height: 24,
        justifyContent: 'center',
        width: 24,
    },
    certBoxChecked: {
        backgroundColor: '#2563EB',
        borderColor: '#2563EB',
    },
    certCheckMark: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '900',
    },
    certCheckLabel: {
        color: '#94A3B8',
        flex: 1,
        fontSize: 12,
        lineHeight: 16,
    },
    actionButton: {
        alignItems: 'center',
        backgroundColor: '#2563EB',
        borderRadius: 10,
        justifyContent: 'center',
        minHeight: 50,
        width: '100%',
    },
    actionButtonDisabled: {
        backgroundColor: '#1E293B',
        opacity: 0.6,
    },
    actionBtnText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '800',
    },
    signedStamp: {
        backgroundColor: '#06281E',
        borderColor: '#059669',
        borderRadius: 8,
        borderWidth: 1,
        padding: 14,
    },
    signedStampTitle: {
        color: '#34D399',
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    signedStampSub: {
        color: '#6EE7B7',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 2,
    },
    pressed: {
        opacity: 0.78,
    },
});
