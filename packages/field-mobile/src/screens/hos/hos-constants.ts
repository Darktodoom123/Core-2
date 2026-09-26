import type { StandbyReason } from '../../types/index';
import type { DutyStatusOptionConfig, TimelineDayHistory } from './hos-types';

export const DUTY_STATUS_OPTIONS: DutyStatusOptionConfig[] = [
    {
        status: 'operating',
        badge: 'OPR',
        title: 'On Duty — Crane / Machine Operating',
        subtitle: 'Active site lifting, rigging, crane operations, excavation',
        iconName: 'crane',
        accentColor: '#FFBF00',
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
        accentColor: '#FFBF00',
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

export const STANDBY_REASONS: Array<{ reason: StandbyReason; label: string }> =
    [
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

export const EMPTY_TIMELINE_DAY: TimelineDayHistory = {
    id: 'empty',
    dayLabel: 'No accepted history',
    dateFormatted: 'No server-accepted duty history is available',
    shortDate: 'No history',
    isToday: true,
    driveHoursFormatted: '0h 00m',
    onDutyHoursFormatted: '0h 00m',
    offDutyHoursFormatted: '0h 00m',
    totalShiftFormatted: '0h 00m',
    certificationStatus: 'restart',
    certifiedByText: 'Accepted duty events will appear after synchronization',
    segments: { off: [], brk: [], drv: [], on: [] },
    events: [],
};

export function formatAuditTimestamp(
    raw: string | null | undefined,
): string | null {
    if (!raw) {
        return null;
    }

    const date = new Date(raw);

    if (Number.isNaN(date.getTime())) {
        return raw;
    }

    return date.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export const formatHoursMinutes = (hoursFloat: number | null): string => {
    if (hoursFloat === null || !Number.isFinite(hoursFloat)) {
        return 'Unavailable';
    }

    const totalMinutes = Math.round(hoursFloat * 60);
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    return `${hrs}h ${mins.toString().padStart(2, '0')}m`;
};
