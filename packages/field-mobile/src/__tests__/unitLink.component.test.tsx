import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useUnitLink } from '../hooks/useUnitLink';
import type { UnitLink, UnitLinkStore } from '../storage/unitLinkStore';

function memoryStore(initial: Record<number, UnitLink> = {}) {
    const rows = new Map<number, UnitLink>(
        Object.entries(initial).map(([id, link]) => [Number(id), link]),
    );
    const store: UnitLinkStore = {
        read: jest.fn(async (actorId: number) => rows.get(actorId) ?? null),
        write: jest.fn(async (actorId: number, link: UnitLink) => {
            rows.set(actorId, link);
        }),
        remove: jest.fn(async (actorId: number) => {
            rows.delete(actorId);
        }),
    };

    return { store, rows };
}

describe('useUnitLink', () => {
    it('keeps the link after an app restart', async () => {
        const saved = {
            assetCode: 'CRN-101',
            linkedAt: '2026-09-27T07:00:00+08:00',
        };
        const { store } = memoryStore({ 7: saved });

        const { result } = await renderHook(() => useUnitLink(7, store));

        await waitFor(() => expect(result.current.unitLink).toEqual(saved));
    });

    it('saves a new link with the time it was made', async () => {
        const { store, rows } = memoryStore();
        const { result } = await renderHook(() => useUnitLink(7, store));

        await act(async () => {
            result.current.link('CRN-101');
        });

        expect(result.current.unitLink?.assetCode).toBe('CRN-101');
        expect(
            Number.isFinite(
                Date.parse(result.current.unitLink?.linkedAt ?? ''),
            ),
        ).toBe(true);
        expect(rows.get(7)).toEqual(result.current.unitLink);
    });

    it('release removes the saved link so a restart comes back unlinked', async () => {
        const { store, rows } = memoryStore({
            7: { assetCode: 'CRN-101', linkedAt: '2026-09-27T07:00:00+08:00' },
        });
        const { result } = await renderHook(() => useUnitLink(7, store));
        await waitFor(() => expect(result.current.unitLink).not.toBeNull());

        await act(async () => {
            result.current.unlink();
        });

        expect(result.current.unitLink).toBeNull();
        expect(rows.has(7)).toBe(false);
    });

    it('a re-link gets a new link time', async () => {
        const earlier = '2026-09-27T07:00:00+08:00';
        const { store } = memoryStore({
            7: { assetCode: 'CRN-101', linkedAt: earlier },
        });
        const { result } = await renderHook(() => useUnitLink(7, store));
        await waitFor(() => expect(result.current.unitLink).not.toBeNull());

        await act(async () => {
            result.current.unlink();
        });
        await act(async () => {
            result.current.link('CRN-101');
        });

        expect(result.current.unitLink?.linkedAt).not.toBe(earlier);
    });

    it('never shows one operator the link another saved', async () => {
        const { store } = memoryStore({
            7: { assetCode: 'CRN-101', linkedAt: '2026-09-27T07:00:00+08:00' },
        });
        const { result, rerender } = await renderHook(
            ({ actorId }: { actorId: number }) => useUnitLink(actorId, store),
            { initialProps: { actorId: 7 } },
        );
        await waitFor(() => expect(result.current.unitLink).not.toBeNull());

        await rerender({ actorId: 8 });

        await waitFor(() => expect(store.read).toHaveBeenCalledWith(8));
        expect(result.current.unitLink).toBeNull();
    });

    it('stays unlinked when storage cannot be read', async () => {
        const { store } = memoryStore();
        (store.read as jest.Mock).mockRejectedValueOnce(new Error('no db'));

        const { result } = await renderHook(() => useUnitLink(7, store));

        await waitFor(() => expect(store.read).toHaveBeenCalled());
        expect(result.current.unitLink).toBeNull();
    });
});
