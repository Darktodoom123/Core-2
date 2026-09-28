import type { CurrentHosShiftResponse, DispatchJob } from '../types/index';
import { SqliteActorJsonStore } from './actorJsonStore';
import type { ActorStore } from './actorJsonStore';

/**
 * The last answer the server gave, and when. Lets a restart in a dead zone
 * show what dispatch last sent instead of an empty, off-duty home.
 */
export interface SavedServerView<T> {
    savedAt: string;
    value: T;
}

export type LastJobsStore = ActorStore<SavedServerView<DispatchJob[]>>;
export type LastShiftStore = ActorStore<
    SavedServerView<CurrentHosShiftResponse>
>;

const DATABASE = 'core2-last-server-view.db';

function hasSavedAt(value: unknown): value is { savedAt: string } {
    return (
        !!value &&
        typeof value === 'object' &&
        'savedAt' in value &&
        typeof value.savedAt === 'string' &&
        Number.isFinite(Date.parse(value.savedAt))
    );
}

export function parseSavedJobs(
    value: unknown,
): SavedServerView<DispatchJob[]> | null {
    if (
        !hasSavedAt(value) ||
        !('value' in value) ||
        !Array.isArray(value.value)
    ) {
        return null;
    }

    const jobs = value.value.filter(
        (job): job is DispatchJob =>
            !!job && typeof job === 'object' && typeof job.id === 'number',
    );

    return { savedAt: value.savedAt, value: jobs };
}

export function parseSavedShift(
    value: unknown,
): SavedServerView<CurrentHosShiftResponse> | null {
    if (
        !hasSavedAt(value) ||
        !('value' in value) ||
        !value.value ||
        typeof value.value !== 'object' ||
        !('clocks' in value.value) ||
        !value.value.clocks ||
        typeof value.value.clocks !== 'object'
    ) {
        return null;
    }

    return {
        savedAt: value.savedAt,
        value: value.value as CurrentHosShiftResponse,
    };
}

export const lastJobsStore: LastJobsStore = new SqliteActorJsonStore({
    databaseName: DATABASE,
    table: 'last_jobs',
    column: 'jobs_json',
    parse: parseSavedJobs,
});

export const lastShiftStore: LastShiftStore = new SqliteActorJsonStore({
    databaseName: DATABASE,
    table: 'last_shift',
    column: 'shift_json',
    parse: parseSavedShift,
});
