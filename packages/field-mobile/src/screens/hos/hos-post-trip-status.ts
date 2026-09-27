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
 * True when this unit's post-trip was done during the current shift: the
 * server already has it, or it's saved on this phone waiting to be sent.
 * Survives an app restart (outbox) and a phone switch (server history).
 */
export function postTripDoneThisShift({
    assetCode,
    shiftStartedAt,
    serverInspections,
    outboxCommands,
}: PostTripCheck): boolean {
    if (!assetCode || !shiftStartedAt) {
        return false;
    }

    const start = Date.parse(shiftStartedAt);

    if (!Number.isFinite(start)) {
        return false;
    }

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
