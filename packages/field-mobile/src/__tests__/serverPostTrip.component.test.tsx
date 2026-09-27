import { renderHook, waitFor } from '@testing-library/react-native';
import { useServerPostTrip } from '../hooks/useServerPostTrip';
import type { ServerPostTripInput } from '../hooks/useServerPostTrip';

const SHIFT_START = '2026-09-27T06:00:00+08:00';

function apiReturning(inspections: unknown[]) {
    return {
        fetchDvirInspections: jest.fn().mockResolvedValue({
            days: 2,
            inspections,
        }),
    };
}

function input(
    overrides: Partial<ServerPostTripInput> = {},
): ServerPostTripInput {
    return {
        canFetch: true,
        apiClient: apiReturning([]),
        assetId: 42,
        assetCode: 'CRN-101',
        shiftStartedAt: SHIFT_START,
        outboxCommands: [],
        ...overrides,
    };
}

describe('useServerPostTrip', () => {
    it('knows the post-trip is done when the server has one from this shift', async () => {
        const apiClient = apiReturning([
            {
                type: 'post_trip',
                asset_code: 'CRN-101',
                completed_at: '2026-09-27T16:40:00+08:00',
            },
        ]);

        const { result } = await renderHook(() =>
            useServerPostTrip(input({ apiClient })),
        );

        await waitFor(() => expect(result.current).toBe(true));
        expect(apiClient.fetchDvirInspections).toHaveBeenCalledWith(2, 42);
    });

    it('still asks for the post-trip when the server has none this shift', async () => {
        const apiClient = apiReturning([
            {
                type: 'post_trip',
                asset_code: 'CRN-101',
                completed_at: '2026-09-26T17:00:00+08:00',
            },
        ]);

        const { result } = await renderHook(() =>
            useServerPostTrip(input({ apiClient })),
        );

        await waitFor(() =>
            expect(apiClient.fetchDvirInspections).toHaveBeenCalled(),
        );
        expect(result.current).toBe(false);
    });

    it('does not call the server while it cannot answer', async () => {
        const apiClient = apiReturning([]);

        await renderHook(() =>
            useServerPostTrip(input({ apiClient, canFetch: false })),
        );

        expect(apiClient.fetchDvirInspections).not.toHaveBeenCalled();
    });

    it('stays not-done when the history request fails', async () => {
        const apiClient = {
            fetchDvirInspections: jest
                .fn()
                .mockRejectedValue(new Error('offline')),
        };

        const { result } = await renderHook(() =>
            useServerPostTrip(input({ apiClient })),
        );

        await waitFor(() =>
            expect(apiClient.fetchDvirInspections).toHaveBeenCalled(),
        );
        expect(result.current).toBe(false);
    });
});
