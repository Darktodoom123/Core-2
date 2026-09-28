import type {
    CurrentHosShiftResponse,
    DutyStatus,
    ShiftInfo,
    ShiftStatus,
} from '../types/index';

export interface ShiftState {
    shiftInfo: ShiftInfo;
    /** ISO start of the server's active shift, or null when off shift. */
    startedAtIso: string | null;
}

const DUTY_STATUSES: Record<string, DutyStatus> = {
    operating: 'operating',
    driving: 'driving',
    standby: 'standby',
    on_break: 'on_break',
    off_duty: 'off_duty',
};

const shiftStatusFor = (dutyStatus: DutyStatus): ShiftStatus =>
    dutyStatus === 'off_duty'
        ? 'off_shift'
        : dutyStatus === 'on_break'
          ? 'on_break'
          : dutyStatus === 'standby'
            ? 'standby'
            : 'on_shift';

/**
 * The home and HoS shift state for the server's current-shift answer, live
 * or saved. Null when the answer carries no clocks.
 */
export function shiftStateFromServer(
    currentShift: CurrentHosShiftResponse | null | undefined,
): ShiftState | null {
    const clock = currentShift?.clocks;

    if (!clock) {
        return null;
    }

    if (!clock.shift_active) {
        return {
            startedAtIso: null,
            shiftInfo: {
                status: 'off_shift',
                dutyStatus: 'off_duty',
                startedAt: null,
                hoursElapsed: null,
                currentDutyStartedAt: null,
                lastAcceptedDutyAt: null,
                serverTime: clock.server_time ?? null,
                shiftElapsedMinutes: null,
                operatingMinutes: null,
                drivingMinutes: null,
                standbyMinutes: null,
                breakMinutes: null,
                limitCounterMinutes: null,
                limitCounterLabel: null,
            },
        };
    }

    const dutyStatus: DutyStatus =
        DUTY_STATUSES[clock.current_duty_status] ?? 'operating';

    return {
        startedAtIso: clock.started_at ?? null,
        shiftInfo: {
            status: shiftStatusFor(dutyStatus),
            dutyStatus,
            startedAt: clock.started_at
                ? new Date(clock.started_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                  })
                : null,
            hoursElapsed: clock.hours_elapsed ?? null,
            currentDutyStartedAt: clock.current_duty_started_at ?? null,
            lastAcceptedDutyAt: clock.last_accepted_duty_at ?? null,
            serverTime: clock.server_time ?? null,
            shiftElapsedMinutes: clock.shift_elapsed_minutes ?? null,
            operatingMinutes: clock.operating_minutes ?? null,
            drivingMinutes: clock.driving_minutes ?? null,
            standbyMinutes: clock.standby_minutes ?? null,
            breakMinutes: clock.break_minutes ?? null,
            limitCounterMinutes: clock.limit_counter_minutes ?? null,
            limitCounterLabel: clock.limit_counter_label ?? null,
            fatigueStatus: clock.fatigue_status ?? null,
            doleWarning: clock.dole_warning ?? false,
        },
    };
}
