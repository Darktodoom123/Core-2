import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useLastServerView } from '../hooks/useLastServerView';
import type { LastServerViewStores } from '../hooks/useLastServerView';
import {
    parseSavedJobs,
    parseSavedShift,
} from '../storage/lastServerViewStore';
import type { SavedServerView } from '../storage/lastServerViewStore';
import type { CurrentHosShiftResponse, DispatchJob } from '../types/index';

const JOB = { id: 1, reference: 'DSP-PH-2026-001' } as DispatchJob;
const SHIFT = {
    shift: null,
    clocks: { shift_active: true, current_duty_status: 'standby' },
} as unknown as CurrentHosShiftResponse;
const SAVED_AT = '2026-09-28T01:10:00.000Z';

function memory<T>(initial: Record<number, SavedServerView<T>> = {}) {
    const rows = new Map<number, SavedServerView<T>>(
        Object.entries(initial).map(([id, row]) => [Number(id), row]),
    );

    return {
        rows,
        store: {
            read: jest.fn(async (id: number) => rows.get(id) ?? null),
            write: jest.fn(async (id: number, row: SavedServerView<T>) => {
                rows.set(id, row);
            }),
            remove: jest.fn(async (id: number) => {
                rows.delete(id);
            }),
        },
    };
}

function setup(saved = true) {
    const jobs = memory<DispatchJob[]>(
        saved ? { 7: { savedAt: SAVED_AT, value: [JOB] } } : {},
    );
    const shift = memory<CurrentHosShiftResponse>(
        saved ? { 7: { savedAt: SAVED_AT, value: SHIFT } } : {},
    );
    const stores: LastServerViewStores = {
        jobs: jobs.store,
        shift: shift.store,
    };
    const handlers = { restoreJobs: jest.fn(), restoreShift: jest.fn() };

    return { jobs, shift, stores, handlers };
}

describe('useLastServerView', () => {
    it('shows the saved jobs and shift after a restart, marked with when they were saved', async () => {
        const { stores, handlers } = setup();
        const { result } = await renderHook(() =>
            useLastServerView(7, handlers, stores),
        );

        await waitFor(() => expect(result.current.restoredFrom).toBe(SAVED_AT));
        expect(handlers.restoreJobs).toHaveBeenCalledWith([JOB]);
        expect(handlers.restoreShift).toHaveBeenCalledWith(SHIFT);
    });

    it('saves each live answer and drops the restored note', async () => {
        const { jobs, stores, handlers } = setup();
        const { result } = await renderHook(() =>
            useLastServerView(7, handlers, stores),
        );
        await waitFor(() => expect(result.current.restoredFrom).toBe(SAVED_AT));

        const fresh = [{ ...JOB, id: 2 }];
        await act(async () => result.current.rememberJobs(fresh));

        expect(result.current.restoredFrom).toBeNull();
        await waitFor(() => expect(jobs.rows.get(7)?.value).toEqual(fresh));
    });

    it('never replaces a live answer with an older saved one', async () => {
        const { stores, handlers } = setup();
        let release: () => void = () => undefined;
        stores.jobs.read = jest.fn(
            () =>
                new Promise((resolve) => {
                    release = () =>
                        resolve({ savedAt: SAVED_AT, value: [JOB] });
                }),
        );
        const { result } = await renderHook(() =>
            useLastServerView(7, handlers, stores),
        );

        await act(async () => result.current.rememberJobs([]));
        await act(async () => release());

        expect(handlers.restoreJobs).not.toHaveBeenCalled();
    });

    it('forgets the saved view on sign-out', async () => {
        const { jobs, shift, stores, handlers } = setup();
        const { result } = await renderHook(() =>
            useLastServerView(7, handlers, stores),
        );

        await act(async () => result.current.forget());

        await waitFor(() => expect(jobs.rows.has(7)).toBe(false));
        expect(shift.rows.has(7)).toBe(false);
    });

    it('does not read another operator’s saved view', async () => {
        const { stores, handlers } = setup();
        await renderHook(() => useLastServerView(8, handlers, stores));

        await waitFor(() => expect(stores.jobs.read).toHaveBeenCalledWith(8));
        expect(handlers.restoreJobs).not.toHaveBeenCalled();
    });
});

describe('saved server view parsing', () => {
    it('ignores unreadable rows', () => {
        expect(parseSavedJobs(null)).toBeNull();
        expect(parseSavedJobs({ savedAt: 'soon', value: [] })).toBeNull();
        expect(parseSavedShift({ savedAt: SAVED_AT, value: {} })).toBeNull();
        expect(
            parseSavedJobs({ savedAt: SAVED_AT, value: [JOB, { id: 'x' }] }),
        ).toEqual({ savedAt: SAVED_AT, value: [JOB] });
    });
});
