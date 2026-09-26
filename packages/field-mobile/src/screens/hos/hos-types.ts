import type { DimensionValue } from 'react-native';
import type { IconName } from '../../components/common/Icon';
import type { DutyStatus } from '../../types/index';

export interface DutyStatusOptionConfig {
    status: DutyStatus;
    badge: string;
    title: string;
    subtitle: string;
    iconName: IconName;
    accentColor: string;
}

export interface ShiftLogEvent {
    id: string;
    status: DutyStatus;
    startTime: string;
    endTime: string;
    durationFormatted: string;
    details: string;
    location: string;
    occurrenceTime?: string | null;
    acceptedTime?: string | null;
    equipmentLabel?: string | null;
    locationStatus?: 'fresh' | 'last_known' | 'unavailable';
    syncStatus?: 'accepted' | 'pending' | 'rejected';
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
