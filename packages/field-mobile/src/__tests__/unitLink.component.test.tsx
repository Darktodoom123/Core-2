import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useUnitLink } from '../hooks/useUnitLink';
import type { UnitLinkSync } from '../hooks/useUnitLink';
import type { UnitLink, UnitLinkStore } from '../storage/unitLinkStore';
import type { ServerUnitLink } from '../types';

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

function serverLink(overrides: Partial<ServerUnitLink> = {}): ServerUnitLink {
    return {
        id: 1,
        operational_asset_id: 42,
        asset_code: 'CRN-101',
        asset_name: '50T Crane',
        dispatch_job_id: 9,
        linked_at: '2026-09-27T07:00:05+08:00',
        released_at: null,
        release_reason: null,
        ...overrides,
    };
}

function sync(overrides: Partial<UnitLinkSync> = {}) {
    const outbox = {
        enqueueLinkUnit: jest.fn().mockResolvedValue({}),
        enqueueReleaseUnit: jest.fn().mockResolvedValue({}),
    };
    const value: UnitLinkSync = {
        canFetch: false,
        apiClient: { fetchUnitLink: jest.fn().mockResolvedValue(null) },
        outbox,
        outboxCommands: [],
        ...overrides,
    };

    return { value, outbox };
}

const SAVED = { assetCode: 'CRN-101', linkedAt: '2026-09-27T07:00:00+08:00' };

describe('useUnitLink', () => {
    it('keeps the link after an app restart while offline', async () => {
        const { store } = memoryStore({ 7: SAVED });
        const { value } = sync();

        const { result } = await renderHook(() => useUnitLink(7, value, store));

        await waitFor(() => expect(result.current.unitLink).toEqual(SAVED));
    });

    it('a new phone picks up the link the server holds and saves it', async () => {
        const { store, rows } = memoryStore();
        const { value } = sync({
            canFetch: true,
            apiClient: {
                fetchUnitLink: jest.fn().mockResolvedValue(serverLink()),
            },
        });

        const { result } = await renderHook(() => useUnitLink(7, value, store));

        await waitFor(() =>
            expect(result.current.unitLink).toEqual({
                assetCode: 'CRN-101',
                linkedAt: '2026-09-27T07:00:05+08:00',
            }),
        );
        await waitFor(() => expect(rows.get(7)?.assetCode).toBe('CRN-101'));
    });

    it('a release made elsewhere unlinks this phone', async () => {
        const { store, rows } = memoryStore({ 7: SAVED });
        const { value } = sync({ canFetch: true });

        const { result } = await renderHook(() => useUnitLink(7, value, store));

        await waitFor(() =>
            expect(value.apiClient.fetchUnitLink).toHaveBeenCalled(),
        );
        await waitFor(() => expect(result.current.unitLink).toBeNull());
        await waitFor(() => expect(rows.has(7)).toBe(false));
    });

    it('linking saves it on the phone and sends it to the server', async () => {
        const { store, rows } = memoryStore();
        const { value, outbox } = sync();
        const { result } = await renderHook(() => useUnitLink(7, value, store));

        await act(async () => {
            result.current.link({
                assetCode: 'CRN-101',
                assetId: 42,
                jobId: 9,
            });
        });

        expect(result.current.unitLink?.assetCode).toBe('CRN-101');
        expect(rows.get(7)?.assetCode).toBe('CRN-101');
        expect(outbox.enqueueLinkUnit).toHaveBeenCalledWith({
            operational_asset_id: 42,
            dispatch_job_id: 9,
            asset_code: 'CRN-101',
        });
    });

    it('release removes the saved link and sends the release', async () => {
        const { store, rows } = memoryStore({ 7: SAVED });
        const { value, outbox } = sync();
        const { result } = await renderHook(() => useUnitLink(7, value, store));
        await waitFor(() => expect(result.current.unitLink).not.toBeNull());

        await act(async () => {
            result.current.unlink();
        });

        expect(result.current.unitLink).toBeNull();
        expect(rows.has(7)).toBe(false);
        expect(outbox.enqueueReleaseUnit).toHaveBeenCalledWith({
            asset_code: 'CRN-101',
        });
    });

    it('a re-link gets a new link time', async () => {
        const { store } = memoryStore({ 7: SAVED });
        const { value } = sync();
        const { result } = await renderHook(() => useUnitLink(7, value, store));
        await waitFor(() => expect(result.current.unitLink).not.toBeNull());

        await act(async () => {
            result.current.unlink();
        });
        await act(async () => {
            result.current.link({ assetCode: 'CRN-101', assetId: 42 });
        });

        expect(result.current.unitLink?.linkedAt).not.toBe(SAVED.linkedAt);
    });

    it('never shows one operator the link another saved', async () => {
        const { store } = memoryStore({ 7: SAVED });
        const { value } = sync();
        const { result, rerender } = await renderHook(
            ({ actorId }: { actorId: number }) =>
                useUnitLink(actorId, value, store),
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
        const { value } = sync();

        const { result } = await renderHook(() => useUnitLink(7, value, store));

        await waitFor(() => expect(store.read).toHaveBeenCalled());
        expect(result.current.unitLink).toBeNull();
    });
});
