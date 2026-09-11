import { useEffect, useMemo, useState } from 'react';
import { dateFromLocalKey, startOfWeekLocalDate } from '@/lib/date-utils';
import type { DispatchJobViewModel } from '@/types/workspace';
import type { DispatchDeskUrlState } from './types';

interface DispatchSearchPage {
    jobs: DispatchJobViewModel[];
    total: number;
    current_page: number;
    last_page: number;
    per_page: number;
}

export function dispatchSearchParams(state: DispatchDeskUrlState): string {
    const params = new URLSearchParams({
        view: state.view,
        q: state.query,
        source: state.source,
        page: String(state.page),
    });

    if (state.view === 'schedule') {
        const period = state.mode === 'list' ? 'day' : state.period;
        const start = dateFromLocalKey(
            period === 'week' ? startOfWeekLocalDate(state.date) : state.date,
        );

        if (period === 'month') {
            start.setDate(1);
        }

        const end = new Date(start);

        if (period === 'month') {
            end.setMonth(end.getMonth() + 1);
        } else {
            end.setDate(end.getDate() + (period === 'week' ? 7 : 1));
        }

        params.set('ends_after', start.toISOString());
        params.set('starts_before', end.toISOString());
    }

    return params.toString();
}

export function useDispatchSearch(
    state: DispatchDeskUrlState,
    initialJobs: DispatchJobViewModel[],
    refreshing: boolean,
) {
    const key = dispatchSearchParams(state);
    const enabled =
        state.view !== 'incoming' &&
        !(state.view === 'schedule' && state.mode === 'resources');
    const [result, setResult] = useState<{
        key: string;
        page: DispatchSearchPage;
    } | null>(null);
    const [error, setError] = useState<{ key: string; message: string } | null>(
        null,
    );
    const [pending, setPending] = useState(false);
    const [retry, setRetry] = useState(0);

    useEffect(() => {
        if (!enabled || refreshing) {
            return;
        }

        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            setPending(true);
            setError(null);

            try {
                const response = await fetch(
                    `/operations/dispatch-desk/jobs?${key}`,
                    {
                        credentials: 'same-origin',
                        headers: { Accept: 'application/json' },
                        signal: controller.signal,
                    },
                );

                if (!response.ok) {
                    throw new Error('Search failed');
                }

                const page: DispatchSearchPage = await response.json();

                if (
                    !Array.isArray(page.jobs) ||
                    !Number.isInteger(page.total)
                ) {
                    throw new Error('Invalid search results');
                }

                if (!controller.signal.aborted) {
                    setResult({ key, page });
                }
            } catch {
                if (!controller.signal.aborted) {
                    setError({
                        key,
                        message:
                            'Dispatch search could not load. Retry to get complete results.',
                    });
                }
            } finally {
                if (!controller.signal.aborted) {
                    setPending(false);
                }
            }
        }, 250);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [enabled, key, refreshing, retry]);

    const page = result?.key === key && enabled ? result.page : null;
    const matchingError = error?.key === key ? error.message : null;
    const jobs = page?.jobs ?? initialJobs;
    // Keep the initial operational snapshot for resource/conflict context; a search
    // page must never imply that resources outside that page have no commitments.
    const contextJobs = useMemo(
        () =>
            Array.from(
                new Map(
                    [...initialJobs, ...jobs].map((job) => [job.id, job]),
                ).values(),
            ),
        [initialJobs, jobs],
    );

    return {
        jobs,
        contextJobs,
        page,
        pending: enabled && (pending || (!page && !matchingError)),
        error: enabled ? matchingError : null,
        retry: () => {
            setError(null);
            setRetry((value) => value + 1);
        },
    };
}
