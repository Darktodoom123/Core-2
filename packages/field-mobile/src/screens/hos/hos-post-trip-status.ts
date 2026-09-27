import type { OutboxCommand, OutboxCommandState } from '../../types';

/** A DVIR record as the server's history returns it. */
export interface ServerDvirRecord {
    type?: unknown;
    asset_code?: unknown;
    completed_at?: unknown;
}

export interface PostTripCheck {
    assetCode: string | null | undefined;
    /** ISO time the server says this shift started. */
    shiftStartedAt: string | null | undefined;
    /** ISO time the unit was last linked; a re-link needs a new post-trip. */
    linkedAt?: string | null;
    serverInspections: readonly ServerDvirRecord[];
    outboxCommands: readonly OutboxCommand[];
}

// Still on this phone and going to be sent, or already accepted.
const KEPT_STATES: readonly OutboxCommandState[] = [
    'queued',
    'syncing',
    'failed',
    'completed',
];

function atOrAfter(value: unknown, start: number): boolean {
    if (typeof value !== 'string') {
        return false;
    }

    const time = Date.parse(value);

    return Number.isFinite(time) && time >= start;
}

/**
 * True when this unit's post-trip was done this shift, after the unit was
 * last linked: the server already has it, or it's saved on this phone
 * waiting to be sent. Survives an app restart (outbox) and a phone switch
 * (server history); a release and re-link asks for a new one.
 */
export function postTripDoneThisShift({
    assetCode,
    shiftStartedAt,
    linkedAt,
    serverInspections,
    outboxCommands,
}: PostTripCheck): boolean {
    if (!assetCode || !shiftStartedAt) {
        return false;
    }

    const shiftStart = Date.parse(shiftStartedAt);

    if (!Number.isFinite(shiftStart)) {
        return false;
    }

    const linkStart = linkedAt ? Date.parse(linkedAt) : Number.NaN;
    const start = Number.isFinite(linkStart)
        ? Math.max(shiftStart, linkStart)
        : shiftStart;

    const onServer = serverInspections.some(
        (record) =>
            record.type === 'post_trip' &&
            record.asset_code === assetCode &&
            atOrAfter(record.completed_at, start),
    );

    if (onServer) {
        return true;
    }

    return outboxCommands.some(
        (command) =>
            command.type === 'submit_dvir' &&
            KEPT_STATES.includes(command.state) &&
            command.payload.inspection_type === 'post_trip' &&
            command.payload.asset_code === assetCode &&
            atOrAfter(command.createdAt, start),
    );
}
