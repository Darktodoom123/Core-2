import React, { useEffect, useMemo, useState } from 'react';
import {
    Animated,
    Easing,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import type { DimensionValue } from 'react-native';
import { Icon } from '../components/common/Icon';
import type { IconName } from '../components/common/Icon';
import { TileScreenHeader } from '../components/layout/tile-screen-header';
import { EndShiftSafeguardModal } from '../components/sheets/EndShiftSafeguardModal';
import { ReliefHandoverModal } from '../components/sheets/ReliefHandoverModal';
import type { FieldApiClient } from '../services/apiClient';
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
    timelineHistory?: TimelineDayHistory[];
    apiClient?: FieldApiClient;
    activeJobId?: number;
    onBack?: () => void;
    onUpdateDutyStatus?: (
        dutyStatus: DutyStatus,
        standbyReason?: StandbyReason,
        remarks?: string,
    ) => void;
    onReleaseUnit?: (assetCode: string) => void;
    onToggleShift?: (nextStatus: 'on_shift' | 'off_shift') => void;
    onEndShift?: () => void;
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

export interface ShiftLogEvent {
    id: string;
    status: DutyStatus;
    startTime: string;
    endTime: string;
    durationFormatted: string;
    details: string;
    location: string;
}

export interface TimelineSegment {
    left: DimensionValue;
    width: DimensionValue;
}

export interface TimelineDayHistory {
    id: string;
    dayLabel: string;
    dateFormatted: string;
    shortDate: string;
    isToday: boolean;
    driveHoursFormatted: string;
    onDutyHoursFormatted: string;
    offDutyHoursFormatted: string;
    totalShiftFormatted: string;
    certificationStatus: 'active' | 'certified' | 'restart';
    certifiedByText: string;
    segments: {
        off: TimelineSegment[];
        brk: TimelineSegment[];
        drv: TimelineSegment[];
        on: TimelineSegment[];
    };
    events: ShiftLogEvent[];
}

export const INITIAL_LOG_EVENTS: ShiftLogEvent[] = [
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

export const TIMELINE_HISTORY_DAYS: TimelineDayHistory[] = [
    {
        id: 'day-0',
        dayLabel: 'Today (Sep 5)',
        dateFormatted: 'Friday, Sep 5, 2026',
        shortDate: 'Today',
        isToday: true,
        driveHoursFormatted: '1h 30m',
        onDutyHoursFormatted: '4h 00m',
        offDutyHoursFormatted: '8h 00m',
        totalShiftFormatted: '5h 30m',
        certificationStatus: 'active',
        certifiedByText: 'Sign off and certify log at end of shift',
        segments: {
            off: [{ left: '0%', width: '33.3%' }],
            brk: [{ left: '50%', width: '2.1%' }],
            drv: [{ left: '33.3%', width: '6.2%' }],
            on: [
                { left: '39.5%', width: '10.5%' },
                { left: '52.1%', width: '6.2%' },
            ],
        },
        events: INITIAL_LOG_EVENTS,
    },
    {
        id: 'day-1',
        dayLabel: 'Thu, Sep 4 (Yesterday)',
        dateFormatted: 'Thursday, Sep 4, 2026',
        shortDate: 'Sep 4',
        isToday: false,
        driveHoursFormatted: '6h 15m',
        onDutyHoursFormatted: '3h 00m',
        offDutyHoursFormatted: '14h 45m',
        totalShiftFormatted: '9h 15m',
        certificationStatus: 'certified',
        certifiedByText: '✓ Certified by Alex Rivera · Sep 4, 17:18 PHT',
        segments: {
            off: [
                { left: '0%', width: '29.2%' },
                { left: '70.8%', width: '29.2%' },
            ],
            brk: [{ left: '47.9%', width: '3.1%' }],
            drv: [
                { left: '33.3%', width: '14.6%' },
                { left: '51%', width: '11.5%' },
            ],
            on: [
                { left: '29.2%', width: '4.1%' },
                { left: '62.5%', width: '8.3%' },
            ],
        },
        events: [
            {
                id: 'log-sep4-1',
                status: 'operating',
                startTime: '07:00 AM',
                endTime: '08:00 AM',
                durationFormatted: '1h 00m',
                details:
                    'Pre-trip walkaround, outrigger hydraulic inspection & load chart verify',
                location: 'Depot Yard 2, Manila',
            },
            {
                id: 'log-sep4-2',
                status: 'driving',
                startTime: '08:00 AM',
                endTime: '11:30 AM',
                durationFormatted: '3h 30m',
                details:
                    'Lowbed equipment transit via SLEX to Calamba construction hub',
                location: 'SLEX Southbound Km 42',
            },
            {
                id: 'log-sep4-3',
                status: 'on_break',
                startTime: '11:30 AM',
                endTime: '12:15 PM',
                durationFormatted: '0h 45m',
                details: 'Mandatory mid-shift driver meal & thermal break',
                location: 'Calamba Oasis Station',
            },
            {
                id: 'log-sep4-4',
                status: 'driving',
                startTime: '12:15 PM',
                endTime: '03:00 PM',
                durationFormatted: '2h 45m',
                details: 'Equipment transit to Batangas Industrial Plant',
                location: 'STAR Tollway Corridor',
            },
            {
                id: 'log-sep4-5',
                status: 'operating',
                startTime: '03:00 PM',
                endTime: '05:00 PM',
                durationFormatted: '2h 00m',
                details:
                    'Equipment placement & post-trip safety checklist audit',
                location: 'Batangas Port Terminal',
            },
            {
                id: 'log-sep4-6',
                status: 'off_duty',
                startTime: '05:00 PM',
                endTime: '11:59 PM',
                durationFormatted: '7h 00m',
                details:
                    'Shift finalized and certified. 10-hour rest clock active.',
                location: 'Driver Rest Lodge',
            },
        ],
    },
    {
        id: 'day-2',
        dayLabel: 'Wed, Sep 3',
        dateFormatted: 'Wednesday, Sep 3, 2026',
        shortDate: 'Sep 3',
        isToday: false,
        driveHoursFormatted: '2h 00m',
        onDutyHoursFormatted: '7h 15m',
        offDutyHoursFormatted: '14h 45m',
        totalShiftFormatted: '9h 15m',
        certificationStatus: 'certified',
        certifiedByText: '✓ Certified by Alex Rivera · Sep 3, 16:42 PHT',
        segments: {
            off: [
                { left: '0%', width: '27.1%' },
                { left: '68.8%', width: '31.2%' },
            ],
            brk: [{ left: '54.2%', width: '3.1%' }],
            drv: [{ left: '33.3%', width: '8.3%' }],
            on: [
                { left: '27.1%', width: '6.2%' },
                { left: '41.6%', width: '12.6%' },
                { left: '57.3%', width: '11.5%' },
            ],
        },
        events: [
            {
                id: 'log-sep3-1',
                status: 'operating',
                startTime: '06:30 AM',
                endTime: '08:00 AM',
                durationFormatted: '1h 30m',
                details:
                    'Safety toolbox briefing and crane wire-rope spooling check',
                location: 'BGC Site A, Taguig',
            },
            {
                id: 'log-sep3-2',
                status: 'driving',
                startTime: '08:00 AM',
                endTime: '10:00 AM',
                durationFormatted: '2h 00m',
                details: 'Transfer mobile crane unit to Tower 2 Crane Pad',
                location: 'BGC Metro Corridor',
            },
            {
                id: 'log-sep3-3',
                status: 'operating',
                startTime: '10:00 AM',
                endTime: '01:00 PM',
                durationFormatted: '3h 00m',
                details:
                    'Precast beam hoisting and level 12 structural placement',
                location: 'Tower 2 Site Pad',
            },
            {
                id: 'log-sep3-4',
                status: 'on_break',
                startTime: '01:00 PM',
                endTime: '01:45 PM',
                durationFormatted: '0h 45m',
                details: 'Meal pause and hydration break',
                location: 'Site Welfare Quarter',
            },
            {
                id: 'log-sep3-5',
                status: 'operating',
                startTime: '01:45 PM',
                endTime: '04:30 PM',
                durationFormatted: '2h 45m',
                details:
                    'Precision HVAC chiller unit roof lift and outrigger stowage',
                location: 'Tower 2 Rooftop Pad',
            },
        ],
    },
    {
        id: 'day-3',
        dayLabel: 'Tue, Sep 2',
        dateFormatted: 'Tuesday, Sep 2, 2026',
        shortDate: 'Sep 2',
        isToday: false,
        driveHoursFormatted: '8h 00m',
        onDutyHoursFormatted: '1h 00m',
        offDutyHoursFormatted: '15h 00m',
        totalShiftFormatted: '9h 00m',
        certificationStatus: 'certified',
        certifiedByText: '✓ Certified by Alex Rivera · Sep 2, 16:15 PHT',
        segments: {
            off: [
                { left: '0%', width: '25%' },
                { left: '66.7%', width: '33.3%' },
            ],
            brk: [{ left: '47.9%', width: '4.2%' }],
            drv: [
                { left: '29.2%', width: '18.7%' },
                { left: '52.1%', width: '14.6%' },
            ],
            on: [{ left: '25%', width: '4.2%' }],
        },
        events: [
            {
                id: 'log-sep2-1',
                status: 'operating',
                startTime: '06:00 AM',
                endTime: '07:00 AM',
                durationFormatted: '1h 00m',
                details:
                    'Pre-trip equipment inspection, tire pressure and brake line check',
                location: 'Subic Bay Depot',
            },
            {
                id: 'log-sep2-2',
                status: 'driving',
                startTime: '07:00 AM',
                endTime: '11:30 AM',
                durationFormatted: '4h 30m',
                details: 'Long-haul transport via SCTEX & NLEX southward',
                location: 'NLEX Km 65 Northbound',
            },
            {
                id: 'log-sep2-3',
                status: 'on_break',
                startTime: '11:30 AM',
                endTime: '12:30 PM',
                durationFormatted: '1h 00m',
                details: 'Driver lunch and recorded 30-minute break',
                location: 'NLEX Mega Station',
            },
            {
                id: 'log-sep2-4',
                status: 'driving',
                startTime: '12:30 PM',
                endTime: '04:00 PM',
                durationFormatted: '3h 30m',
                details:
                    'Delivery transit to Manila International Container Yard',
                location: 'R-10 Highway Manila',
            },
        ],
    },
    {
        id: 'day-4',
        dayLabel: 'Mon, Sep 1',
        dateFormatted: 'Monday, Sep 1, 2026',
        shortDate: 'Sep 1',
        isToday: false,
        driveHoursFormatted: '0h 00m',
        onDutyHoursFormatted: '0h 00m',
        offDutyHoursFormatted: '24h 00m',
        totalShiftFormatted: '0h 00m',
        certificationStatus: 'restart',
        certifiedByText: '✓ 34-Hour Restart Period · Off Duty Logged',
        segments: {
            off: [{ left: '0%', width: '100%' }],
            brk: [],
            drv: [],
            on: [],
        },
        events: [
            {
                id: 'log-sep1-1',
                status: 'off_duty',
                startTime: '12:00 AM',
                endTime: '11:59 PM',
                durationFormatted: '24h 00m',
                details:
                    'Mandatory 34-Hour HoS Cycle Restart — 24 consecutive hours off-duty',
                location: 'Operator Residence',
            },
        ],
    },
    {
        id: 'day-5',
        dayLabel: 'Sun, Aug 31',
        dateFormatted: 'Sunday, Aug 31, 2026',
        shortDate: 'Aug 31',
        isToday: false,
        driveHoursFormatted: '0h 00m',
        onDutyHoursFormatted: '0h 00m',
        offDutyHoursFormatted: '24h 00m',
        totalShiftFormatted: '0h 00m',
        certificationStatus: 'restart',
        certifiedByText: '✓ 34-Hour Restart Period · Off Duty Logged',
        segments: {
            off: [{ left: '0%', width: '100%' }],
            brk: [],
            drv: [],
            on: [],
        },
        events: [
            {
                id: 'log-aug31-1',
                status: 'off_duty',
                startTime: '12:00 AM',
                endTime: '11:59 PM',
                durationFormatted: '24h 00m',
                details:
                    'Mandatory 34-Hour HoS Cycle Restart — 24 consecutive hours off-duty',
                location: 'Operator Residence',
            },
        ],
    },
    {
        id: 'day-6',
        dayLabel: 'Sat, Aug 30',
        dateFormatted: 'Saturday, Aug 30, 2026',
        shortDate: 'Aug 30',
        isToday: false,
        driveHoursFormatted: '6h 00m',
        onDutyHoursFormatted: '3h 00m',
        offDutyHoursFormatted: '15h 00m',
        totalShiftFormatted: '9h 00m',
        certificationStatus: 'certified',
        certifiedByText: '✓ Certified by Alex Rivera · Aug 30, 17:10 PHT',
        segments: {
            off: [
                { left: '0%', width: '31.2%' },
                { left: '70.8%', width: '29.2%' },
            ],
            brk: [{ left: '52.1%', width: '2.1%' }],
            drv: [
                { left: '37.5%', width: '14.6%' },
                { left: '54.2%', width: '10.4%' },
            ],
            on: [
                { left: '31.2%', width: '6.3%' },
                { left: '64.6%', width: '6.2%' },
            ],
        },
        events: [
            {
                id: 'log-aug30-1',
                status: 'operating',
                startTime: '07:30 AM',
                endTime: '09:00 AM',
                durationFormatted: '1h 30m',
                details:
                    'Boom extension & load moment indicator calibration test',
                location: 'Clark Heavy Depot',
            },
            {
                id: 'log-aug30-2',
                status: 'driving',
                startTime: '09:00 AM',
                endTime: '12:30 PM',
                durationFormatted: '3h 30m',
                details: 'Transit convoy escort to Subic Freeport gate',
                location: 'SCTEX Clark-Subic',
            },
            {
                id: 'log-aug30-3',
                status: 'on_break',
                startTime: '12:30 PM',
                endTime: '01:00 PM',
                durationFormatted: '0h 30m',
                details: 'Midday lunch & mandatory rest',
                location: 'Subic Toll Plaza Rest',
            },
            {
                id: 'log-aug30-4',
                status: 'driving',
                startTime: '01:00 PM',
                endTime: '03:30 PM',
                durationFormatted: '2h 30m',
                details: 'On-site transit to drydock berth 4',
                location: 'Subic Shipyard Zone',
            },
            {
                id: 'log-aug30-5',
                status: 'operating',
                startTime: '03:30 PM',
                endTime: '05:00 PM',
                durationFormatted: '1h 30m',
                details: 'Tandem hoist positioning and outrigger lock',
                location: 'Drydock Berth 4',
            },
        ],
    },
    {
        id: 'day-7',
        dayLabel: 'Fri, Aug 29',
        dateFormatted: 'Friday, Aug 29, 2026',
        shortDate: 'Aug 29',
        isToday: false,
        driveHoursFormatted: '3h 30m',
        onDutyHoursFormatted: '5h 00m',
        offDutyHoursFormatted: '15h 30m',
        totalShiftFormatted: '8h 30m',
        certificationStatus: 'certified',
        certifiedByText: '✓ Certified by Alex Rivera · Aug 29, 16:15 PHT',
        segments: {
            off: [
                { left: '0%', width: '29.2%' },
                { left: '66.7%', width: '33.3%' },
            ],
            brk: [{ left: '50%', width: '3.1%' }],
            drv: [{ left: '35.4%', width: '14.6%' }],
            on: [
                { left: '29.2%', width: '6.2%' },
                { left: '53.1%', width: '13.6%' },
            ],
        },
        events: [
            {
                id: 'log-aug29-1',
                status: 'operating',
                startTime: '07:00 AM',
                endTime: '08:30 AM',
                durationFormatted: '1h 30m',
                details: 'Equipment rigging and outrigger cribbing checks',
                location: 'Clark Freeport Zone',
            },
            {
                id: 'log-aug29-2',
                status: 'driving',
                startTime: '08:30 AM',
                endTime: '12:00 PM',
                durationFormatted: '3h 30m',
                details: 'Highway transit of 50T hydraulic crane',
                location: 'MacArthur Highway',
            },
            {
                id: 'log-aug29-3',
                status: 'on_break',
                startTime: '12:00 PM',
                endTime: '12:45 PM',
                durationFormatted: '0h 45m',
                details: 'Mandatory rest & lunch period',
                location: 'San Fernando Oasis',
            },
            {
                id: 'log-aug29-4',
                status: 'operating',
                startTime: '12:45 PM',
                endTime: '04:00 PM',
                durationFormatted: '3h 15m',
                details:
                    'Bridge girder positioning lifts & post-shift walkaround',
                location: 'Pampanga River Bridge Site',
            },
        ],
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
    timelineHistory = TIMELINE_HISTORY_DAYS,
    apiClient,
    activeJobId,
    onBack,
    onUpdateDutyStatus,
    onReleaseUnit,
    onToggleShift,
    onEndShift,
}) => {
    const { isDarkHud } = useTheme();
    const [selectedDayIndex, setSelectedDayIndex] = useState(0);
    const historyDays =
        timelineHistory && timelineHistory.length > 0
            ? timelineHistory
            : TIMELINE_HISTORY_DAYS;
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
                subtitle={`Operator: ${operatorName} · Shift Started: ${shiftInfo?.startedAt ?? '08:00 AM'} (${hoursElapsed.toFixed(1)}h Elapsed)`}
                title="Duty Status & Shift Management"
            />

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
                                    style={({ pressed }) => [
                                        styles.dutyOptionCard,
                                        isDarkHud && styles.darkDutyOptionCard,
                                        isSelected &&
                                            (isDarkHud
                                                ? styles.darkDutyOptionCardSelected
                                                : styles.dutyOptionCardSelected),
                                        pressed && styles.dutyOptionCardPressed,
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
                                        style={({ pressed }) => [
                                            styles.standbyChip,
                                            isDarkHud && styles.darkStandbyChip,
                                            isSelected &&
                                                (isDarkHud
                                                    ? styles.darkStandbyChipSelected
                                                    : styles.standbyChipSelected),
                                            pressed && styles.pressed,
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
                        onPress={handleToggleCert}
                        style={styles.certCheckRow}
                        testID="hos-cert-check"
                    >
                        <Animated.View
                            style={[
                                styles.certBox,
                                isDarkHud && styles.darkCertBox,
                                isCertified &&
                                    (isDarkHud
                                        ? styles.darkCertBoxChecked
                                        : styles.certBoxChecked),
                                { transform: [{ scale: certCheckScale }] },
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
                        </Animated.View>
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
                                pressed && styles.actionButtonPressed,
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
                        <Animated.View
                            style={[
                                styles.signedStamp,
                                isDarkHud && styles.darkSignedStamp,
                                {
                                    opacity: stampOpacity,
                                    transform: [{ scale: stampScale }],
                                },
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
                        </Animated.View>
                    )}
                </View>

                {/* 6b. Compliant End Shift & Clock Out Safeguard Card */}
                <View
                    style={[
                        styles.sectionCard,
                        styles.endShiftCard,
                        isDarkHud && styles.darkSectionCard,
                        isDarkHud && styles.darkEndShiftCard,
                    ]}
                    testID="hos-end-shift-card"
                >
                    <View style={styles.endShiftHeaderRow}>
                        <View
                            style={[
                                styles.endShiftIconBadge,
                                isDarkHud && styles.darkEndShiftIconBadge,
                            ]}
                        >
                            <Icon
                                color={isDarkHud ? '#F87171' : '#DC2626'}
                                name="power"
                                size={20}
                            />
                        </View>
                        <View style={styles.endShiftHeaderCopy}>
                            <Text
                                accessibilityRole="header"
                                style={[
                                    styles.sectionTitle,
                                    isDarkHud && styles.darkSectionTitle,
                                ]}
                            >
                                END SHIFT &amp; CLOCK OUT
                            </Text>
                            <Text
                                style={[
                                    styles.sectionHelper,
                                    isDarkHud && styles.darkSectionHelper,
                                ]}
                            >
                                Compliant DOLE-OSHC &amp; DOT ELD shift closure.
                                Releases linked equipment proxy and begins
                                mandatory 10-hour daily rest period.
                            </Text>
                        </View>
                    </View>

                    {linkedAssetCode ? (
                        <View
                            style={[
                                styles.linkedAssetPill,
                                isDarkHud && styles.darkLinkedAssetPill,
                            ]}
                        >
                            <Icon
                                color={isDarkHud ? '#F59E0B' : '#D97706'}
                                name="crane"
                                size={14}
                            />
                            <Text
                                style={[
                                    styles.linkedAssetPillText,
                                    isDarkHud && styles.darkLinkedAssetPillText,
                                ]}
                            >
                                Linked Equipment: {linkedAssetCode}
                            </Text>
                        </View>
                    ) : null}

                    {selectedStatus === 'off_duty' ||
                    shiftInfo.status === 'off_shift' ? (
                        <View
                            style={[
                                styles.shiftCompletedNotice,
                                isDarkHud && styles.darkShiftCompletedNotice,
                            ]}
                            testID="shift-completed-notice"
                        >
                            <Icon
                                color={isDarkHud ? '#34D399' : '#059669'}
                                name="check-circle"
                                size={18}
                            />
                            <Text
                                style={[
                                    styles.shiftCompletedNoticeText,
                                    isDarkHud &&
                                        styles.darkShiftCompletedNoticeText,
                                ]}
                            >
                                Shift Closed &amp; Off Duty · 10h Daily Rest
                                Active
                            </Text>
                        </View>
                    ) : (
                        <Pressable
                            accessibilityLabel="End shift and clock out"
                            accessibilityRole="button"
                            onPress={() => {
                                if (linkedAssetCode) {
                                    setSafeguardModalOpen(true);
                                } else {
                                    setSelectedStatus('off_duty');
                                    executeDutyUpdate('off_duty');
                                    onToggleShift?.('off_shift');
                                    onEndShift?.();
                                }
                            }}
                            style={({ pressed }) => [
                                styles.endShiftBtn,
                                isDarkHud && styles.darkEndShiftBtn,
                                pressed && styles.actionButtonPressed,
                            ]}
                            testID="hos-end-shift-btn"
                        >
                            <Icon color="#FFFFFF" name="power" size={18} />
                            <Text style={styles.endShiftBtnText}>
                                End Shift &amp; Clock Out
                            </Text>
                        </Pressable>
                    )}
                </View>

                {/* 7. 24-Hour Duty Timeline Graph (Samsara / ELD Visual Graph) & 8-Day Cycle History */}
                <View
                    style={[
                        styles.sectionCard,
                        isDarkHud && styles.darkSectionCard,
                    ]}
                    testID="hos-timeline-graph"
                >
                    <View style={styles.timelineHeaderRow}>
                        <View style={{ flex: 1 }}>
                            <Text
                                accessibilityRole="header"
                                style={[
                                    styles.sectionTitle,
                                    isDarkHud && styles.darkSectionTitle,
                                ]}
                            >
                                {selectedDay.isToday
                                    ? '24-HOUR DUTY TIMELINE (TODAY)'
                                    : `24-HOUR DUTY TIMELINE — ${selectedDay.dayLabel.toUpperCase()}`}
                            </Text>
                            <Text
                                style={[
                                    styles.sectionHelper,
                                    isDarkHud && styles.darkSectionHelper,
                                ]}
                            >
                                Visual ELD graph of 24-hour shift status
                                progression (00:00 to 24:00).
                            </Text>
                        </View>
                        <View
                            style={[
                                styles.cycleBadge,
                                isDarkHud && styles.darkCycleBadge,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.cycleBadgeText,
                                    isDarkHud && styles.darkCycleBadgeText,
                                ]}
                            >
                                8-DAY CYCLE
                            </Text>
                        </View>
                    </View>

                    {/* Unified 8-Day Cycle Date Navigator */}
                    <View
                        style={[
                            styles.unifiedDateNavContainer,
                            isDarkHud && styles.darkUnifiedDateNavContainer,
                        ]}
                    >
                        {/* Stepper Header Row */}
                        <View style={styles.stepperHeaderRow}>
                            <Pressable
                                testID="hos-prev-day-btn"
                                accessibilityRole="button"
                                accessibilityLabel="View previous day's shift timeline and logs"
                                disabled={
                                    selectedDayIndex >= historyDays.length - 1
                                }
                                onPress={handlePrevDay}
                                style={({ pressed }) => [
                                    styles.stepperNavBtn,
                                    isDarkHud && styles.darkStepperNavBtn,
                                    selectedDayIndex >=
                                        historyDays.length - 1 &&
                                        styles.stepperNavBtnDisabled,
                                    pressed && styles.pressed,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.stepperNavBtnIcon,
                                        isDarkHud &&
                                            styles.darkStepperNavBtnIcon,
                                        selectedDayIndex >=
                                            historyDays.length - 1 &&
                                            styles.stepperNavBtnIconDisabled,
                                    ]}
                                >
                                    ‹
                                </Text>
                                <Text
                                    style={[
                                        styles.stepperNavBtnText,
                                        isDarkHud &&
                                            styles.darkStepperNavBtnText,
                                        selectedDayIndex >=
                                            historyDays.length - 1 &&
                                            styles.stepperNavBtnTextDisabled,
                                    ]}
                                >
                                    Prev
                                </Text>
                            </Pressable>

                            <View
                                style={[
                                    styles.stepperCenterPill,
                                    isDarkHud && styles.darkStepperCenterPill,
                                ]}
                            >
                                <Text
                                    numberOfLines={1}
                                    style={[
                                        styles.stepperDayLabel,
                                        isDarkHud && styles.darkStepperDayLabel,
                                    ]}
                                >
                                    {selectedDay.dayLabel}
                                </Text>
                                <Text
                                    numberOfLines={1}
                                    style={[
                                        styles.stepperDateSub,
                                        isDarkHud && styles.darkStepperDateSub,
                                    ]}
                                >
                                    {selectedDay.dateFormatted}
                                </Text>
                            </View>

                            <Pressable
                                testID="hos-next-day-btn"
                                accessibilityRole="button"
                                accessibilityLabel="View next day's shift timeline and logs"
                                disabled={selectedDayIndex <= 0}
                                onPress={handleNextDay}
                                style={({ pressed }) => [
                                    styles.stepperNavBtn,
                                    isDarkHud && styles.darkStepperNavBtn,
                                    selectedDayIndex <= 0 &&
                                        styles.stepperNavBtnDisabled,
                                    pressed && styles.pressed,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.stepperNavBtnText,
                                        isDarkHud &&
                                            styles.darkStepperNavBtnText,
                                        selectedDayIndex <= 0 &&
                                            styles.stepperNavBtnTextDisabled,
                                    ]}
                                >
                                    Next
                                </Text>
                                <Text
                                    style={[
                                        styles.stepperNavBtnIcon,
                                        isDarkHud &&
                                            styles.darkStepperNavBtnIcon,
                                        selectedDayIndex <= 0 &&
                                            styles.stepperNavBtnIconDisabled,
                                    ]}
                                >
                                    ›
                                </Text>
                            </Pressable>
                        </View>

                        {/* Integrated Horizontal Day Ribbon */}
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.dayPillsScrollContent}
                            style={styles.dayPillsScroll}
                        >
                            {historyDays.map((day, idx) => {
                                const isSelected = idx === selectedDayIndex;

                                return (
                                    <Pressable
                                        key={day.id}
                                        testID={`hos-day-pill-${idx}`}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Select ${day.dayLabel}`}
                                        onPress={() => setSelectedDayIndex(idx)}
                                        style={({ pressed }) => [
                                            styles.dayPill,
                                            isDarkHud && styles.darkDayPill,
                                            isSelected &&
                                                (isDarkHud
                                                    ? styles.darkDayPillSelected
                                                    : styles.dayPillSelected),
                                            pressed && styles.pressed,
                                        ]}
                                    >
                                        <Text
                                            numberOfLines={1}
                                            style={[
                                                styles.dayPillText,
                                                isDarkHud &&
                                                    styles.darkDayPillText,
                                                isSelected &&
                                                    (isDarkHud
                                                        ? styles.darkDayPillTextSelected
                                                        : styles.dayPillTextSelected),
                                            ]}
                                        >
                                            {day.shortDate}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                    </View>

                    <View
                        style={[
                            styles.graphContainer,
                            isDarkHud && styles.darkGraphContainer,
                        ]}
                    >
                        {/* Visual Graph Legend */}
                        <View style={styles.graphLegendRow}>
                            <View style={styles.legendItem}>
                                <View
                                    style={[
                                        styles.legendDot,
                                        {
                                            backgroundColor: isDarkHud
                                                ? '#64748B'
                                                : '#64748B',
                                        },
                                    ]}
                                />
                                <Text
                                    style={[
                                        styles.legendText,
                                        isDarkHud && styles.darkLegendText,
                                    ]}
                                >
                                    Off Duty
                                </Text>
                            </View>
                            <View style={styles.legendItem}>
                                <View
                                    style={[
                                        styles.legendDot,
                                        {
                                            backgroundColor: isDarkHud
                                                ? '#10B981'
                                                : '#059669',
                                        },
                                    ]}
                                />
                                <Text
                                    style={[
                                        styles.legendText,
                                        isDarkHud && styles.darkLegendText,
                                    ]}
                                >
                                    Break
                                </Text>
                            </View>
                            <View style={styles.legendItem}>
                                <View
                                    style={[
                                        styles.legendDot,
                                        {
                                            backgroundColor: isDarkHud
                                                ? '#3B82F6'
                                                : '#2563EB',
                                        },
                                    ]}
                                />
                                <Text
                                    style={[
                                        styles.legendText,
                                        isDarkHud && styles.darkLegendText,
                                    ]}
                                >
                                    Driving
                                </Text>
                            </View>
                            <View style={styles.legendItem}>
                                <View
                                    style={[
                                        styles.legendDot,
                                        {
                                            backgroundColor: isDarkHud
                                                ? '#F59E0B'
                                                : '#D97706',
                                        },
                                    ]}
                                />
                                <Text
                                    style={[
                                        styles.legendText,
                                        isDarkHud && styles.darkLegendText,
                                    ]}
                                >
                                    On Duty
                                </Text>
                            </View>
                        </View>

                        {/* Row: OFF Duty */}
                        <View style={styles.graphRow}>
                            <View style={styles.graphRowLabelGroup}>
                                <View
                                    style={[
                                        styles.graphRowDot,
                                        {
                                            backgroundColor: isDarkHud
                                                ? '#64748B'
                                                : '#64748B',
                                        },
                                    ]}
                                />
                                <Text
                                    style={[
                                        styles.graphRowHeader,
                                        isDarkHud && styles.darkGraphRowHeader,
                                    ]}
                                >
                                    OFF
                                </Text>
                            </View>
                            <View
                                style={[
                                    styles.graphRowTrack,
                                    isDarkHud && styles.darkGraphRowTrack,
                                ]}
                            >
                                {selectedDay.segments.off.map((seg, sIdx) => (
                                    <View
                                        key={`off-${sIdx}`}
                                        style={[
                                            styles.graphSegment,
                                            {
                                                left: seg.left,
                                                width: seg.width,
                                                backgroundColor: isDarkHud
                                                    ? '#475569'
                                                    : '#64748B',
                                            },
                                        ]}
                                    />
                                ))}
                            </View>
                        </View>

                        {/* Row: On Break */}
                        <View style={styles.graphRow}>
                            <View style={styles.graphRowLabelGroup}>
                                <View
                                    style={[
                                        styles.graphRowDot,
                                        {
                                            backgroundColor: isDarkHud
                                                ? '#10B981'
                                                : '#059669',
                                        },
                                    ]}
                                />
                                <Text
                                    style={[
                                        styles.graphRowHeader,
                                        isDarkHud && styles.darkGraphRowHeader,
                                    ]}
                                >
                                    BRK
                                </Text>
                            </View>
                            <View
                                style={[
                                    styles.graphRowTrack,
                                    isDarkHud && styles.darkGraphRowTrack,
                                ]}
                            >
                                {selectedDay.segments.brk.map((seg, sIdx) => (
                                    <View
                                        key={`brk-${sIdx}`}
                                        style={[
                                            styles.graphSegment,
                                            {
                                                left: seg.left,
                                                width: seg.width,
                                                backgroundColor: isDarkHud
                                                    ? '#10B981'
                                                    : '#059669',
                                            },
                                        ]}
                                    />
                                ))}
                            </View>
                        </View>

                        {/* Row: Driving */}
                        <View style={styles.graphRow}>
                            <View style={styles.graphRowLabelGroup}>
                                <View
                                    style={[
                                        styles.graphRowDot,
                                        {
                                            backgroundColor: isDarkHud
                                                ? '#3B82F6'
                                                : '#2563EB',
                                        },
                                    ]}
                                />
                                <Text
                                    style={[
                                        styles.graphRowHeader,
                                        isDarkHud && styles.darkGraphRowHeader,
                                    ]}
                                >
                                    DRV
                                </Text>
                            </View>
                            <View
                                style={[
                                    styles.graphRowTrack,
                                    isDarkHud && styles.darkGraphRowTrack,
                                ]}
                            >
                                {selectedDay.segments.drv.map((seg, sIdx) => (
                                    <View
                                        key={`drv-${sIdx}`}
                                        style={[
                                            styles.graphSegment,
                                            {
                                                left: seg.left,
                                                width: seg.width,
                                                backgroundColor: isDarkHud
                                                    ? '#3B82F6'
                                                    : '#2563EB',
                                            },
                                        ]}
                                    />
                                ))}
                            </View>
                        </View>

                        {/* Row: Operating / On Duty */}
                        <View style={styles.graphRow}>
                            <View style={styles.graphRowLabelGroup}>
                                <View
                                    style={[
                                        styles.graphRowDot,
                                        {
                                            backgroundColor: isDarkHud
                                                ? '#F59E0B'
                                                : '#D97706',
                                        },
                                    ]}
                                />
                                <Text
                                    style={[
                                        styles.graphRowHeader,
                                        isDarkHud && styles.darkGraphRowHeader,
                                    ]}
                                >
                                    ON
                                </Text>
                            </View>
                            <View
                                style={[
                                    styles.graphRowTrack,
                                    isDarkHud && styles.darkGraphRowTrack,
                                ]}
                            >
                                {selectedDay.segments.on.map((seg, sIdx) => (
                                    <View
                                        key={`on-${sIdx}`}
                                        style={[
                                            styles.graphSegment,
                                            {
                                                left: seg.left,
                                                width: seg.width,
                                                backgroundColor: isDarkHud
                                                    ? '#F59E0B'
                                                    : '#D97706',
                                            },
                                        ]}
                                    />
                                ))}
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

                    {/* Daily Shift Summary Recap Row */}
                    <View style={styles.historyMetricsGrid}>
                        <View
                            style={[
                                styles.historyMetricCell,
                                isDarkHud && styles.darkHistoryMetricCell,
                            ]}
                        >
                            <View style={styles.metricCellHeader}>
                                <View
                                    style={[
                                        styles.metricIndicatorDot,
                                        { backgroundColor: '#2563EB' },
                                    ]}
                                />
                                <Text
                                    numberOfLines={1}
                                    ellipsizeMode="clip"
                                    style={[
                                        styles.historyMetricLabel,
                                        isDarkHud &&
                                            styles.darkHistoryMetricLabel,
                                    ]}
                                >
                                    DRIVE
                                </Text>
                            </View>
                            <Text
                                numberOfLines={1}
                                style={[
                                    styles.historyMetricVal,
                                    styles.metricValBlue,
                                ]}
                            >
                                {selectedDay.driveHoursFormatted}
                            </Text>
                        </View>
                        <View
                            style={[
                                styles.historyMetricCell,
                                isDarkHud && styles.darkHistoryMetricCell,
                            ]}
                        >
                            <View style={styles.metricCellHeader}>
                                <View
                                    style={[
                                        styles.metricIndicatorDot,
                                        { backgroundColor: '#D97706' },
                                    ]}
                                />
                                <Text
                                    numberOfLines={1}
                                    ellipsizeMode="clip"
                                    style={[
                                        styles.historyMetricLabel,
                                        isDarkHud &&
                                            styles.darkHistoryMetricLabel,
                                    ]}
                                >
                                    ON DUTY
                                </Text>
                            </View>
                            <Text
                                numberOfLines={1}
                                style={[
                                    styles.historyMetricVal,
                                    styles.metricValAmber,
                                ]}
                            >
                                {selectedDay.onDutyHoursFormatted}
                            </Text>
                        </View>
                        <View
                            style={[
                                styles.historyMetricCell,
                                isDarkHud && styles.darkHistoryMetricCell,
                            ]}
                        >
                            <View style={styles.metricCellHeader}>
                                <View
                                    style={[
                                        styles.metricIndicatorDot,
                                        { backgroundColor: '#64748B' },
                                    ]}
                                />
                                <Text
                                    numberOfLines={1}
                                    ellipsizeMode="clip"
                                    style={[
                                        styles.historyMetricLabel,
                                        isDarkHud &&
                                            styles.darkHistoryMetricLabel,
                                    ]}
                                >
                                    OFF DUTY
                                </Text>
                            </View>
                            <Text
                                numberOfLines={1}
                                style={[
                                    styles.historyMetricVal,
                                    isDarkHud
                                        ? styles.darkMetricValSlate
                                        : styles.metricValSlate,
                                ]}
                            >
                                {selectedDay.offDutyHoursFormatted}
                            </Text>
                        </View>
                        <View
                            style={[
                                styles.historyMetricCell,
                                isDarkHud && styles.darkHistoryMetricCell,
                            ]}
                        >
                            <View style={styles.metricCellHeader}>
                                <View
                                    style={[
                                        styles.metricIndicatorDot,
                                        { backgroundColor: '#059669' },
                                    ]}
                                />
                                <Text
                                    numberOfLines={1}
                                    ellipsizeMode="clip"
                                    style={[
                                        styles.historyMetricLabel,
                                        isDarkHud &&
                                            styles.darkHistoryMetricLabel,
                                    ]}
                                >
                                    TOTAL
                                </Text>
                            </View>
                            <Text
                                numberOfLines={1}
                                style={[
                                    styles.historyMetricVal,
                                    styles.metricValEmerald,
                                ]}
                            >
                                {selectedDay.totalShiftFormatted}
                            </Text>
                        </View>
                    </View>

                    {/* Certification & Compliance Audit Stamp */}
                    <View
                        style={[
                            styles.certAuditBadge,
                            selectedDay.certificationStatus === 'active'
                                ? styles.certAuditActive
                                : selectedDay.certificationStatus ===
                                    'certified'
                                  ? styles.certAuditCertified
                                  : styles.certAuditRestart,
                            isDarkHud &&
                                (selectedDay.certificationStatus === 'active'
                                    ? styles.darkCertAuditActive
                                    : selectedDay.certificationStatus ===
                                        'certified'
                                      ? styles.darkCertAuditCertified
                                      : styles.darkCertAuditRestart),
                        ]}
                    >
                        <View style={styles.certAuditCardInner}>
                            <View
                                style={[
                                    styles.certAuditIconCircle,
                                    selectedDay.certificationStatus === 'active'
                                        ? styles.certAuditIconCircleActive
                                        : selectedDay.certificationStatus ===
                                            'certified'
                                          ? styles.certAuditIconCircleCertified
                                          : styles.certAuditIconCircleRestart,
                                    isDarkHud &&
                                        (selectedDay.certificationStatus ===
                                        'active'
                                            ? styles.darkCertAuditIconCircleActive
                                            : selectedDay.certificationStatus ===
                                                'certified'
                                              ? styles.darkCertAuditIconCircleCertified
                                              : styles.darkCertAuditIconCircleRestart),
                                ]}
                            >
                                <Icon
                                    name={
                                        selectedDay.certificationStatus ===
                                        'active'
                                            ? 'clock'
                                            : selectedDay.certificationStatus ===
                                                'certified'
                                              ? 'check-circle'
                                              : 'shield-check'
                                    }
                                    size={16}
                                    color={
                                        selectedDay.certificationStatus ===
                                        'active'
                                            ? isDarkHud
                                                ? '#FBBF24'
                                                : '#D97706'
                                            : selectedDay.certificationStatus ===
                                                'certified'
                                              ? isDarkHud
                                                  ? '#34D399'
                                                  : '#059669'
                                              : isDarkHud
                                                ? '#94A3B8'
                                                : '#64748B'
                                    }
                                />
                            </View>

                            <View style={styles.certAuditTextContainer}>
                                <View style={styles.certAuditHeaderRow}>
                                    <Text
                                        numberOfLines={1}
                                        style={[
                                            styles.certAuditTitle,
                                            selectedDay.certificationStatus ===
                                            'active'
                                                ? styles.certAuditActiveTitle
                                                : selectedDay.certificationStatus ===
                                                    'certified'
                                                  ? styles.certAuditCertifiedTitle
                                                  : styles.certAuditRestartTitle,
                                            isDarkHud &&
                                                (selectedDay.certificationStatus ===
                                                'active'
                                                    ? styles.darkCertAuditActiveTitle
                                                    : selectedDay.certificationStatus ===
                                                        'certified'
                                                      ? styles.darkCertAuditCertifiedTitle
                                                      : styles.darkCertAuditRestartTitle),
                                        ]}
                                    >
                                        {selectedDay.certificationStatus ===
                                        'active'
                                            ? 'Active Shift in Progress'
                                            : selectedDay.certificationStatus ===
                                                'certified'
                                              ? 'Shift Certified'
                                              : '34-Hour HoS Restart'}
                                    </Text>
                                    <View
                                        style={[
                                            styles.certStatusPill,
                                            selectedDay.certificationStatus ===
                                            'active'
                                                ? styles.certStatusPillActive
                                                : selectedDay.certificationStatus ===
                                                    'certified'
                                                  ? styles.certStatusPillCertified
                                                  : styles.certStatusPillRestart,
                                            isDarkHud &&
                                                (selectedDay.certificationStatus ===
                                                'active'
                                                    ? styles.darkCertStatusPillActive
                                                    : selectedDay.certificationStatus ===
                                                        'certified'
                                                      ? styles.darkCertStatusPillCertified
                                                      : styles.darkCertStatusPillRestart),
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.certStatusPillText,
                                                selectedDay.certificationStatus ===
                                                'active'
                                                    ? styles.certStatusPillActiveText
                                                    : selectedDay.certificationStatus ===
                                                        'certified'
                                                      ? styles.certStatusPillCertifiedText
                                                      : styles.certStatusPillRestartText,
                                                isDarkHud &&
                                                    (selectedDay.certificationStatus ===
                                                    'active'
                                                        ? styles.darkCertStatusPillActiveText
                                                        : selectedDay.certificationStatus ===
                                                            'certified'
                                                          ? styles.darkCertStatusPillCertifiedText
                                                          : styles.darkCertStatusPillRestartText),
                                            ]}
                                        >
                                            {selectedDay.certificationStatus ===
                                            'active'
                                                ? 'LIVE'
                                                : selectedDay.certificationStatus ===
                                                    'certified'
                                                  ? 'LOCKED'
                                                  : 'REST'}
                                        </Text>
                                    </View>
                                </View>

                                <Text
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                    style={[
                                        styles.certAuditSub,
                                        selectedDay.certificationStatus ===
                                        'active'
                                            ? styles.certAuditActiveSub
                                            : selectedDay.certificationStatus ===
                                                'certified'
                                              ? styles.certAuditCertifiedSub
                                              : styles.certAuditRestartSub,
                                        isDarkHud &&
                                            (selectedDay.certificationStatus ===
                                            'active'
                                                ? styles.darkCertAuditActiveSub
                                                : selectedDay.certificationStatus ===
                                                    'certified'
                                                  ? styles.darkCertAuditCertifiedSub
                                                  : styles.darkCertAuditRestartSub),
                                    ]}
                                >
                                    {selectedDay.certifiedByText}
                                </Text>
                            </View>
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
                    <View style={styles.logSectionHeaderRow}>
                        <View style={{ flex: 1 }}>
                            <Text
                                accessibilityRole="header"
                                style={[
                                    styles.sectionTitle,
                                    isDarkHud && styles.darkSectionTitle,
                                ]}
                            >
                                {selectedDay.isToday
                                    ? "TODAY'S SHIFT ACTIVITY LOG"
                                    : `SHIFT ACTIVITY LOG — ${selectedDay.dayLabel.toUpperCase()}`}
                            </Text>
                            <Text
                                style={[
                                    styles.sectionHelper,
                                    isDarkHud && styles.darkSectionHelper,
                                ]}
                            >
                                Timestamped change-of-duty event logs with GPS
                                location audits.
                            </Text>
                        </View>
                        <View
                            style={[
                                styles.logCountBadge,
                                isDarkHud && styles.darkLogCountBadge,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.logCountBadgeText,
                                    isDarkHud && styles.darkLogCountBadgeText,
                                ]}
                            >
                                {selectedDay.events.length} EVENTS
                            </Text>
                        </View>
                    </View>

                    <View style={styles.logEventsList}>
                        {selectedDay.events.length === 0 ? (
                            <View
                                style={[
                                    styles.emptyLogCard,
                                    isDarkHud && styles.darkEmptyLogCard,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.emptyLogTitle,
                                        isDarkHud && styles.darkEmptyLogTitle,
                                    ]}
                                >
                                    34-Hour Restart / Full Off-Duty Rest Period
                                </Text>
                                <Text
                                    style={[
                                        styles.emptyLogSub,
                                        isDarkHud && styles.darkEmptyLogSub,
                                    ]}
                                >
                                    No duty status transitions recorded.
                                    Consecutive 24-hour off-duty rest period
                                    logged.
                                </Text>
                            </View>
                        ) : (
                            selectedDay.events.map((evt) => (
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
                                                        : evt.status ===
                                                            'driving'
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
                                                isDarkHud &&
                                                    styles.darkLogDuration,
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
                                        {evt.location}
                                    </Text>
                                </View>
                            ))
                        )}
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
        fontSize: 11.5,
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
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E8F0',
        borderRadius: 14,
        borderWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        minHeight: 64,
        paddingHorizontal: 16,
        paddingVertical: 12,
        elevation: 1,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 2,
    },
    darkDutyOptionCard: {
        backgroundColor: '#1E293B',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        shadowColor: '#000000',
        shadowOpacity: 0.2,
    },
    dutyOptionCardSelected: {
        backgroundColor: '#FFFBEB',
        borderColor: '#D97706',
        borderWidth: 2,
    },
    darkDutyOptionCardSelected: {
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
        borderColor: '#F59E0B',
        borderWidth: 2,
    },
    dutyOptionCardPressed: {
        opacity: 0.88,
        transform: [{ scale: 0.99 }],
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
        borderRadius: 8,
        borderWidth: 1.5,
        height: 30,
        justifyContent: 'center',
        width: 42,
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
        fontSize: 14,
        fontWeight: '700',
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
        fontSize: 12,
        marginTop: 2,
    },
    darkOptionSubtitle: {
        color: '#94A3B8',
    },
    radioButton: {
        alignItems: 'center',
        borderColor: '#CBD5E1',
        borderRadius: 11,
        borderWidth: 2,
        height: 22,
        justifyContent: 'center',
        width: 22,
    },
    darkRadioButton: {
        borderColor: '#475569',
    },
    radioButtonSelected: {
        borderColor: '#D97706',
    },
    darkRadioButtonSelected: {
        borderColor: '#F59E0B',
    },
    radioButtonInner: {
        backgroundColor: '#D97706',
        borderRadius: 5.5,
        height: 11,
        width: 11,
    },
    darkRadioButtonInner: {
        backgroundColor: '#F59E0B',
    },
    standbyChipsGrid: {
        gap: 8,
    },
    standbyChip: {
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E8F0',
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        minHeight: 48,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    darkStandbyChip: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
    },
    standbyChipSelected: {
        backgroundColor: '#FFFBEB',
        borderColor: '#D97706',
        borderWidth: 1.5,
    },
    darkStandbyChipSelected: {
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
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
    timelineHeaderRow: {
        alignItems: 'flex-start',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    cycleBadge: {
        backgroundColor: '#F1F5F9',
        borderColor: '#CBD5E1',
        borderRadius: 9999,
        borderWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    darkCycleBadge: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
    },
    cycleBadgeText: {
        color: '#475569',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    darkCycleBadgeText: {
        color: '#94A3B8',
    },
    unifiedDateNavContainer: {
        backgroundColor: '#F8FAFC',
        borderColor: '#E2E8F0',
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 12,
        padding: 10,
    },
    darkUnifiedDateNavContainer: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
    },
    stepperHeaderRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    stepperNavBtn: {
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E8F0',
        borderRadius: 8,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 3,
        justifyContent: 'center',
        minHeight: 36,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    darkStepperNavBtn: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    stepperNavBtnDisabled: {
        opacity: 0.35,
    },
    stepperNavBtnIcon: {
        color: '#D97706',
        fontSize: 16,
        fontWeight: '800',
        lineHeight: 18,
    },
    darkStepperNavBtnIcon: {
        color: '#F59E0B',
    },
    stepperNavBtnIconDisabled: {
        color: '#94A3B8',
    },
    stepperNavBtnText: {
        color: '#D97706',
        fontSize: 11.5,
        fontWeight: '700',
    },
    darkStepperNavBtnText: {
        color: '#F59E0B',
    },
    stepperNavBtnTextDisabled: {
        color: '#94A3B8',
    },
    stepperCenterPill: {
        alignItems: 'center',
        flex: 1,
        paddingHorizontal: 6,
    },
    darkStepperCenterPill: {},
    stepperDayLabel: {
        color: '#0F172A',
        fontSize: 13,
        fontWeight: '800',
        textAlign: 'center',
    },
    darkStepperDayLabel: {
        color: '#F8FAFC',
    },
    stepperDateSub: {
        color: '#64748B',
        fontSize: 10.5,
        fontWeight: '600',
        marginTop: 1,
        textAlign: 'center',
    },
    darkStepperDateSub: {
        color: '#94A3B8',
    },
    dayPillsScroll: {
        marginBottom: 2,
    },
    dayPillsScrollContent: {
        flexDirection: 'row',
        gap: 6,
        paddingVertical: 2,
    },
    dayPill: {
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E8F0',
        borderRadius: 20,
        borderWidth: 1,
        justifyContent: 'center',
        minHeight: 32,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    darkDayPill: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    dayPillSelected: {
        backgroundColor: '#0F172A',
        borderColor: '#0F172A',
    },
    darkDayPillSelected: {
        backgroundColor: '#F59E0B',
        borderColor: '#F59E0B',
    },
    dayPillText: {
        color: '#64748B',
        fontSize: 11,
        fontWeight: '700',
    },
    darkDayPillText: {
        color: '#94A3B8',
    },
    dayPillTextSelected: {
        color: '#FFFFFF',
        fontWeight: '800',
    },
    darkDayPillTextSelected: {
        color: '#090D16',
        fontWeight: '800',
    },
    historyMetricsGrid: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 12,
    },
    historyMetricCell: {
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderColor: '#E2E8F0',
        borderRadius: 10,
        borderWidth: 1,
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 4,
        paddingVertical: 10,
    },
    darkHistoryMetricCell: {
        backgroundColor: '#0F172A',
        borderColor: '#1E293B',
    },
    metricCellHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 3,
        marginBottom: 3,
    },
    metricIndicatorDot: {
        borderRadius: 2.5,
        height: 5,
        width: 5,
    },
    historyMetricLabel: {
        color: '#64748B',
        fontSize: 9.5,
        fontWeight: '800',
        letterSpacing: 0.2,
        textAlign: 'center',
    },
    darkHistoryMetricLabel: {
        color: '#94A3B8',
    },
    historyMetricVal: {
        fontSize: 13.5,
        fontWeight: '900',
        letterSpacing: -0.2,
        textAlign: 'center',
    },
    metricValBlue: {
        color: '#2563EB',
    },
    metricValAmber: {
        color: '#D97706',
    },
    metricValSlate: {
        color: '#475569',
    },
    darkMetricValSlate: {
        color: '#94A3B8',
    },
    metricValEmerald: {
        color: '#059669',
    },
    certAuditBadge: {
        borderRadius: 12,
        borderWidth: 1,
        marginTop: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    darkCertAuditBadge: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
    },
    certAuditActive: {
        backgroundColor: '#FFFBEB',
        borderColor: '#FDE68A',
    },
    darkCertAuditActive: {
        backgroundColor: 'rgba(245, 158, 11, 0.08)',
        borderColor: 'rgba(245, 158, 11, 0.28)',
    },
    certAuditCertified: {
        backgroundColor: '#ECFDF5',
        borderColor: '#A7F3D0',
    },
    darkCertAuditCertified: {
        backgroundColor: 'rgba(16, 185, 129, 0.08)',
        borderColor: 'rgba(16, 185, 129, 0.25)',
    },
    certAuditRestart: {
        backgroundColor: '#F8FAFC',
        borderColor: '#E2E8F0',
    },
    darkCertAuditRestart: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
    },
    certAuditCardInner: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 10,
    },
    certAuditIconCircle: {
        alignItems: 'center',
        borderRadius: 16,
        borderWidth: 1,
        height: 32,
        justifyContent: 'center',
        width: 32,
    },
    certAuditIconCircleActive: {
        backgroundColor: '#FEF3C7',
        borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    darkCertAuditIconCircleActive: {
        backgroundColor: 'rgba(245, 158, 11, 0.18)',
        borderColor: 'rgba(245, 158, 11, 0.35)',
    },
    certAuditIconCircleCertified: {
        backgroundColor: '#D1FAE5',
        borderColor: 'rgba(16, 185, 129, 0.3)',
    },
    darkCertAuditIconCircleCertified: {
        backgroundColor: 'rgba(16, 185, 129, 0.18)',
        borderColor: 'rgba(16, 185, 129, 0.35)',
    },
    certAuditIconCircleRestart: {
        backgroundColor: '#F1F5F9',
        borderColor: 'rgba(148, 163, 184, 0.3)',
    },
    darkCertAuditIconCircleRestart: {
        backgroundColor: 'rgba(148, 163, 184, 0.15)',
        borderColor: 'rgba(148, 163, 184, 0.3)',
    },
    certAuditTextContainer: {
        flex: 1,
    },
    certAuditHeaderRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 2,
    },
    certAuditTitle: {
        flex: 1,
        fontSize: 12.5,
        fontWeight: '800',
        marginRight: 8,
    },
    certAuditActiveTitle: {
        color: '#92400E',
    },
    darkCertAuditActiveTitle: {
        color: '#FBBF24',
    },
    certAuditCertifiedTitle: {
        color: '#065F46',
    },
    darkCertAuditCertifiedTitle: {
        color: '#34D399',
    },
    certAuditRestartTitle: {
        color: '#334155',
    },
    darkCertAuditRestartTitle: {
        color: '#CBD5E1',
    },
    certStatusPill: {
        borderRadius: 9999,
        borderWidth: 1,
        paddingHorizontal: 6,
        paddingVertical: 1.5,
    },
    certStatusPillActive: {
        backgroundColor: '#FEF3C7',
        borderColor: '#F59E0B',
    },
    darkCertStatusPillActive: {
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        borderColor: '#F59E0B',
    },
    certStatusPillCertified: {
        backgroundColor: '#D1FAE5',
        borderColor: '#10B981',
    },
    darkCertStatusPillCertified: {
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        borderColor: '#10B981',
    },
    certStatusPillRestart: {
        backgroundColor: '#F1F5F9',
        borderColor: '#94A3B8',
    },
    darkCertStatusPillRestart: {
        backgroundColor: 'rgba(148, 163, 184, 0.15)',
        borderColor: '#64748B',
    },
    certStatusPillText: {
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    certStatusPillActiveText: {
        color: '#B45309',
    },
    darkCertStatusPillActiveText: {
        color: '#FBBF24',
    },
    certStatusPillCertifiedText: {
        color: '#047857',
    },
    darkCertStatusPillCertifiedText: {
        color: '#34D399',
    },
    certStatusPillRestartText: {
        color: '#475569',
    },
    darkCertStatusPillRestartText: {
        color: '#94A3B8',
    },
    certAuditSub: {
        fontSize: 11.5,
        fontWeight: '600',
        lineHeight: 16,
    },
    certAuditActiveSub: {
        color: '#78350F',
    },
    darkCertAuditActiveSub: {
        color: '#FDE68A',
    },
    certAuditCertifiedSub: {
        color: '#047857',
    },
    darkCertAuditCertifiedSub: {
        color: '#A7F3D0',
    },
    certAuditRestartSub: {
        color: '#64748B',
    },
    darkCertAuditRestartSub: {
        color: '#94A3B8',
    },
    logSectionHeaderRow: {
        alignItems: 'flex-start',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    logCountBadge: {
        backgroundColor: '#F1F5F9',
        borderColor: '#CBD5E1',
        borderRadius: 9999,
        borderWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    darkLogCountBadge: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
    },
    logCountBadgeText: {
        color: '#475569',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    darkLogCountBadgeText: {
        color: '#94A3B8',
    },
    emptyLogCard: {
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderColor: '#E2E8F0',
        borderRadius: 10,
        borderWidth: 1,
        padding: 16,
    },
    darkEmptyLogCard: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
    },
    emptyLogTitle: {
        color: '#059669',
        fontSize: 13,
        fontWeight: '800',
        marginBottom: 4,
    },
    darkEmptyLogTitle: {
        color: '#34D399',
    },
    emptyLogSub: {
        color: '#64748B',
        fontSize: 11.5,
        textAlign: 'center',
    },
    darkEmptyLogSub: {
        color: '#94A3B8',
    },
    graphContainer: {
        backgroundColor: '#F8FAFC',
        borderColor: '#E2E8F0',
        borderRadius: 12,
        borderWidth: 1,
        padding: 12,
    },
    darkGraphContainer: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
    },
    graphLegendRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        justifyContent: 'center',
        marginBottom: 10,
    },
    legendItem: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 4,
    },
    legendDot: {
        borderRadius: 3,
        height: 6,
        width: 6,
    },
    legendText: {
        color: '#64748B',
        fontSize: 10.5,
        fontWeight: '700',
    },
    darkLegendText: {
        color: '#94A3B8',
    },
    graphRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
        marginVertical: 4,
    },
    graphRowLabelGroup: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 4,
        width: 38,
    },
    graphRowDot: {
        borderRadius: 2.5,
        height: 5,
        width: 5,
    },
    graphRowHeader: {
        color: '#475569',
        fontSize: 10,
        fontWeight: '900',
    },
    darkGraphRowHeader: {
        color: '#94A3B8',
    },
    graphRowTrack: {
        backgroundColor: '#E2E8F0',
        borderRadius: 6,
        flex: 1,
        height: 16,
        overflow: 'hidden',
        position: 'relative',
    },
    darkGraphRowTrack: {
        backgroundColor: '#1E293B',
    },
    graphSegment: {
        borderRadius: 4,
        height: '100%',
        position: 'absolute',
    },
    graphTimeScale: {
        borderTopColor: '#E2E8F0',
        borderTopWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
        paddingLeft: 46,
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
    actionButtonPressed: {
        opacity: 0.88,
        transform: [{ scale: 0.97 }],
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
        opacity: 0.82,
        transform: [{ scale: 0.96 }],
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
    endShiftCard: {
        borderColor: '#FECACA',
        borderWidth: 1.5,
    },
    darkEndShiftCard: {
        borderColor: 'rgba(239, 68, 68, 0.4)',
    },
    endShiftHeaderRow: {
        flexDirection: 'row',
        gap: 12,
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    endShiftIconBadge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FEE2E2',
        alignItems: 'center',
        justifyContent: 'center',
    },
    darkEndShiftIconBadge: {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
    },
    endShiftHeaderCopy: {
        flex: 1,
    },
    linkedAssetPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        backgroundColor: '#FEF3C7',
        borderColor: '#FDE68A',
        borderWidth: 1,
        borderRadius: 9999,
        paddingHorizontal: 10,
        paddingVertical: 4,
        marginBottom: 14,
    },
    darkLinkedAssetPill: {
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    linkedAssetPillText: {
        color: '#92400E',
        fontSize: 12,
        fontWeight: '700',
    },
    darkLinkedAssetPillText: {
        color: '#FCD34D',
    },
    endShiftBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#DC2626',
        borderRadius: 12,
        paddingVertical: 14,
    },
    darkEndShiftBtn: {
        backgroundColor: '#B91C1C',
    },
    endShiftBtnText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    shiftCompletedNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#ECFDF5',
        borderColor: '#A7F3D0',
        borderWidth: 1,
        borderRadius: 10,
        padding: 12,
    },
    darkShiftCompletedNotice: {
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        borderColor: 'rgba(16, 185, 129, 0.3)',
    },
    shiftCompletedNoticeText: {
        color: '#065F46',
        fontSize: 13,
        fontWeight: '700',
    },
    darkShiftCompletedNoticeText: {
        color: '#34D399',
    },
});
