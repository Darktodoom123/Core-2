import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    readDispatchDeskState,
    useDispatchDeskState,
} from '@/components/workspace/dispatch-desk/use-dispatch-desk-state';
import {
    dispatchSearchParams,
    useDispatchSearch,
} from '@/components/workspace/dispatch-desk/use-dispatch-search';

const history = readDispatchDeskState('?dispatch_view=history');
const response = (total: number) => ({
    ok: true,
    json: async () => ({
        jobs: [],
        total,
        current_page: 1,
        last_page: Math.max(1, Math.ceil(total / 25)),
        per_page: 25,
    }),
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('complete dispatch search', () => {
    it('keeps a new local view when an older deferred URL arrives and still accepts browser back', () => {
        const original = '/?view=dispatch';
        window.history.replaceState({}, '', original);
        const { result, rerender } = renderHook(
            ({ url }) => useDispatchDeskState(undefined, url),
            { initialProps: { url: original } },
        );
        act(() => result.current.setView('incoming'));
        const newer = window.location.pathname + window.location.search;
        rerender({ url: newer });
        rerender({ url: original });
        expect(result.current.state.view).toBe('incoming');
        expect(window.location.search).toContain('dispatch_view=incoming');
        act(() => {
            window.history.replaceState({}, '', original);
            window.dispatchEvent(new PopStateEvent('popstate'));
        });
        expect(result.current.state.view).toBe('schedule');
    });
    it('uses a local calendar interval and carries search and page to the server', () => {
        const params = new URLSearchParams(
            dispatchSearchParams(
                readDispatchDeskState(
                    '?dispatch_date=2026-09-05&dispatch_mode=calendar&dispatch_period=month&dispatch_page=3&dispatch_q=old',
                ),
            ),
        );
        expect(params.get('ends_after')).toBe(
            new Date(2026, 8, 1).toISOString(),
        );
        expect(params.get('starts_before')).toBe(
            new Date(2026, 9, 1).toISOString(),
        );
        expect(params.get('page')).toBe('3');
        expect(params.get('q')).toBe('old');
    });

    it('resets pagination for a new filter while selection preserves the page', () => {
        const { result } = renderHook(() =>
            useDispatchDeskState(
                undefined,
                '/?dispatch_view=history&dispatch_page=4',
            ),
        );
        act(() => result.current.setSelectedJobId(99));
        expect(result.current.state.page).toBe(4);
        act(() => result.current.setQuery('older job'));
        expect(result.current.state.page).toBe(1);
    });

    it('debounces queries and ignores a late result from a cancelled search', async () => {
        vi.useFakeTimers();
        let finishOld: (value: ReturnType<typeof response>) => void = () => {};
        const fetcher = vi
            .fn()
            .mockImplementationOnce(
                () =>
                    new Promise((resolve) => {
                        finishOld = resolve;
                    }),
            )
            .mockResolvedValueOnce(response(2));
        vi.stubGlobal('fetch', fetcher);
        const { result, rerender } = renderHook(
            ({ query }) => useDispatchSearch({ ...history, query }, [], false),
            { initialProps: { query: 'old' } },
        );
        await act(async () => {
            await vi.advanceTimersByTimeAsync(250);
        });
        rerender({ query: 'new' });
        expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
        await act(async () => {
            await vi.advanceTimersByTimeAsync(250);
        });
        expect(result.current.page?.total).toBe(2);
        await act(async () => {
            finishOld(response(99));
        });
        expect(result.current.page?.total).toBe(2);
        expect(fetcher.mock.calls[1][0]).toContain('q=new');
    });

    it('exposes failure and recovers when the user retries', async () => {
        vi.useFakeTimers();
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockRejectedValueOnce(new Error('offline'))
                .mockResolvedValueOnce(response(0)),
        );
        const { result } = renderHook(() =>
            useDispatchSearch(history, [], false),
        );
        await act(async () => {
            await vi.advanceTimersByTimeAsync(250);
        });
        expect(result.current.error).toContain('Retry');
        expect(result.current.page).toBeNull();
        act(() => result.current.retry());
        await act(async () => {
            await vi.advanceTimersByTimeAsync(250);
        });
        expect(result.current.error).toBeNull();
        expect(result.current.page?.total).toBe(0);
    });

    it('does not query the daily desk while using incoming work or resource coverage', async () => {
        vi.useFakeTimers();
        const fetcher = vi.fn();
        vi.stubGlobal('fetch', fetcher);
        renderHook(() =>
            useDispatchSearch({ ...history, view: 'incoming' }, [], false),
        );
        renderHook(() =>
            useDispatchSearch(
                { ...history, view: 'schedule', mode: 'resources' },
                [],
                false,
            ),
        );
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500);
        });
        expect(fetcher).not.toHaveBeenCalled();
    });
});
