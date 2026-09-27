import { SqliteActorJsonStore } from './actorJsonStore';
import type { ActorStore } from './actorJsonStore';

/** The operator paused tracking on this unit, and when. */
export interface TrackingPause {
    assetCode: string;
    pausedAt: string;
}

export type TrackingPauseStore = ActorStore<TrackingPause>;

function parseTrackingPause(value: unknown): TrackingPause | null {
    if (
        !value ||
        typeof value !== 'object' ||
        !('assetCode' in value) ||
        typeof value.assetCode !== 'string' ||
        value.assetCode === '' ||
        !('pausedAt' in value) ||
        typeof value.pausedAt !== 'string' ||
        !Number.isFinite(Date.parse(value.pausedAt))
    ) {
        return null;
    }

    return { assetCode: value.assetCode, pausedAt: value.pausedAt };
}

export const trackingPauseStore: TrackingPauseStore = new SqliteActorJsonStore({
    databaseName: 'core2-tracking-pause.db',
    table: 'tracking_pauses',
    column: 'pause_json',
    parse: parseTrackingPause,
});
