import { useMemo } from 'react';
import type { DutyStatus, ShiftInfo } from '../types/index';

export interface TimelineEvent {
    id?: string;
    status?: DutyStatus | string;
    occurredAt?: string;
    occurrenceTime?: string | null;
    startTime?: string;
}

export interface TimelineDayHistory {
    id?: string;
    dayLabel?: string;
    dateFormatted?: string;
    shortDate?: string;
    date?: string;
    events?: any[];
}

export interface UseHosComplianceOptions {
    shiftInfo?: ShiftInfo | null;
    timelineHistory?: TimelineDayHistory[] | null;
    nowMs?: number;
}

export interface DoleContinuousBreakPrompt {
    title: string;
    subtitle: string;
    message: string;
    severity: 'warning' | 'critical';
    actionLabel: string;
    regulationRef: string;
}

export interface HosComplianceResult {
    // 4.5h Continuous Driving / Operating Rest Compliance (DOLE D.O. 13 / D.O. 118-12)
    continuousOperatingMinutes: number;
    continuousOperatingHours: number;
    continuousRemainingMinutes: number;
    continuousCounterLabel: string;
    isContinuousRestWarning: boolean;
    isContinuousRestRequired: boolean;
    breakSuggestion: DoleContinuousBreakPrompt | null;

    // 10.0h Total Daily Shift Limit Compliance (DOLE OSHC Cap)
    hoursElapsed: number | null;
    limitCounterHours: number | null;
    limitCounterLabel: string;
    elapsedClock: string;
    isDoleWarning: boolean;
    isDoleCapExceeded: boolean;
    fatigueStatus: string | null;
}

const DOLE_CONTINUOUS_CAP_MINUTES = 270; // 4.5 hours
const DOLE_CONTINUOUS_WARN_MINUTES = 240; // 4.0 hours

export function calculateContinuousOperatingMinutes(
    shiftInfo?: ShiftInfo | null,
    timelineHistory?: TimelineDayHistory[] | null,
    nowMs?: number,
): number {
    if (!shiftInfo) {
        return 0;
    }

    const currentDuty = shiftInfo.dutyStatus;
    const isActivelyOperating =
        currentDuty === 'operating' || currentDuty === 'driving';

    // If operator is on break, standby, or off duty, continuous operating is broken
    if (!isActivelyOperating) {
        return 0;
    }

    // 1. Explicit continuous minutes passed in shiftInfo
    if (
        shiftInfo.continuousOperatingMinutes !== null &&
        shiftInfo.continuousOperatingMinutes !== undefined
    ) {
        return Math.max(0, shiftInfo.continuousOperatingMinutes);
    }

    const currentTimeMs = nowMs ?? Date.now();

    // 2. Computed from timeline events if available
    if (timelineHistory && timelineHistory.length > 0) {
        const allEvents = timelineHistory
            .flatMap((day) => (day.events as TimelineEvent[]) || [])
            .filter((ev) => Boolean(ev));

        if (allEvents.length > 0) {
            const parseTime = (ev: TimelineEvent): number => {
                const raw = ev.occurredAt ?? ev.occurrenceTime ?? ev.startTime;

                if (!raw) {
return NaN;
}

                const parsed = Date.parse(raw);

                if (!Number.isNaN(parsed)) {
return parsed;
}

                const match = raw.match(
                    /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i,
                );

                if (match) {
                    let hours = parseInt(match[1], 10);
                    const minutes = parseInt(match[2], 10);
                    const meridiem = match[4]?.toUpperCase();

                    if (meridiem === 'PM' && hours < 12) {
hours += 12;
}

                    if (meridiem === 'AM' && hours === 12) {
hours = 0;
}

                    const d = new Date(currentTimeMs);
                    d.setHours(hours, minutes, 0, 0);

                    return d.getTime();
                }

                return NaN;
            };

            const parseDuration = (ev: TimelineEvent): number => {
                const durStr = (ev as any).durationFormatted;

                if (typeof durStr === 'string') {
                    let mins = 0;
                    const hMatch = durStr.match(/(\d+(?:\.\d+)?)\s*h/i);
                    const mMatch = durStr.match(/(\d+)\s*m/i);

                    if (hMatch) {
mins += parseFloat(hMatch[1]) * 60;
}

                    if (mMatch) {
mins += parseInt(mMatch[1], 10);
}

                    if (mins > 0) {
return mins;
}
                }

                return 0;
            };

            // Sort events descending (latest first)
            const sortedEvents = [...allEvents].sort((a, b) => {
                const timeA = parseTime(a);
                const timeB = parseTime(b);

                return (
                    (Number.isNaN(timeB) ? 0 : timeB) -
                    (Number.isNaN(timeA) ? 0 : timeA)
                );
            });

            let continuousMinutes = 0;
            let currentWindowEnd = currentTimeMs;

            for (const event of sortedEvents) {
                const isOpOrDrv =
                    event.status === 'operating' || event.status === 'driving';

                if (!isOpOrDrv) {
                    // Rest/standby break encountered — unbroken operating chain ends!
                    break;
                }

                const eventTimeMs = parseTime(event);
                const durMins = parseDuration(event);

                if (
                    !Number.isNaN(eventTimeMs) &&
                    eventTimeMs <= currentWindowEnd
                ) {
                    continuousMinutes += Math.max(
                        0,
                        Math.floor((currentWindowEnd - eventTimeMs) / 60000),
                    );
                    currentWindowEnd = eventTimeMs;
                } else if (durMins > 0) {
                    continuousMinutes += durMins;
                }
            }

            if (continuousMinutes > 0) {
                return continuousMinutes;
            }
        }
    }

    // 3. Fallback when no timeline history: check if any breaks were taken in this shift
    const hasBreaks =
        (shiftInfo.breakCount ?? 0) > 0 || (shiftInfo.breakMinutes ?? 0) > 0;

    if (!hasBreaks) {
        if (
            shiftInfo.limitCounterMinutes !== null &&
            shiftInfo.limitCounterMinutes !== undefined
        ) {
            return Math.max(0, shiftInfo.limitCounterMinutes);
        }

        const combinedMinutes =
            (shiftInfo.operatingMinutes ?? 0) + (shiftInfo.drivingMinutes ?? 0);

        if (combinedMinutes > 0) {
            return Math.max(0, combinedMinutes);
        }

        if (
            shiftInfo.hoursElapsed !== null &&
            shiftInfo.hoursElapsed !== undefined
        ) {
            return Math.max(0, Math.round(shiftInfo.hoursElapsed * 60));
        }
    }

    // 4. If breaks have occurred, compute unbroken duration since current duty started
    if (shiftInfo.currentDutyStartedAt) {
        const startedTimeMs = Date.parse(shiftInfo.currentDutyStartedAt);

        if (!Number.isNaN(startedTimeMs) && startedTimeMs <= currentTimeMs) {
            const minutesSinceStart = Math.floor(
                (currentTimeMs - startedTimeMs) / 60000,
            );

            return Math.max(0, minutesSinceStart);
        }
    }

    return 0;
}

