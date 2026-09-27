import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useTrackingPause } from '../hooks/useTrackingPause';
import type {
    TrackingPause,
    TrackingPauseStore,
} from '../storage/trackingPauseStore';

const LINK = { assetCode: 'CRN-101', linkedAt: '2026-09-28T06:00:00.000Z' };

function memoryStore(initial: Record<number, TrackingPause> = {}) {
    const rows = new Map<number, TrackingPause>(
        Object.entries(initial).map(([id, pause]) => [Number(id), pause]),
    );
    const store: TrackingPauseStore = {
        read: jest.fn(async (actorId: number) => rows.get(actorId) ?? null),
        write: jest.fn(async (actorId: number, pause: TrackingPause) => {
            rows.set(actorId, pause);
        }),
        remove: jest.fn(async (actorId: number) => {
            rows.delete(actorId);
        }),
    };

    return { store, rows };
}

describe('useTrackingPause', () => {
    it('remembers a pause from before the restart', async () => {
        const { store } = memoryStore({
            7: { assetCode: 'CRN-101', pausedAt: '2026-09-28T09:00:00.000Z' },
        });
        const { result } = await renderHook(() =>
            useTrackingPause(7, LINK, store),
        );

        await waitFor(() => expect(result.current.pausedByOperator).toBe(true));
    });

    it('saves a pause and forgets it when tracking is turned back on', async () => {
        const { store, rows } = memoryStore();
        const { result } = await renderHook(() =>
            useTrackingPause(7, LINK, store),
        );
        await waitFor(() =>
            expect(result.current.pausedByOperator).toBe(false),
        );

        await act(async () => result.current.markPaused());
        expect(result.current.pausedByOperator).toBe(true);
        await waitFor(() => expect(rows.get(7)?.assetCode).toBe('CRN-101'));

        await act(async () => result.current.clearPause());
        expect(result.current.pausedByOperator).toBe(false);
        await waitFor(() => expect(rows.has(7)).toBe(false));
    });

    it('does not carry one operator’s pause to another sign-in', async () => {
        const { store } = memoryStore({
            7: { assetCode: 'CRN-101', pausedAt: '2026-09-28T09:00:00.000Z' },
        });
        const { result, rerender } = await renderHook(
            ({ actorId }: { actorId: number }) =>
                useTrackingPause(actorId, LINK, store),
            { initialProps: { actorId: 7 } },
        );
        await waitFor(() => expect(result.current.pausedByOperator).toBe(true));

        await rerender({ actorId: 8 });

        await waitFor(() =>
            expect(result.current.pausedByOperator).toBe(false),
        );
    });

    it('treats unreadable storage as not paused, so tracking still resumes', async () => {
        const { store } = memoryStore();
        (store.read as jest.Mock).mockRejectedValueOnce(new Error('locked'));
        const { result } = await renderHook(() =>
            useTrackingPause(7, LINK, store),
        );

        await waitFor(() =>
            expect(result.current.pausedByOperator).toBe(false),
        );
    });
});
