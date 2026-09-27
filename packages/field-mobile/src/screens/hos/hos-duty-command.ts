import type { DutyStatus, OutboxCommand, ShiftStatus } from '../../types/index';

export type DutyCommandKind = 'start' | 'change' | 'certify';

export interface DutyCommandPlan {
    kind: DutyCommandKind | null;
    /** When the event happened, on the server's clock. */
    occurredAt: string;
}

const HOS_COMMAND_TYPES = new Set([
    'start_hos_shift',
    'change_hos_duty_status',
    'certify_hos_shift',
]);

/** HoS commands still waiting to reach the server, oldest first. */
export function queuedHosCommands(commands: OutboxCommand[]): OutboxCommand[] {
    return commands
        .filter(
            (command) =>
                HOS_COMMAND_TYPES.has(command.type) &&
                (command.state === 'queued' || command.state === 'syncing'),
        )
        .sort(
            (left, right) =>
                left.createdAt.localeCompare(right.createdAt) ||
                left.id.localeCompare(right.id),
        );
}

/** Server time minus phone time, from a `server_time` the server just sent. */
export function serverClockOffsetMs(
    serverTime: string | null | undefined,
    phoneNowMs: number,
): number {
    const server = serverTime ? Date.parse(serverTime) : Number.NaN;

    return Number.isFinite(server) ? server - phoneNowMs : 0;
}

/**
 * Which HoS command a duty change needs, and its event time. The time is on
 * the server's clock so a phone running fast isn't rejected, and it stays
 * after any event still queued so the server applies them in order.
 */
export function planDutyCommand({
    dutyStatus,
    shift,
    pending,
    phoneNowMs,
    clockOffsetMs,
}: {
    dutyStatus: DutyStatus;
    shift: { status: ShiftStatus; dutyStatus?: DutyStatus | null };
    pending: OutboxCommand[];
    phoneNowMs: number;
    clockOffsetMs: number;
}): DutyCommandPlan {
    const latestPendingAt = pending.reduce((latest, command) => {
        const raw = command.payload.occurred_at;
        const at = typeof raw === 'string' ? Date.parse(raw) : Number.NaN;

        return Number.isFinite(at) ? Math.max(latest, at) : latest;
    }, 0);
    const occurredAt = new Date(
        Math.max(phoneNowMs + clockOffsetMs, latestPendingAt + 1),
    ).toISOString();

    const latest = pending[pending.length - 1];
    const serverOffShift =
        shift.status === 'off_shift' || shift.dutyStatus === 'off_duty';
    const localStatus: DutyStatus = latest
        ? latest.type === 'certify_hos_shift'
            ? 'off_duty'
            : ((latest.payload.duty_status as DutyStatus | undefined) ??
              'operating')
        : serverOffShift
          ? 'off_duty'
          : (shift.dutyStatus ?? 'off_duty');

    if (dutyStatus === 'off_duty') {
        // Already off duty with nothing queued: there is no shift to end.
        return {
            kind: localStatus === 'off_duty' ? null : 'certify',
            occurredAt,
        };
    }

    const hasPendingStart = pending.some(
        (command) => command.type === 'start_hos_shift',
    );

    return {
        kind:
            localStatus === 'off_duty' && !hasPendingStart ? 'start' : 'change',
        occurredAt,
    };
}
