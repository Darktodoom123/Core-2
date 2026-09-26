import { useCallback, useEffect, useState } from 'react';
import type { DispatchJobViewModel } from '@/types/workspace';

/** The dispatch desk endpoint pages at 25 jobs; four pages covers a busy day. */
export const TODAY_SCHEDULE_MAX_PAGES = 4;

interface DispatchDeskPage {
    jobs: DispatchJobViewModel[];
    total: number;
    last_page: number;
}

export type TodayDispatchesStatus = 'loading' | 'ready' | 'error' | 'forbidden';

export interface TodayDispatches {
    status: TodayDispatchesStatus;
    jobs: DispatchJobViewModel[];
    /** Server total for today's window, including undated preparation drafts. */
    total: number;
    truncated: boolean;
    refreshing: boolean;
    loadedAt: number | null;
    /** Set when the latest request failed; earlier data may still be shown. */
    error: string | null;
    retry: () => void;
}

interface TodayDispatchesState {
    status: TodayDispatchesStatus;
    jobs: DispatchJobViewModel[];
    total: number;
    truncated: boolean;
    refreshing: boolean;
    loadedAt: number | null;
    error: string | null;
}

class ScheduleAccessDenied extends Error {}

const SCHEDULE_ERROR =
    "Today's schedule could not be loaded. Other dashboard data is unaffected.";

function isDispatchDeskPage(value: unknown): value is DispatchDeskPage {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const page = value as Partial<DispatchDeskPage>;

    return (
        Array.isArray(page.jobs) &&
        Number.isInteger(page.total) &&
        Number.isInteger(page.last_page)
    );
}

export function todayScheduleUrl(start: Date, end: Date, page: number): string {
    const params = new URLSearchParams({
        view: 'schedule',
        source: 'all',
        page: String(page),
        ends_after: start.toISOString(),
        starts_before: end.toISOString(),
    });

    return `/operations/dispatch-desk/jobs?${params.toString()}`;
}

async function fetchTodaySchedule(
    dayStart: number,
    signal: AbortSignal,
): Promise<Pick<TodayDispatchesState, 'jobs' | 'total' | 'truncated'>> {
    const start = new Date(dayStart);
    const end = new Date(dayStart);
    end.setDate(end.getDate() + 1);

    const jobs = new Map<number, DispatchJobViewModel>();
    let total = 0;
    let lastPage = 1;
    let page = 1;

    do {
        const response = await fetch(todayScheduleUrl(start, end, page), {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
            signal,
        });

        if (response.status === 401 || response.status === 403) {
            throw new ScheduleAccessDenied();
        }

        if (!response.ok) {
            throw new Error(`Schedule request failed (${response.status})`);
        }

        const payload: unknown = await response.json();

        if (!isDispatchDeskPage(payload)) {
            throw new Error('Unexpected schedule response');
        }

        for (const job of payload.jobs) {
            jobs.set(job.id, job);
        }

        total = payload.total;
        lastPage = payload.last_page;
        page += 1;
    } while (page <= lastPage && page <= TODAY_SCHEDULE_MAX_PAGES);

    return {
        jobs: [...jobs.values()],
        total,
        truncated: lastPage > TODAY_SCHEDULE_MAX_PAGES,
    };
}

/**
 * Loads today's (browser-local) dispatch window from the same server query the
 * dispatch desk Day view uses, so counts respect visibility and permissions.
 */
export function useTodayDispatches({
    dayStart,
    enabled,
    refreshKey,
}: {
    dayStart: number;
    enabled: boolean;
    refreshKey: string | null | undefined;
}): TodayDispatches {
    const [attempt, setAttempt] = useState(0);
    const [state, setState] = useState<TodayDispatchesState>(() => ({
        status: enabled ? 'loading' : 'forbidden',
        jobs: [],
        total: 0,
        truncated: false,
        refreshing: false,
        loadedAt: null,
        error: null,
    }));

    useEffect(() => {
        if (!enabled) {
            return;
        }

        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            setState((current) => ({
                ...current,
                status: current.status === 'ready' ? 'ready' : 'loading',
                refreshing: current.status === 'ready',
            }));

            fetchTodaySchedule(dayStart, controller.signal)
                .then((result) => {
                    if (controller.signal.aborted) {
                        return;
                    }

                    setState({
                        status: 'ready',
                        ...result,
                        refreshing: false,
                        loadedAt: Date.now(),
                        error: null,
                    });
                })
                .catch((error: unknown) => {
                    if (controller.signal.aborted) {
                        return;
                    }

                    setState((current) =>
                        error instanceof ScheduleAccessDenied
                            ? {
                                  ...current,
                                  status: 'forbidden',
                                  jobs: [],
                                  total: 0,
                                  refreshing: false,
                                  error: null,
                              }
                            : {
                                  ...current,
                                  status:
                                      current.status === 'ready'
                                          ? 'ready'
                                          : 'error',
                                  refreshing: false,
                                  error: SCHEDULE_ERROR,
                              },
                    );
                });
        }, 0);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [attempt, dayStart, enabled, refreshKey]);

    const retry = useCallback(() => setAttempt((value) => value + 1), []);

    return {
        ...state,
        status: enabled ? state.status : 'forbidden',
        retry,
    };
}
