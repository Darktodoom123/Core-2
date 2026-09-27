import type { DutyStatus, OutboxCommand } from '../../types/index';

const HOS_COMMAND_TYPES = new Set([
    'start_hos_shift',
    'change_hos_duty_status',
    'certify_hos_shift',
]);

const STATUS_LABELS: Record<DutyStatus, string> = {
    operating: 'Operating',
    driving: 'Driving',
    standby: 'Standby',
    on_break: 'Break',
    off_duty: 'Off duty',
};

export interface HosSyncItem {
    id: string;
    /** What the operator asked for, e.g. "Start shift · Operating". */
    what: string;
}

export interface HosSyncProblem extends HosSyncItem {
    /** Rejected: the server refused it. Stalled: it couldn't be sent. */
    kind: 'rejected' | 'stalled';
    reason: string | null;
}

export interface HosSyncSummary {
    /** The oldest failed duty change; everything after it waits for it. */
    problem: HosSyncProblem | null;
    /** Duty changes still to send, oldest first. */
    waiting: HosSyncItem[];
}

export function describeHosCommand(command: OutboxCommand): string {
    if (command.type === 'certify_hos_shift') {
        return 'Off duty · end shift';
    }

    const status = command.payload.duty_status as DutyStatus | undefined;
    const label = status ? STATUS_LABELS[status] : 'Duty change';

    return command.type === 'start_hos_shift'
        ? `Start shift · ${label}`
        : label;
}

/** The phone's unsent and failed duty changes, for the HoS sync banner. */
export function hosSyncSummary(
    commands: OutboxCommand[],
): HosSyncSummary | null {
    const hos = commands
        .filter((command) => HOS_COMMAND_TYPES.has(command.type))
        .sort(
            (left, right) =>
                left.createdAt.localeCompare(right.createdAt) ||
                left.id.localeCompare(right.id),
        );
    const failed = hos.find((command) => command.state === 'failed');
    const waiting = hos
        .filter(
            (command) =>
                command.state === 'queued' || command.state === 'syncing',
        )
        .map((command) => ({
            id: command.id,
            what: describeHosCommand(command),
        }));

    if (!failed && waiting.length === 0) {
        return null;
    }

    return {
        problem: failed
            ? {
                  id: failed.id,
                  what: describeHosCommand(failed),
                  // A retryable failure only ran out of attempts; the server
                  // never refused it.
                  kind: failed.error?.retryable ? 'stalled' : 'rejected',
                  reason: failed.error?.message?.trim() || null,
              }
            : null,
        waiting,
    };
}
