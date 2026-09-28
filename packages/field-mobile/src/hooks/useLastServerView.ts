import { useCallback, useEffect, useRef, useState } from 'react';
import { lastJobsStore, lastShiftStore } from '../storage/lastServerViewStore';
import type {
    LastJobsStore,
    LastShiftStore,
} from '../storage/lastServerViewStore';
import type { CurrentHosShiftResponse, DispatchJob } from '../types/index';

export interface LastServerViewStores {
    jobs: LastJobsStore;
    shift: LastShiftStore;
}

export interface LastServerViewHandlers {
    restoreJobs: (jobs: DispatchJob[]) => void;
    restoreShift: (shift: CurrentHosShiftResponse) => void;
}

export interface LastServerView {
    /**
     * When the view on screen was saved, while it is a restored one; null
     * once the server has answered in this session.
     */
    restoredFrom: string | null;
    rememberJobs: (jobs: DispatchJob[]) => void;
    rememberShift: (shift: CurrentHosShiftResponse) => void;
    forget: () => void;
}

const defaultStores: LastServerViewStores = {
    jobs: lastJobsStore,
    shift: lastShiftStore,
};

/**
 * Saves each jobs and shift answer from the server, and on start shows the
 * saved one until the server answers again. A restart in a dead zone then
 * shows the operator's real unit, jobs and duty, marked as last sent.
 */
export function useLastServerView(
    actorId: number | null | undefined,
    handlers: LastServerViewHandlers,
    stores: LastServerViewStores = defaultStores,
): LastServerView {
    const [restoredFrom, setRestoredFrom] = useState<string | null>(null);
    // Live answers seen for this operator; a late restore never replaces one.
    const live = useRef({ actorId: 0, jobs: false, shift: false });
    const handlersRef = useRef(handlers);

    useEffect(() => {
        handlersRef.current = handlers;
    }, [handlers]);

    useEffect(() => {
        if (!actorId) {
            return;
        }

        let cancelled = false;
        live.current = { actorId, jobs: false, shift: false };
        const note = (savedAt: string) =>
            setRestoredFrom((current) =>
                current && current < savedAt ? current : savedAt,
            );

        void stores.jobs
            .read(actorId)
            .then((saved) => {
                if (!cancelled && saved && !live.current.jobs) {
                    handlersRef.current.restoreJobs(saved.value);
                    note(saved.savedAt);
                }
            })
            .catch(() => undefined);
        void stores.shift
            .read(actorId)
            .then((saved) => {
                if (!cancelled && saved && !live.current.shift) {
                    handlersRef.current.restoreShift(saved.value);
                    note(saved.savedAt);
                }
            })
            .catch(() => undefined);

        return () => {
            cancelled = true;
            setRestoredFrom(null);
        };
    }, [actorId, stores]);

    // Marks a live answer and saves it; the restored note goes away.
    const markLive = useCallback(
        (kind: 'jobs' | 'shift'): number | null => {
            if (!actorId) {
                return null;
            }

            live.current = { ...live.current, actorId, [kind]: true };
            setRestoredFrom(null);

            return actorId;
        },
        [actorId],
    );

    const rememberJobs = useCallback(
        (jobs: DispatchJob[]) => {
            const id = markLive('jobs');

            if (id !== null) {
                stores.jobs
                    .write(id, {
                        savedAt: new Date().toISOString(),
                        value: jobs,
                    })
                    .catch(() => undefined);
            }
        },
        [markLive, stores],
    );
    const rememberShift = useCallback(
        (shift: CurrentHosShiftResponse) => {
            const id = markLive('shift');

            if (id !== null) {
                stores.shift
                    .write(id, {
                        savedAt: new Date().toISOString(),
                        value: shift,
                    })
                    .catch(() => undefined);
            }
        },
        [markLive, stores],
    );

    const forget = useCallback(() => {
        if (!actorId) {
            return;
        }

        setRestoredFrom(null);
        stores.jobs.remove(actorId).catch(() => undefined);
        stores.shift.remove(actorId).catch(() => undefined);
    }, [actorId, stores]);

    return { restoredFrom, rememberJobs, rememberShift, forget };
}