export function useHosCompliance(
    shiftInfo?: ShiftInfo | null,
    options: Omit<UseHosComplianceOptions, 'shiftInfo'> = {},
): HosComplianceResult {
    return useMemo(() => {
        const safeShift = shiftInfo ?? null;

        // 1. 4.5h Continuous Operation Metrics
        const continuousMinutes = calculateContinuousOperatingMinutes(
            safeShift,
            options.timelineHistory,
            options.nowMs,
        );
        const continuousHours = continuousMinutes / 60;
        const continuousRemaining = Math.max(
            0,
            DOLE_CONTINUOUS_CAP_MINUTES - continuousMinutes,
        );

        const isContinuousRestRequired =
            continuousMinutes >= DOLE_CONTINUOUS_CAP_MINUTES;
        const isContinuousRestWarning =
            !isContinuousRestRequired &&
            continuousMinutes >= DOLE_CONTINUOUS_WARN_MINUTES;

        const continuousCounterLabel = `${continuousHours.toFixed(1)}h continuous`;

        let breakSuggestion: DoleContinuousBreakPrompt | null = null;

        if (isContinuousRestRequired) {
            breakSuggestion = {
                title: 'DOLE Mandatory Rest Break Required',
                subtitle: '4.5 Hours Continuous Operation Limit Reached',
                message:
                    'Under Philippine DOLE-OSHC regulations (D.O. 13 s. 1998 / D.O. 118-12), operators must not exceed 4.5 continuous unbroken hours of driving or equipment operation. A mandatory rest or standby break is required.',
                severity: 'critical',
                actionLabel: 'Log Standby / Take Break',
                regulationRef: 'DOLE D.O. 13 s. 1998 / D.O. 118-12 Section 8',
            };
        } else if (isContinuousRestWarning) {
            breakSuggestion = {
                title: 'Approaching 4.5h Continuous Operation',
                subtitle: `${continuousRemaining} min remaining before mandatory rest`,
                message:
                    'Operator is approaching the 4.5 continuous operating limit. Prepare to transition to standby or scheduled rest.',
                severity: 'warning',
                actionLabel: 'Plan Rest Break',
                regulationRef: 'DOLE D.O. 13 s. 1998 / D.O. 118-12 Section 8',
            };
        }

        // 2. 10.0h Total Daily Shift Limit Compliance
        const hoursElapsed = safeShift?.hoursElapsed ?? null;
        const limitCounterHours =
            safeShift?.limitCounterMinutes !== null &&
            safeShift?.limitCounterMinutes !== undefined
                ? safeShift.limitCounterMinutes / 60
                : null;

        const isDoleWarning =
            safeShift?.doleWarning ??
            (limitCounterHours !== null && limitCounterHours >= 9.0);
        const isDoleCapExceeded =
            (limitCounterHours !== null && limitCounterHours >= 10.0) ||
            safeShift?.fatigueStatus === 'critical' ||
            safeShift?.fatigueStatus === 'violation';

        const elapsedClock =
            hoursElapsed === null
                ? 'Unavailable'
                : `${Math.floor(hoursElapsed).toString().padStart(2, '0')}:${Math.round(
                      (hoursElapsed % 1) * 60,
                  )
                      .toString()
                      .padStart(2, '0')}`;

        const limitCounterLabel =
            limitCounterHours === null
                ? 'Limit counter unavailable'
                : `${limitCounterHours.toFixed(1)}h operating + driving`;

        return {
            continuousOperatingMinutes: continuousMinutes,
            continuousOperatingHours: continuousHours,
            continuousRemainingMinutes: continuousRemaining,
            continuousCounterLabel,
            isContinuousRestWarning,
            isContinuousRestRequired,
            breakSuggestion,
            hoursElapsed,
            limitCounterHours,
            limitCounterLabel,
            elapsedClock,
            isDoleWarning,
            isDoleCapExceeded,
            fatigueStatus: safeShift?.fatigueStatus ?? null,
        };
    }, [shiftInfo, options.timelineHistory, options.nowMs]);
}
